import { buildAuthHeaders, requestEnvelope } from './backendClient';
import { AppointmentDetails, TradeAction, TradeRequest } from '@/src/types/app';

async function request(path: string, token?: string, method = 'GET', body?: unknown) {
  const result = await requestEnvelope<TradeRequest>(`/api/trades${path}`, {
    method, headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }), body: body === undefined ? undefined : JSON.stringify(body),
  });
  return result.data || result.error ? result : { data: null, error: '백엔드 연결 설정을 확인해주세요.' };
}

export const tradeAPI = {
  proposeAppointment: (id: string, input: Omit<AppointmentDetails, 'proposedBy'> & { revision: number }, token?: string) => request(`/${encodeURIComponent(id)}/appointment`, token, 'PUT', input),
  confirmAppointment: (id: string, revision: number, token?: string) => request(`/${encodeURIComponent(id)}/appointment/confirm`, token, 'POST', { revision }),
  create: (postId: string, token?: string) => request(`/posts/${encodeURIComponent(postId)}`, token, 'POST'),
  get: (id: string, token?: string) => request(`/${encodeURIComponent(id)}`, token),
  act: (id: string, action: TradeAction, token?: string) => request(`/${encodeURIComponent(id)}/${action}`, token, 'POST'),
};
