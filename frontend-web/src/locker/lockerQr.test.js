import { inspectLockerQrPayload, maskLockerQrToken } from './lockerQr';

const validToken = 'give|donation_storage|7|41|1760000000000|4760000000000|5ffb6f86-5f98-4e3c-a0a7-4f8d9b5f0fa4';

test('보관함 QR 토큰을 인식한다', () => {
  const result = inspectLockerQrPayload(validToken, 1761000000000);
  expect(result.valid).toBe(true);
  expect(result.token).toBe(validToken);
});

test('DB display code 형식의 보관함 QR을 인식한다', () => {
  const result = inspectLockerQrPayload('WF-2026-A7K9', 1761000000000);
  expect(result.valid).toBe(true);
  expect(result.token).toBe('WF-2026-A7K9');
});

test('하이픈 없는 인증번호는 DB display code로 보정한다', () => {
  const result = inspectLockerQrPayload('2026A7K9', 1761000000000);
  expect(result.valid).toBe(true);
  expect(result.token).toBe('WF-2026-A7K9');
});

test('뒤 4자리만 입력해도 현재 연도 display code로 보정한다', () => {
  const year = new Date().getFullYear();
  const result = inspectLockerQrPayload('A7K9');
  expect(result.valid).toBe(true);
  expect(result.token).toBe(`WF-${year}-A7K9`);
});

test('랜덤 비밀 토큰 형식의 보관함 QR을 인식한다', () => {
  const secretToken = 'gq_abcdefghijklmnopqrstuvwxyzABCDEF';
  const result = inspectLockerQrPayload(secretToken, 1761000000000);
  expect(result.valid).toBe(true);
  expect(result.token).toBe(secretToken);
});

test('다른 목적의 QR은 보관함 입고 QR로 거절한다', () => {
  const result = inspectLockerQrPayload(validToken.replace('donation_storage', 'pickup_auth'), 1761000000000);
  expect(result.valid).toBe(false);
  expect(result.message).toMatch('물품 보관용 QR');
});

test('QR 토큰은 화면에서 일부만 표시한다', () => {
  expect(maskLockerQrToken(validToken)).toMatch(/^give\|donat···5f0fa4$/);
});
