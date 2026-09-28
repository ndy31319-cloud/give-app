import { buildAuthHeaders, requestEnvelope } from './backendClient';
export interface Reputation {
  score: number; count: number; positive: number; negative: number; neutral: number;
  reviews: { id: string; rating: number; content: string; createdAt: string }[];
}
export interface ReviewStatus { canReview: boolean; alreadyReviewed: boolean; reason: string | null; targetMemberId?: number; donateId?: number; }
export async function loadReputation(memberId: string, token?: string) {
  const result = await requestEnvelope<Reputation>(`/api/members/${encodeURIComponent(memberId)}/reputation`, { headers: buildAuthHeaders(token) });
  return { ...result, error: result.error || (!result.data ? '마음 점수를 불러오지 못했습니다.' : null) };
}
export async function loadReviewStatus(roomId: string, token?: string) {
  const result = await requestEnvelope<ReviewStatus>(`/api/chats/rooms/${encodeURIComponent(roomId)}/review-status`, { headers: buildAuthHeaders(token) });
  return { ...result, error: result.error || (!result.data ? '후기 작성 가능 여부를 확인하지 못했습니다.' : null) };
}
