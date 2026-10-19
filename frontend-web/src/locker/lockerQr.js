const QR_TOKEN_PART_COUNT = 7;
const LOCKER_DISPLAY_CODE_PATTERN = /^WF-\d{4}-[A-Z0-9]{4}$/;
const LOCKER_SECRET_TOKEN_PATTERN = /^gq_[A-Za-z0-9_-]{24,}$/;

function normalizeLockerDisplayCode(value) {
  const input = String(value || '').trim();
  const upperInput = input.toUpperCase();
  const compactInput = upperInput.replace(/[^A-Z0-9]/g, '');

  if (LOCKER_DISPLAY_CODE_PATTERN.test(upperInput)) {
    return upperInput;
  }

  const codeBody = compactInput.startsWith('WF') ? compactInput.slice(2) : compactInput;

  if (codeBody.length === 8) {
    return `WF-${codeBody.slice(0, 4)}-${codeBody.slice(4, 8)}`;
  }

  if (!compactInput.startsWith('WF') && /^[A-Z0-9]{4}$/.test(codeBody)) {
    return `WF-${new Date().getFullYear()}-${codeBody}`;
  }

  return input;
}

function extractCredential(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  const secretToken = input.match(/gq_[A-Za-z0-9_-]{8,}/)?.[0];
  if (secretToken) return secretToken;

  const embeddedDisplayCode = input.match(/(?:^|[^A-Z0-9])WF[\s_-]?(\d{4})[\s_-]?([A-Z0-9]{4})(?![A-Z0-9])/i);
  if (embeddedDisplayCode) {
    return `WF-${embeddedDisplayCode[1]}-${embeddedDisplayCode[2].toUpperCase()}`;
  }

  return normalizeLockerDisplayCode(input);
}

function extractToken(rawPayload) {
  const raw = String(rawPayload || '').trim();
  if (!raw) return '';

  try {
    const json = JSON.parse(raw);
    if (typeof json?.token === 'string') return extractCredential(json.token);
    if (typeof json?.qrToken === 'string') return extractCredential(json.qrToken);
    if (typeof json?.displayCode === 'string') return extractCredential(json.displayCode);
    if (typeof json?.display_code === 'string') return extractCredential(json.display_code);
  } catch {
    // QR은 일반적으로 원문 토큰이므로 JSON이 아니어도 정상입니다.
  }

  try {
    const url = new URL(raw);
    const credential =
      url.searchParams.get('token') ||
      url.searchParams.get('qrToken') ||
      url.searchParams.get('displayCode') ||
      url.searchParams.get('display_code');
    if (credential) return extractCredential(credential);
  } catch {
    // The scanner may provide a regular token instead of a URL.
  }

  return extractCredential(raw);
}

export function inspectLockerQrPayload(rawPayload, now = Date.now()) {
  const token = extractToken(rawPayload);
  if (!token) {
    return { valid: false, token: '', message: 'QR 값을 읽지 못했습니다. 다시 비춰주세요.' };
  }

  if (LOCKER_DISPLAY_CODE_PATTERN.test(token)) {
    return {
      valid: true,
      token,
      message: '보관함 입고 QR 인증번호를 정상적으로 인식했습니다. 서버에서 사용 가능 여부를 확인합니다.',
    };
  }

  if (LOCKER_SECRET_TOKEN_PATTERN.test(token)) {
    return {
      valid: true,
      token,
      message: '보관함 입고 QR 비밀 토큰을 정상적으로 인식했습니다. 서버에서 사용 가능 여부를 확인합니다.',
    };
  }

  const parts = token.split('|');
  if (parts.length !== QR_TOKEN_PART_COUNT || parts[0] !== 'give') {
    return {
      // Format checks in the browser are only a convenience. The backend owns
      // validity because scanners can wrap a real token in vendor-specific data.
      valid: true,
      token,
      message: 'QR 값을 읽었습니다. 서버에서 보관함 입고용 QR인지 확인합니다.',
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
  if (error?.code === 'INVALID_JSON_RESPONSE') {
    return 'API 주소가 백엔드가 아닌 화면 서버를 보고 있습니다. 키오스크 API 주소 설정을 확인해주세요.';
  }
  return 'QR 인증 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}
