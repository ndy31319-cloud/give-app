const db = require('../db');
const titles = {
  chat: '새 채팅', request: '새 요청', pickup_request: '나눔 요청이 도착했어요',
  pickup_approved: '예약이 확정됐어요', pickup_rejected: '요청이 거절됐어요',
  pickup_canceled: '거래가 취소됐어요', pickup_expired: '요청 시간이 만료됐어요',
  pickup_completed: '나눔이 완료됐어요', admin: '운영 안내',
};
async function feed(memberId, query) {
  const before = query.before ? Number(query.before) : null;
  if (before !== null && (!Number.isSafeInteger(before) || before <= 0)) {
    throw Object.assign(new Error('올바른 알림 번호가 필요합니다.'), { statusCode: 400 });
  }
  const params = [memberId];
  const conditions = ['n.member_id = ?'];
  if (before) { conditions.push('n.notification_id < ?'); params.push(before); }
  if (query.unread === '1') conditions.push('n.is_read = FALSE');
  const [[rows], [[count]]] = await Promise.all([
    db.query(`SELECT n.*, UNIX_TIMESTAMP(n.created_at) AS created_seconds,
      p.chat_room_id, p.requester_id, d.member_id AS donor_id,
      d.donate_id AS existing_donate_id, r.request_id AS existing_request_id, i.inquiry_id
      FROM NOTIFICATION n
      LEFT JOIN PICKUP_REQUEST p ON n.related_type = 'pickup' AND p.pickup_id = n.related_id
      LEFT JOIN ITEM_DONATE d ON d.donate_id = CASE WHEN n.related_type = 'donate' THEN n.related_id ELSE p.donate_id END
      LEFT JOIN ITEM_REQUEST r ON n.related_type = 'request' AND r.request_id = n.related_id
      LEFT JOIN ADMIN_INQUIRY i ON n.related_type = 'inquiry' AND i.inquiry_id = n.related_id AND i.member_id = n.member_id
      WHERE ${conditions.join(' AND ')} ORDER BY n.notification_id DESC LIMIT 31`, params),
    db.query('SELECT COUNT(*) AS count FROM NOTIFICATION WHERE member_id = ? AND is_read = FALSE', [memberId]),
  ]);
  const page = rows.slice(0, 30);
  return {
    items: page.map(row => {
      const participant = [row.requester_id, row.donor_id].some(id => Number(id) === Number(memberId));
      const target = row.inquiry_id ? { type: 'inquiry', inquiryId: String(row.inquiry_id) } : row.chat_room_id && participant ? { type: 'chat', roomId: row.chat_room_id }
        : row.existing_donate_id ? { type: 'post', postId: `donate_${row.existing_donate_id}` }
        : row.existing_request_id ? { type: 'post', postId: `request_${row.existing_request_id}` } : null;
      return {
        id: String(row.notification_id), type: row.notification_type === 'chat' ? 'chat' : row.notification_type.startsWith('pickup_') ? 'share' : 'system',
        notificationTypeCode: row.notification_type, relatedType: row.related_type, relatedId: String(row.related_id),
        title: row.related_type === 'inquiry' ? '문의 답변이 도착했어요' : row.related_type === 'pickup' && row.notification_type === 'request' ? '만남 약속 소식' : titles[row.notification_type] || '새 알림', message: row.message,
        createdAt: new Date(Number(row.created_seconds) * 1000).toISOString(), isRead: Boolean(row.is_read), target,
      };
    }),
    unreadCount: Number(count.count), nextCursor: rows.length > 30 ? String(page[page.length - 1].notification_id) : null,
  };
}
module.exports = { feed };
