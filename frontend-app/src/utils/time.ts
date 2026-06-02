type FirestoreLikeTimestamp = {
  seconds?: number;
  _seconds?: number;
  nanoseconds?: number;
  _nanoseconds?: number;
  toDate?: () => Date;
};

export function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object') {
    const timestamp = value as FirestoreLikeTimestamp;
    if (typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000);
    }
  }

  return null;
}

export function formatTimeAgo(value: unknown) {
  const target = toDate(value)?.getTime() ?? Date.now();
  const diff = Date.now() - target;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))}분 전`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)}시간 전`;
  }
  return `${Math.floor(diff / day)}일 전`;
}

export function formatDate(value: unknown) {
  const date = toDate(value) ?? new Date();
  return `${date.getFullYear()}.${`${date.getMonth() + 1}`.padStart(2, '0')}.${`${date.getDate()}`.padStart(2, '0')}`;
}
