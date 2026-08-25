# 챗 봇 
import logging
import numpy as np
import faiss
import os
import httpx  

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from pydantic import BaseModel

from schemas.chat_schema import ChatRequest, ChatResponse, PolicyItem, ChatHistoryItem, ChatHistoryResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# -------------------------------------------------------------------
# 1. 환경변수 및 DB 연결 로드
# -------------------------------------------------------------------
load_dotenv(override=True)

DB_URL = os.getenv("DB_URL")
try:
    db_engine = create_engine(DB_URL, connect_args={"ssl": {}})
    logger.info("✅ Aiven DB 엔진 초기화 완료!")
except Exception as e:
    logger.error(f"❌ DB 연결 세팅 실패: {e}")
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

def build_faiss_index():
    global POLICIES_CACHE, faiss_index
    if not db_engine or not embedder: return
    try:
        with db_engine.connect() as conn:
            rows = conn.execute(text(
                """
                SELECT policy_id, policy_name, category, agency, summary,
                       target_criteria, support_detail, content, ai_search_text
                FROM POLICY ORDER BY policy_id
                """
            )).fetchall()
        if not rows: return

        POLICIES_CACHE = [
            {
                "policy_id": r[0], "policy_name": " ".join(r[1].split()),
                "category": r[2], "agency": r[3], "summary": " ".join(r[4].split()),
                "target_criteria": r[5], "support_detail": r[6], "content": r[7],
                "ai_search_text": r[8],
            } for r in rows
        ]
        texts = [p["ai_search_text"] for p in POLICIES_CACHE]
        embeddings = embedder.encode(texts)
        dimension = embeddings.shape[1]
        faiss_index = faiss.IndexFlatL2(dimension)
        faiss_index.add(np.array(embeddings).astype("float32"))
        logger.info("✅ FAISS 인덱싱 완료! 시맨틱 엔진 준비 완료.")
    except Exception as e:
        logger.error(f"❌ FAISS 인덱스 구축 실패: {e}")

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
    member_id = request.member_id or 1

    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")
    if len(message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail=f"질문이 너무 깁니다. {MAX_MESSAGE_LENGTH}자 이내로 요약해 주세요.")
    if not embedder or faiss_index is None:
        raise HTTPException(status_code=503, detail="AI 엔진이 준비되지 않았습니다.")

    # [Step 1: FAISS 검색]
    try:
        user_vector = await run_in_threadpool(embedder.encode, [message])
        distances, indices = faiss_index.search(np.array(user_vector).astype("float32"), 2)
    except Exception as e:
        logger.error(f"FAISS 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="AI 검색 중 오류가 발생했습니다.")

    # 1. 일단 FAISS가 찾은 2개를 임시 리스트에 담습니다.
    raw_matched_policies = []
    for idx in indices[0]:
        if idx != -1 and idx < len(POLICIES_CACHE):
            raw_matched_policies.append(POLICIES_CACHE[idx])

    # -------------------------------------------------------------------
    # 🔥 [여기에 핵심 필터링 로직 추가] 
    # 사용자가 특정 정책 이름을 콕 집어 물어봤는지 확인합니다.
    # -------------------------------------------------------------------
    matched_policies = []
    user_msg_clean = message.replace(" ", "")  # 띄어쓰기 무시하고 비교하기 위함

    for p in raw_matched_policies:
        policy_name_clean = p['policy_name'].replace(" ", "")
        
        # 질문(user_message) 안에 정책 이름이 통째로 들어있다면?
        if policy_name_clean in user_msg_clean:
            matched_policies = [p]  # 💡 다른 건 다 날리고 이 정책 1개만 넣습니다!
            break                   # 찾았으니 즉시 반복문 종료
            
    # 만약 사용자가 특정 정책 이름을 말하지 않았다면 (예: "도와주세요")
    # 그냥 FAISS가 찾은 2개를 그대로 사용합니다.
    if not matched_policies:
        matched_policies = raw_matched_policies

    # -------------------------------------------------------------------

    # 2. 걸러진 최종 정책(matched_policies)으로 AI에게 줄 텍스트 조립
    policy_texts = []
    for p in matched_policies:
        policy_texts.append(
            f"- 정책명: {p['policy_name']}\n"
            f"  담당기관: {p['agency']}\n"
            f"  지원대상: {p['target_criteria']}\n"
            f"  지원내용: {p['support_detail']}"
        )
    
    policies_str = "\n\n".join(policy_texts) if policy_texts else "검색된 정책 없음"

    # [Step 2 & 기능 2] DB에서 이전 대화 기록(Context) 가져오기
    past_messages = []
    if db_engine:
        try:
            with db_engine.connect() as conn:
                rows = conn.execute(
                    text("""
                        SELECT role, content FROM AI_CHAT_HISTORY 
                        WHERE member_id = :mid 
                        ORDER BY created_at ASC LIMIT 10
                    """),
                    {"mid": member_id}
                ).fetchall()
                for r in rows:
                    past_messages.append({"role": r[0], "content": r[1]})
        except Exception as e:
            logger.error(f"히스토리 로드 실패: {e}")

    # 🔥 [핵심 추가] 파이썬 코드로 대화 내역 유무를 판단하여 AI에게 팩트 폭격!
    if len(past_messages) == 0:
        context_status = """
🚨 [시스템 긴급 통제: 현재 과거 대화 내역 없음 (첫 대화)]
사용자가 '지원 대상이 누군데?', '신청방법은?' 처럼 주어(정책명) 없이 다짜고짜 질문했다면, 검색된 [DB 정보]를 **절대 읽지도, 입 밖으로 꺼내지도 마세요.** 오직 "어떤 정책을 말씀하시나요? 정책 이름을 알려주시면 안내해 드릴게요!" 라고만 짧게 되물어보세요. (정책 나열 절대 금지)
"""
    else:
        context_status = "✅ [시스템 상태: 과거 대화 내역 있음] 이전 대화 문맥을 파악하여 자연스럽게 이어서 답변하세요."

    # [Step 3] CLOVA Studio 프롬프트 조합 및 API 호출 (🔥 v3 규격 적용)
    system_prompt = f"""
너는 취약계층 나눔/기부 플랫폼의 전문적이고 신뢰감을 주는 전담 사회복지사 '나눔이'야.
따뜻하고 친절한 태도를 유지하되, 복지 정책을 안내할 때는 공공기관 직원처럼 정확하고 체계적인 어조를 사용해.

{context_status}

[DB에서 검색된 관련 정책 정보]
{policies_str}

[🔥 핵심 답변 원칙]
1. 정책 안내: 검색된 [DB 정보]를 바탕으로 정확하게 안내해.
2. 정부24 추가 안내 (필수): 답변의 마지막이나, 정책에 대해 추가적인 조언이 필요할 때는 다음 멘트를 자연스럽게 덧붙여줘. "더 다양한 맞춤형 혜택은 정부24 보조금 안내 사이트(https://www.gov.kr/portal/gvrnPolicy/listAll)에서 지역별, 대상별로 상세하게 검색해 보실 수 있습니다."
3. 어르신 맞춤 전문성: 답변은 3~4문장 내외로 간결하게 정리하고, 너무 유치하지 않은 부드러운 격식체(~합니다, ~해요)를 사용해.
4. 절대 금지: 마크다운 기호(**, *)를 단 한 개도 사용하지 마. 오직 일반 텍스트로만 출력해.
"""

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
        async with httpx.AsyncClient() as client:
            response = await client.post(CLOVA_API_URL, headers=headers, json=payload, timeout=20.0)
            
            if response.status_code != 200:
                logger.error(f"CLOVA 통신 에러: {response.status_code} - {response.text}")
                raise HTTPException(status_code=503, detail="AI 서버 통신 중 오류가 발생했습니다.")
                
            res_json = response.json()
            ai_answer = res_json['result']['message']['content']

    except Exception as e:
        error_msg = str(e)
        print(f"\n🚨 [챗봇 API] CLOVA 서버 통신 에러: {error_msg}\n")
        raise HTTPException(status_code=500, detail="AI 응답 생성 중 오류가 발생했습니다.")

    # [Step 4 & 기능 3] DB에 현재 대화 저장 (사용자 질문 + AI 답변)
    if db_engine:
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