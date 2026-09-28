import { buildAuthHeaders, requestEnvelope } from './backendClient';
import { TradeAppointment } from '@/src/types/app';

export interface ActivityPost {
  id: string;
  postId: string;
  type: 'donate' | 'request';
  title: string;
  status: string;
  image: string | null;
  createdAt: string | null;
}
export interface ActivityTrade {
  appointment?: TradeAppointment;
  id: string;
  postId: string;
  title: string;
  donorId: string;
  requesterId: string;
  donorName: string;
  requesterName: string;
  status: string;
  postStatus: string;
  roomId: string | null;
  image: string | null;
  createdAt: string | null;
  expiresAt: string | null;
}
export interface ActivityData {
  donatedPosts: ActivityPost[];
  requestedPosts: ActivityPost[];
  sentRequests: ActivityTrade[];
  receivedRequests: ActivityTrade[];
  counts: { shares: number; requests: number; received: number; wanted: number };
}
export async function loadActivity(token: string) {
  const result = await requestEnvelope<ActivityData>('/api/mypage/activity', { headers: buildAuthHeaders(token) });
  return { data: result.data, error: result.error || (!result.data ? '서버 연결을 확인해주세요.' : null) };
}
