export function formatTimeAgo(value: string) {
  const target = new Date(value).getTime();
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

export function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${`${date.getMonth() + 1}`.padStart(2, '0')}.${`${date.getDate()}`.padStart(2, '0')}`;
}
