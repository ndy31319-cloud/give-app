import { buildAuthHeaders, requestEnvelope } from './backendClient';
export interface Inquiry { id: string; memberId: string; nickname: string; category: string; subject: string; message: string; email: string; status: string; answer: string | null; createdAt: string | null; answeredAt: string | null; }
export interface InquiryPage { items: Inquiry[]; pendingCount: number; nextCursor: string | null; }
async function call<T>(path: string, token?: string, method = 'GET', body?: unknown) {
  const result = await requestEnvelope<T>(`/api/inquiries${path}`, { method, headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }), body: body === undefined ? undefined : JSON.stringify(body) });
  return { ...result, error: result.error || (!result.data ? '문의 서버에 연결할 수 없습니다.' : null) };
}
export const inquiryAPI = {
  list: (admin: boolean, status: string, token?: string, cursor?: string) => call<InquiryPage>(`?mode=${admin ? 'admin' : 'mine'}&status=${encodeURIComponent(status)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, token),
  detail: (id: string, token?: string) => call<Inquiry>(`/${encodeURIComponent(id)}`, token),
  create: (body: { subject: string; message: string; category: string; requestKey: string }, token?: string) => call<Inquiry>('', token, 'POST', body),
  reply: (id: string, answer: string, token?: string) => call<Inquiry>(`/${encodeURIComponent(id)}/reply`, token, 'POST', { answer }),
};
