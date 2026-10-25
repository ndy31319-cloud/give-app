# 챗 봇 
import logging
import numpy as np
import faiss
import os
import re
import threading
import time
import httpx  

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from pydantic import BaseModel

from schemas.chat_schema import ChatRequest, ChatResponse, PolicyItem, ChatHistoryItem, ChatHistoryResponse
from core.chat_text import normalize_chatbot_text, remove_application_method_sections
from core.chat_prompt import build_policy_context, build_system_prompt, ensure_policy_link

logger = logging.getLogger(__name__)
router = APIRouter()

# -------------------------------------------------------------------
# 1. 환경변수 및 DB 연결 로드
# -------------------------------------------------------------------
load_dotenv(override=True)

DB_URL = os.getenv("DB_URL")
try:
    if not DB_URL:
        raise ValueError("DB_URL이 설정되지 않았습니다.")
    db_engine = create_engine(DB_URL, connect_args={"ssl": {}})
    logger.info("Aiven DB 엔진 초기화 완료!")
except Exception as e:
    logger.error(f"DB 연결 세팅 실패: {e}")
    db_engine = None

# -------------------------------------------------------------------
# 2. 클로바 스튜디오 API 세팅 (🔥 v3 규격: 단일 키 사용)
# -------------------------------------------------------------------
CLOVA_API_URL = os.getenv("CLOVA_API_URL")
CLOVA_STUDIO_API_KEY = os.getenv("CLOVA_STUDIO_API_KEY")

if not all([CLOVA_API_URL, CLOVA_STUDIO_API_KEY]):
    logger.warning("⚠️ 클로바 스튜디오 API 환경변수가 누락되었습니다. .env를 확인하세요.")

# -------------------------------------------------------------------
# 3. 한국어 임베딩 모델 로드 및 FAISS 인덱스 구축
# -------------------------------------------------------------------
logger.info("👉 한국어 AI 임베딩 모델 로드 중...")
try:
    embedder = SentenceTransformer('jhgan/ko-sroberta-multitask')
    logger.info("✅ 임베딩 모델 로드 완료!")
except Exception as e:
    logger.error(f"❌ 임베딩 모델 로드 실패: {e}")
    embedder = None

POLICIES_CACHE = []
faiss_index = None
MAX_MESSAGE_LENGTH = 500


def _safe_int_env(name, default, minimum=0):
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        logger.warning("환경변수 %s 값이 숫자가 아니어서 기본값 %s를 사용합니다.", name, default)
        return max(minimum, default)


SEMANTIC_TOP_K = max(5, _safe_int_env("POLICY_SEMANTIC_TOP_K", 8, 5))
RETURN_TOP_K = max(3, _safe_int_env("POLICY_RETURN_TOP_K", 5, 3))
POLICY_INDEX_TTL_SECONDS = _safe_int_env("POLICY_INDEX_TTL_SECONDS", 300, 0)
POLICY_EMBED_BATCH_SIZE = max(1, _safe_int_env("POLICY_EMBED_BATCH_SIZE", 32, 1))
policy_index_built_at = 0.0
policy_index_lock = threading.Lock()


def _compact(value):
    return " ".join(str(value or "").split())


def _policy_search_text(policy):
    return _compact(" ".join(
        str(policy.get(key) or "")
        for key in (
            "policy_name", "category", "agency", "summary", "target_criteria",
            "support_detail", "content", "ai_search_text", "application_period",
            "application_method", "region", "official_url", "application_url",
        )
    ))


def _normalize_search_text(value):
    return re.sub(r"\s+", "", str(value or "").lower())


def _query_terms(message):
    terms = re.findall(r"[가-힣A-Za-z0-9]{2,}", str(message or "").lower())
    return list(dict.fromkeys(terms))


def _policy_lexical_score(policy, message, terms):
    normalized_message = _normalize_search_text(message)
    title = _normalize_search_text(policy.get("policy_name"))
    category = _normalize_search_text(policy.get("category"))
    agency = _normalize_search_text(policy.get("agency"))
    searchable = _normalize_search_text(_policy_search_text(policy))
    score = 0
    if title and title in normalized_message:
        score += 120
    for term in terms:
        normalized_term = _normalize_search_text(term)
        if len(normalized_term) < 2:
            continue
        if normalized_term in title:
            score += 24
        elif normalized_term in category:
            score += 14
        elif normalized_term in agency:
            score += 10
        elif normalized_term in searchable:
            score += 4
    return score

