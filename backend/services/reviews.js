const db = require('../db');
const { fail } = require('../lib/tradeState');
// Only reviews between the actual completed trade's participants contribute.
const validReview = `EXISTS (SELECT 1 FROM PICKUP_REQUEST p JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
  WHERE p.donate_id = r.donate_id AND p.request_status IN ('completed','picked_up') AND d.status = 'completed'
  AND ((r.writer_id = p.requester_id AND r.target_member_id = d.member_id)
    OR (r.writer_id = d.member_id AND r.target_member_id = p.requester_id)))`;
const score = (positive, negative) => Math.max(0, Math.min(100, Math.round((36.5 + (positive - negative) * 0.5) * 10) / 10));
async function scores(ids) {
  const unique = [...new Set(ids.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
  const result = Object.fromEntries(unique.map(id => [id, { score: 36.5, count: 0, positive: 0, negative: 0, neutral: 0 }]));
  if (!unique.length) return result;
  const [rows] = await db.query(`SELECT r.target_member_id AS id, COUNT(*) AS count,
    SUM(r.rating >= 4) AS positive, SUM(r.rating <= 2) AS negative, SUM(r.rating = 3) AS neutral
    FROM REVIEW r WHERE r.target_member_id IN (${unique.map(() => '?').join(',')}) AND ${validReview} GROUP BY r.target_member_id`, unique);
  for (const row of rows) result[row.id] = { score: score(Number(row.positive), Number(row.negative)), count: Number(row.count), positive: Number(row.positive), negative: Number(row.negative), neutral: Number(row.neutral) };
  return result;
}
async function profile(memberId) {
  if (!Number.isSafeInteger(Number(memberId)) || Number(memberId) <= 0) fail(400, '올바른 회원 번호가 필요합니다.');
  const [[member]] = await db.query('SELECT member_id FROM MEMBER WHERE member_id = ?', [memberId]);
  if (!member) fail(404, '회원을 찾을 수 없습니다.');
  const totals = await scores([memberId]);
  const [rows] = await db.query(`SELECT r.review_id, r.rating, r.content, UNIX_TIMESTAMP(r.created_at) AS seconds
    FROM REVIEW r WHERE r.target_member_id = ? AND ${validReview} ORDER BY r.review_id DESC LIMIT 20`, [memberId]);
  return { ...totals[memberId], reviews: rows.map(r => ({ id: String(r.review_id), rating: r.rating, content: r.content, createdAt: new Date(Number(r.seconds) * 1000).toISOString() })) };
}
async function eligibility(roomId, memberId, connection = db) {
  const [[trade]] = await connection.query(`SELECT p.*, d.member_id AS donor_id, d.status AS post_status
    FROM PICKUP_REQUEST p JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
    WHERE p.chat_room_id = ? ORDER BY p.pickup_id DESC LIMIT 1`, [roomId]);
  if (!trade) return { canReview: false, alreadyReviewed: false, reason: '완료한 거래 기록이 연결되어 있지 않습니다.' };
  if (![trade.donor_id, trade.requester_id].some(id => Number(id) === Number(memberId))) fail(403, '실제 거래 당사자만 평가할 수 있습니다.');
  const target = Number(memberId) === Number(trade.donor_id) ? trade.requester_id : trade.donor_id;
  const [[existing]] = await connection.query('SELECT review_id FROM REVIEW WHERE donate_id = ? AND writer_id = ?', [trade.donate_id, memberId]);
  const completed = ['completed', 'picked_up'].includes(trade.request_status) && trade.post_status === 'completed';
  return { canReview: completed && !existing, alreadyReviewed: Boolean(existing), reason: existing ? '이미 후기를 작성했습니다.' : completed ? null : '나눔 완료 후 평가할 수 있습니다.', donateId: trade.donate_id, targetMemberId: target, writerId: Number(memberId), postStatus: trade.post_status };
}
async function create(roomId, memberId, input) {
  const rating = input?.rating;
  const content = typeof input?.content === 'string' ? input.content.trim() : '';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, '평점은 1~5점이어야 합니다.');
  if (!content || content.length > 500) fail(400, '후기는 1~500자로 입력해주세요.');
  const initial = await eligibility(roomId, memberId);
  if (!initial.canReview) fail(409, initial.reason);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT donate_id FROM ITEM_DONATE WHERE donate_id = ? FOR UPDATE', [initial.donateId]);
    const current = await eligibility(roomId, memberId, connection);
    if (!current.canReview) fail(409, current.reason);
    const [insert] = await connection.query(`INSERT INTO REVIEW (donate_id, writer_id, target_member_id, rating, content) VALUES (?, ?, ?, ?, ?)`, [current.donateId, memberId, current.targetMemberId, rating, content]);
    const [[saved]] = await connection.query('SELECT UNIX_TIMESTAMP(created_at) AS seconds FROM REVIEW WHERE review_id = ?', [insert.insertId]);
    await connection.commit();
    return { reviewId: String(insert.insertId), donateId: String(current.donateId), writerId: String(memberId), targetMemberId: String(current.targetMemberId), rating, content, createdAt: new Date(Number(saved.seconds) * 1000).toISOString() };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') fail(409, '이미 후기를 작성했습니다.');
    throw error;
  } finally { connection.release(); }
}
module.exports = { eligibility, create, profile, scores, score };
