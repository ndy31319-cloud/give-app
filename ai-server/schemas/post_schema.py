from pydantic import BaseModel, Field
from typing import List, Optional

# (기존) 1. 단순 이미지 분석용 양식
class ImageAnalyzeResponse(BaseModel):
    filename: str
    ai_guess: str
    confidence: float
    is_dangerous: bool
    message: str

# (신규) 2. 당근마켓형 다중 이미지 AI 글쓰기 응답 양식
class PostGenerationResponse(BaseModel):
    is_safe: bool = True                # True = 등록 가능 / False = 유해물품
    is_same_item: bool = True           # 사진들이 동일한 물품인지 여부
    rejection_reason: Optional[str] = None
    category: Optional[str] = None      # 카테고리 (예: 패션잡화/지갑)
    suggested_title: Optional[str] = None
    extracted_features: list[str] = Field(default_factory=list)
    ai_generated_post: Optional[str] = None
    confidence: Optional[float] = None

class ImageBatchSafetyResponse(BaseModel):
    is_safe: bool               # True = 모든 사진 안전 / False = 유해물품 감지
    message: str                # 사용자에게 보여줄 안내 문구
    dangerous_file: Optional[str] = None   # 유해물품이 감지된 파일 이름 (안전 시 None)
    dangerous_label: Optional[str] = None  # AI가 감지한 유해물품 레이블 (안전 시 None)
