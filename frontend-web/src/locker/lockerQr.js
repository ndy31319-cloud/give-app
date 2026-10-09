const QR_TOKEN_PART_COUNT = 7;

function extractToken(rawPayload) {
  const raw = String(rawPayload || '').trim();
  if (!raw) return '';

  try {
    const json = JSON.parse(raw);
    if (typeof json?.token === 'string') return json.token.trim();
  } catch {
    // QR은 일반적으로 원문 토큰이므로 JSON이 아니어도 정상입니다.
  }

  try {
    const url = new URL(raw);
    return (url.searchParams.get('token') || url.searchParams.get('qrToken') || '').trim();
  } catch {
    return raw;
  }
}

export function inspectLockerQrPayload(rawPayload, now = Date.now()) {
  const token = extractToken(rawPayload);
  if (!token) {
    return { valid: false, token: '', message: 'QR 값을 읽지 못했습니다. 다시 비춰주세요.' };
  }

  const parts = token.split('|');
  if (parts.length !== QR_TOKEN_PART_COUNT || parts[0] !== 'give') {
    return {
      valid: false,
      token,
      message: '유효하지 않은 QR 코드입니다. 나눔 앱에서 발급한 보관함 입고 QR인지 확인해주세요.',
    };
  }

  if (parts[1] !== 'donation_storage') {
    return {
      valid: false,
      token,
      message: '물품 보관용 QR이 아닙니다. 보관함 입고 QR을 다시 스캔해주세요.',
    };
  }

  const [, , memberId, donateId, issuedAt, expiresAt, nonce] = parts;
  if (!/^\d+$/.test(memberId) || !/^\d+$/.test(donateId) || !/^\d{10,}$/.test(issuedAt) || !/^\d{10,}$/.test(expiresAt) || !nonce) {
    return { valid: false, token, message: 'QR 토큰 형식이 올바르지 않습니다. 새 QR을 발급받아 다시 시도해주세요.' };
  }

  if (Number(expiresAt) <= now) {
    return { valid: false, token, message: '만료된 QR 코드입니다. 앱에서 새 QR을 발급받아주세요.' };
  }

  return {
    valid: true,
    token,
    message: '보관함 입고 QR 토큰을 정상적으로 인식했습니다. 서버에서 사용 가능 여부를 확인합니다.',
  };
}

export function maskLockerQrToken(token) {
  const value = String(token || '');
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}···${value.slice(-6)}`;
}

export function getLockerQrErrorMessage(error) {
  const status = error?.status;
  const original = String(error?.message || '');

  if (status === 400) return 'QR 토큰을 읽지 못했습니다. 앱에서 발급한 QR을 다시 스캔해주세요.';
  if (status === 403) return '보관함 인증 정보가 올바르지 않습니다. 관리자에게 문의해주세요.';
  if (status === 404) return '유효하지 않은 QR 코드입니다. 새 QR을 발급받아 다시 시도해주세요.';
  if (status === 409) {
    if (/purpose|보관용/i.test(original)) return '물품 보관용 QR이 아닙니다. 보관함 입고 QR을 스캔해주세요.';
    return '이미 사용했거나 만료된 QR 코드입니다. 앱에서 새 QR을 발급받아주세요.';
  }
  if (/failed to fetch|networkerror|network request failed/i.test(original)) {
    return '서버에 연결하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  }
  return 'QR 인증 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}