def build_faiss_index():
    global POLICIES_CACHE, faiss_index, policy_index_built_at
    if not db_engine or not embedder:
        return False
    if not policy_index_lock.acquire(blocking=False):
        return bool(POLICIES_CACHE and faiss_index is not None)
    try:
        with db_engine.connect() as conn:
            column_rows = conn.execute(text("SHOW COLUMNS FROM POLICY")).fetchall()
            columns = {row[0] for row in column_rows}
            optional_fields = {
                "official_url": "official_url",
                "application_url": "application_url",
                "application_method": "application_method",
                "application_period": "application_period",
                "region": "region",
                "source_updated_at": "source_updated_at",
            }
            selected = [
                "policy_id", "policy_name", "category", "agency", "summary",
                "target_criteria", "support_detail", "content", "ai_search_text",
            ]
            for column, alias in optional_fields.items():
                selected.append(column if column in columns else f"NULL AS {alias}")
            rows = conn.execute(text(
                f"SELECT {', '.join(selected)} FROM POLICY ORDER BY policy_id"
            )).mappings().all()
        if not rows:
            POLICIES_CACHE = []
            faiss_index = None
            policy_index_built_at = time.time()
            return False

        next_policies = []
        for row in rows:
            policy = {key: row.get(key) for key in (
                "policy_id", "policy_name", "category", "agency", "summary",
                "target_criteria", "support_detail", "content", "ai_search_text",
                "official_url", "application_url", "application_method", "application_period", "region",
                "source_updated_at",
            )}
            for field in (
                "policy_name", "category", "agency", "summary", "target_criteria",
                "support_detail", "content", "ai_search_text", "official_url",
                "application_url", "application_method", "application_period", "region",
            ):
                policy[field] = _compact(policy[field])
            if policy["source_updated_at"] is not None and hasattr(policy["source_updated_at"], "isoformat"):
                policy["source_updated_at"] = policy["source_updated_at"].isoformat()
            policy["search_text"] = _policy_search_text(policy)
            next_policies.append(policy)

        texts = [p["search_text"] or p["policy_name"] for p in next_policies]
        embeddings = embedder.encode(
            texts,
            batch_size=POLICY_EMBED_BATCH_SIZE,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        embeddings = np.atleast_2d(np.asarray(embeddings, dtype="float32"))
        dimension = embeddings.shape[1]
        next_index = faiss.IndexFlatL2(dimension)
        next_index.add(embeddings)
        # Replace both objects together only after the new index is complete.
        POLICIES_CACHE = next_policies
        faiss_index = next_index
        policy_index_built_at = time.time()
        logger.info("✅ FAISS 인덱싱 완료: %s개 정책, 의미 검색 상위 %s개 + 키워드 보정", len(POLICIES_CACHE), SEMANTIC_TOP_K)
        return True
    except Exception as e:
        logger.error(f"❌ FAISS 인덱스 구축 실패: {e}")
        return False
    finally:
        policy_index_lock.release()


def refresh_policy_index_if_needed():
    if not POLICIES_CACHE or faiss_index is None:
        return build_faiss_index()
    if POLICY_INDEX_TTL_SECONDS and time.time() - policy_index_built_at >= POLICY_INDEX_TTL_SECONDS:
        return build_faiss_index()
    return True


def search_policies(message):
    if not refresh_policy_index_if_needed():
        return []
    user_vector = embedder.encode([message])
    semantic_k = min(SEMANTIC_TOP_K, len(POLICIES_CACHE))
    distances, indices = faiss_index.search(np.array(user_vector).astype("float32"), semantic_k)
    semantic_rank = {
        int(index): rank
        for rank, index in enumerate(indices[0])
        if index != -1 and index < len(POLICIES_CACHE)
    }
    terms = _query_terms(message)
    scored = []
    for index, policy in enumerate(POLICIES_CACHE):
        lexical = _policy_lexical_score(policy, message, terms)
        rank = semantic_rank.get(index)
        semantic = (semantic_k - rank) * 3 if rank is not None else 0
        if lexical or rank is not None:
            scored.append((lexical + semantic, lexical, -(rank if rank is not None else semantic_k + 1), policy))
    scored.sort(key=lambda item: (item[0], item[1], item[2]), reverse=True)
    return [item[3] for item in scored[:RETURN_TOP_K]]

build_faiss_index()

# -------------------------------------------------------------------
# 4. [기능 1] 대화 기록 삭제 API (채팅 지우기 버튼용)
# -------------------------------------------------------------------
class ClearChatRequest(BaseModel):
    member_id: int

@router.post("/clear")
async def clear_chat_history(request: ClearChatRequest):
    """사용자가 앱을 나가거나 '대화 지우기'를 눌렀을 때 호출되는 API"""
    if not db_engine:
        raise HTTPException(status_code=500, detail="DB 연결이 없습니다.")
    try:
        with db_engine.begin() as conn:
            conn.execute(
                text("DELETE FROM AI_CHAT_HISTORY WHERE member_id = :mid"),
                {"mid": request.member_id}
            )
        return {"message": "대화 기록이 성공적으로 삭제되었습니다."}
    except Exception as e:
        logger.error(f"대화 기록 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 기록 삭제 중 오류가 발생했습니다.")

# -------------------------------------------------------------------
# 5. 챗봇 엔드포인트
# -------------------------------------------------------------------
@router.post("/", response_model=ChatResponse)
async def process_chat(request: ChatRequest):
    message = request.user_message
    member_id = request.member_id if isinstance(request.member_id, int) and request.member_id > 0 else None

    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")
    if len(message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail=f"질문이 너무 깁니다. {MAX_MESSAGE_LENGTH}자 이내로 요약해 주세요.")
    if not embedder or (faiss_index is None and not refresh_policy_index_if_needed()):
        raise HTTPException(status_code=503, detail="AI 엔진이 준비되지 않았습니다.")

    # [Step 1: 의미 검색 + 정책명/분야/기관 키워드 보정]
    try:
        matched_policies = await run_in_threadpool(search_policies, message)
    except Exception as e:
        logger.error(f"FAISS 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="AI 검색 중 오류가 발생했습니다.")

    # 검색 레코드에 포함된 공식 URL만 모델에 전달한다.
    policies_str = build_policy_context(matched_policies)

    # [Step 2 & 기능 2] DB에서 이전 대화 기록(Context) 가져오기
    past_messages = []
    if db_engine and member_id is not None:
        try:
            with db_engine.connect() as conn:
                rows = conn.execute(
                    text("""
                        SELECT role, content FROM (
                            SELECT role, content, created_at
                            FROM AI_CHAT_HISTORY
                            WHERE member_id = :mid
                            ORDER BY created_at DESC
                            LIMIT 10
                        ) AS recent_history
                        ORDER BY created_at ASC
                    """),
                    {"mid": member_id}
                ).fetchall()
                for r in rows:
                    past_messages.append({"role": r[0], "content": r[1]})
        except Exception as e:
            logger.error(f"히스토리 로드 실패: {e}")

    # [Step 3] 현재 정책 문맥과 안전 원칙을 포함해 CLOVA API 호출
    system_prompt = build_system_prompt(policies_str, bool(past_messages))

    # 클로바 규격에 맞게 메시지 리스트 생성 (시스템 -> 과거대화 -> 현재질문)
    clova_messages = [{"role": "system", "content": system_prompt}]
    clova_messages.extend(past_messages)
    clova_messages.append({"role": "user", "content": message})

    # 🔥 v3 API 규격에 맞춘 새로운 헤더 (단일 키 사용)
    headers = {
        "Authorization": f"Bearer {CLOVA_STUDIO_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    payload = {
        "messages": clova_messages,
        "topP": 0.8, "topK": 0, "maxTokens": 500,
        "temperature": 0.5, "repeatPenalty": 5.0
    }

    try:
        if not CLOVA_API_URL or not CLOVA_STUDIO_API_KEY:
            raise HTTPException(status_code=503, detail="AI 챗봇 서버 설정이 완료되지 않았습니다.")

        async with httpx.AsyncClient() as client:
            response = await client.post(CLOVA_API_URL, headers=headers, json=payload, timeout=20.0)
            
            if response.status_code != 200:
                logger.error(f"CLOVA 통신 에러: {response.status_code} - {response.text}")
                raise HTTPException(status_code=503, detail="AI 서버 통신 중 오류가 발생했습니다.")
                
            try:
                res_json = response.json()
                raw_answer = res_json["result"]["message"]["content"]
                if not isinstance(raw_answer, str) or not raw_answer.strip():
                    raise ValueError("AI response content is empty")
            except (ValueError, KeyError, TypeError) as parse_error:
                logger.error(f"CLOVA 응답 파싱 실패: {parse_error}")
                raise HTTPException(status_code=502, detail="AI 응답 형식이 올바르지 않습니다.")

            ai_answer = normalize_chatbot_text(raw_answer)
            ai_answer = ensure_policy_link(ai_answer, matched_policies, message)
            ai_answer = remove_application_method_sections(ai_answer)
            if not ai_answer:
                raise HTTPException(status_code=502, detail="AI 서버가 빈 답변을 반환했습니다.")

    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("CLOVA 서버 응답 시간 초과")
        raise HTTPException(status_code=504, detail="AI 응답 시간이 초과되었습니다.")
    except httpx.HTTPError as e:
        logger.error(f"CLOVA 서버 통신 실패: {e}")
        raise HTTPException(status_code=503, detail="AI 서버에 연결할 수 없습니다.")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"챗봇 API 처리 실패: {error_msg}")
        raise HTTPException(status_code=500, detail="AI 응답 생성 중 오류가 발생했습니다.")

    # [Step 4 & 기능 3] DB에 현재 대화 저장 (사용자 질문 + AI 답변)
    if db_engine and member_id is not None:
        try:
            with db_engine.begin() as conn:
                conn.execute(
                    text("INSERT INTO AI_CHAT_HISTORY (member_id, role, content) VALUES (:mid, 'user', :msg)"),
                    {"mid": member_id, "msg": message}
                )
                conn.execute(
                    text("INSERT INTO AI_CHAT_HISTORY (member_id, role, content) VALUES (:mid, 'assistant', :ans)"),
                    {"mid": member_id, "ans": ai_answer}
                )
                
                # 기존 검색 기록(SEARCH_HISTORY) 저장 로직
                if matched_policies:
                    conn.execute(
                        text("""
                            INSERT INTO SEARCH_HISTORY (member_id, query_text, search_date, recommend_policy_id)
                            VALUES (:mid, :msg, NOW(), :pid)
                        """),
                        {"mid": member_id, "msg": message, "pid": matched_policies[0]["policy_id"]}
                    )
        except Exception as e:
            logger.error(f"❌ 대화 기록 DB 저장 실패: {e}")

    # =================================================================
    # 🔥 [여기에 삽입!] AI가 되물어봤을 경우 엉뚱한 정책 리스트 날리기
    # =================================================================
    if len(past_messages) == 0 and ("어떤 정책" in ai_answer or "알려주시면" in ai_answer):
        matched_policies = []  # 프론트로 갈 정책 리스트를 싹 비움
        keyword = "알 수 없음"
        confidence = "문맥 부족으로 검색 보류"
    else:
        keyword = matched_policies[0]["policy_name"] if matched_policies else "알 수 없음"
        confidence = "RAG 시맨틱 매칭 성공" if matched_policies else "결과 없음"

    return ChatResponse(
        extracted_keyword=keyword,
        ai_confidence=confidence,
        ai_response=ai_answer,
        recommended_policies=[PolicyItem(**p) for p in matched_policies]
    )

@router.get("/history/{member_id}", response_model=ChatHistoryResponse)
async def get_chat_history(member_id: int):
    if not db_engine:
        raise HTTPException(status_code=500, detail="DB 연결이 없습니다.")

    chat_history = []
    try:
        with db_engine.connect() as conn:
            rows = conn.execute(
    text("""
        SELECT role, content FROM (
            SELECT role, content, created_at 
            FROM AI_CHAT_HISTORY 
            WHERE member_id = :mid 
            ORDER BY created_at DESC LIMIT 10
        ) AS sub 
        ORDER BY created_at ASC
    """),
    {"mid": member_id}
).fetchall()

            for r in rows:
                chat_history.append({
                    "role": r[0],
                    "content": r[1],
                    "created_at": r[2].strftime("%Y-%m-%d %H:%M:%S") if r[2] else ""
                })

        return ChatHistoryResponse(member_id=member_id, history=chat_history)

    except Exception as e:
        logger.error(f"대화 기록 불러오기 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 기록을 불러오는 중 오류가 발생했습니다.")
