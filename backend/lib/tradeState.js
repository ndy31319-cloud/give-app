const activeStatuses = new Set(['pending', 'approved']);
const statusLabels = {
  pending: '수락 대기', approved: '예약 확정', rejected: '거절됨',
  canceled: '취소됨', expired: '응답 시간 만료', completed: '나눔 완료',
};

function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

function validateCancelReason(value) {
  if (typeof value !== 'string' || !value.trim()) fail(400, '거래 취소 사유를 입력해주세요.');
  const reason = value.trim();
  if (reason.length > 200) fail(400, '취소 사유는 200자 이내로 입력해주세요.');
  return reason;
}

function nextStatus(trade, action, memberId) {
  const isDonor = Number(trade.donor_id) === Number(memberId);
  const isRequester = Number(trade.requester_id) === Number(memberId);
  if (!isDonor && !isRequester) fail(403, '거래 당사자만 처리할 수 있습니다.');
  if (['approve', 'reject', 'complete'].includes(action) && !isDonor) {
    fail(403, '게시글 작성자만 처리할 수 있습니다.');
  }
  const allowed = {
    approve: ['pending', 'approved'], reject: ['pending', 'rejected'],
    cancel: ['pending', 'approved', 'canceled'], complete: ['approved', 'completed'],
  };
  const target = { approve: 'approved', reject: 'rejected', cancel: 'canceled', complete: 'completed' }[action];
  if (!target) fail(400, '지원하지 않는 거래 처리입니다.');
  if (!allowed[action].includes(trade.request_status)) fail(409, '이미 처리되었거나 만료된 요청입니다.');
  return target;
}

module.exports = { activeStatuses, statusLabels, nextStatus, validateCancelReason, fail };
