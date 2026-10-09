import { inspectLockerQrPayload, maskLockerQrToken } from './lockerQr';

const validToken = 'give|donation_storage|7|41|1760000000000|4760000000000|5ffb6f86-5f98-4e3c-a0a7-4f8d9b5f0fa4';

test('보관함 QR 토큰을 인식한다', () => {
  const result = inspectLockerQrPayload(validToken, 1761000000000);
  expect(result.valid).toBe(true);
  expect(result.token).toBe(validToken);
});

test('다른 목적의 QR은 보관함 입고 QR로 거절한다', () => {
  const result = inspectLockerQrPayload(validToken.replace('donation_storage', 'pickup_auth'), 1761000000000);
  expect(result.valid).toBe(false);
  expect(result.message).toMatch('물품 보관용 QR');
});

test('QR 토큰은 화면에서 일부만 표시한다', () => {
  expect(maskLockerQrToken(validToken)).toMatch(/^give\|donat···5f0fa4$/);
});
