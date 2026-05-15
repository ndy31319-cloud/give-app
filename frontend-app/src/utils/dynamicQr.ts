import { DynamicQrPurpose, DynamicQrSession, DynamicQrStatus } from '@/src/types/app';

export function getRemainingSeconds(expiresAt?: string | null) {
  if (!expiresAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function getEffectiveQrStatus(session: DynamicQrSession | null): DynamicQrStatus {
  if (!session) {
    return 'expired';
  }

  if (session.status !== 'active') {
    return session.status;
  }

  return getRemainingSeconds(session.expiresAt) > 0 ? 'active' : 'expired';
}

export function getQrStatusLabel(status: DynamicQrStatus) {
  if (status === 'active') return '사용 가능';
  if (status === 'used') return '사용 완료';
  return '만료됨';
}

export function getQrPurposeLabel(purpose: DynamicQrPurpose) {
  if (purpose === 'pickup_access') {
    return '수령 인증';
  }

  return '기부함 인증';
}

function hashSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function buildFinderPattern(size: number, startX: number, startY: number, reserved: Set<string>) {
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      reserved.add(`${startX + col}:${startY + row}`);
    }
  }

  for (let index = -1; index <= 7; index += 1) {
    reserved.add(`${startX + index}:${startY - 1}`);
    reserved.add(`${startX + index}:${startY + 7}`);
    reserved.add(`${startX - 1}:${startY + index}`);
    reserved.add(`${startX + 7}:${startY + index}`);
  }

  reserved.add(`${Math.min(size - 1, startX + 7)}:${Math.min(size - 1, startY + 7)}`);
}

function isFinderDarkCell(x: number, y: number, startX: number, startY: number) {
  const localX = x - startX;
  const localY = y - startY;
  const isOuter = localX === 0 || localX === 6 || localY === 0 || localY === 6;
  const isInner = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
  return isOuter || isInner;
}

export function createPseudoQrMatrix(value: string, size = 25) {
  const normalizedSize = Math.max(21, size);
  const matrix = Array.from({ length: normalizedSize }, () =>
    Array.from({ length: normalizedSize }, () => false),
  );
  const reserved = new Set<string>();

  const finders = [
    [0, 0],
    [normalizedSize - 7, 0],
    [0, normalizedSize - 7],
  ];

  finders.forEach(([startX, startY]) => buildFinderPattern(normalizedSize, startX, startY, reserved));

  const seed = hashSeed(value || 'give-default-seed');

  for (let y = 0; y < normalizedSize; y += 1) {
    for (let x = 0; x < normalizedSize; x += 1) {
      const key = `${x}:${y}`;

      if (reserved.has(key)) {
        matrix[y][x] = finders.some(([finderX, finderY]) =>
          x >= finderX &&
          x < finderX + 7 &&
          y >= finderY &&
          y < finderY + 7 &&
          isFinderDarkCell(x, y, finderX, finderY),
        );
        continue;
      }

      const valueSeed = seed + x * 31 + y * 17 + x * y * 13;
      matrix[y][x] = ((valueSeed ^ (valueSeed >> 3) ^ (valueSeed << 1)) & 1) === 1;
    }
  }

  return matrix;
}
