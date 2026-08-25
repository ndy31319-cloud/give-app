from pydantic import BaseModel
from typing import List, Optional



# (신규) 2. 당근마켓형 다중 이미지 AI 글쓰기 응답 양식
class PostGenerationResponse(BaseModel):
    is_same_item: bool = True           # 사진들이 동일한 물품인지 여부
    category: str                     # 카테고리 (예: 패션잡화/지갑)
    suggested_title: str              # AI가 추천한 매력적인 제목
    extracted_features: list[str]     # 뽑아낸 특징들 (리스트 형태)
    ai_generated_post: str            # 최종 완성된 판매글 본문
    confidence: float                 # AI의 확신도
