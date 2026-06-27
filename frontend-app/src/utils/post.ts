import { PostStatus } from '@/src/types/app';

export function getPostStatusLabel(status: PostStatus) {
  switch (status) {
    case 'open':
      return '나눔 가능';
    case 'reserved':
      return '예약중';
    case 'storage_requested':
      return '';
    case 'stored':
      return '';
    case 'pickup_pending':
      return '수령 대기';
    case 'completed':
      return '나눔 완료';
    case 'canceled':
      return '취소';
    case 'hidden':
      return '숨김';
    default:
      return status;
  }
}

export function isOpenPostStatus(status: PostStatus) {
  return status === 'open';
}
