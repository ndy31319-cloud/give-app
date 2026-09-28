const db = require('../db');
const { fail } = require('../lib/tradeState');
const categories = ['account', 'trade', 'error', 'other'];
const select = `SELECT i.*, m.nickname, UNIX_TIMESTAMP(i.created_at) AS created_seconds,
  UNIX_TIMESTAMP(i.answered_at) AS answered_seconds FROM ADMIN_INQUIRY i JOIN MEMBER m ON m.member_id = i.member_id`;
const map = row => ({ id: String(row.inquiry_id), memberId: String(row.member_id), nickname: row.nickname || '회원',
  category: row.category, subject: row.subject, email: row.email, message: row.message, status: row.status,
  answer: row.answer, createdAt: row.created_seconds ? new Date(Number(row.created_seconds) * 1000).toISOString() : null,
  answeredAt: row.answered_seconds ? new Date(Number(row.answered_seconds) * 1000).toISOString() : null });
async function member(id, connection = db, lock = false) {
  const [[row]] = await connection.query(`SELECT role_id, email FROM MEMBER WHERE member_id = ?${lock ? ' FOR SHARE' : ''}`, [id]);
  if (!row) fail(401, '로그인이 필요합니다.');
  return row;
}
async function detail(id, memberId) {
  const user = await member(memberId);
  const [[row]] = await db.query(`${select} WHERE i.inquiry_id = ? AND (? = 2 OR i.member_id = ?)`, [id, user.role_id, memberId]);
  if (!row) fail(404, '문의를 찾을 수 없습니다.');
  return map(row);
}
async function list(memberId, query) {
  const user = await member(memberId);
  const admin = query.mode === 'admin';
  if (admin && Number(user.role_id) !== 2) fail(403, '관리자만 문의를 관리할 수 있습니다.');
  const status = query.status || (admin ? 'pending' : 'all');
  if (!['pending', 'answered', 'all'].includes(status)) fail(400, '올바른 문의 상태가 필요합니다.');
  const cursor = query.cursor ? Number(query.cursor) : null;
  if (cursor !== null && (!Number.isSafeInteger(cursor) || cursor <= 0)) fail(400, '올바른 페이지 번호가 필요합니다.');
  const scope = admin ? '1=1' : 'i.member_id = ?';
  const params = admin ? [] : [memberId];
  const conditions = [scope];
  if (status !== 'all') { conditions.push('i.status = ?'); params.push(status); }
  const ascending = admin && status === 'pending';
  if (cursor) { conditions.push(`i.inquiry_id ${ascending ? '>' : '<'} ?`); params.push(cursor); }
  const [[rows], [[count]]] = await Promise.all([
    db.query(`${select} WHERE ${conditions.join(' AND ')} ORDER BY i.inquiry_id ${ascending ? 'ASC' : 'DESC'} LIMIT 31`, params),
    db.query(`SELECT COUNT(*) AS n FROM ADMIN_INQUIRY i WHERE ${scope} AND i.status = 'pending'`, admin ? [] : [memberId]),
  ]);
  return { items: rows.slice(0, 30).map(map), pendingCount: Number(count.n), nextCursor: rows.length > 30 ? String(rows[29].inquiry_id) : null };
}
async function create(memberId, input) {
  const user = await member(memberId);
  const subject = typeof input?.subject === 'string' ? input.subject.trim() : '';
  const message = typeof input?.message === 'string' ? input.message.trim() : '';
  const category = input?.category || 'other';
  const key = input?.requestKey || null;
  if (!subject || subject.length > 200 || !message || message.length > 5000 || !categories.includes(category)) fail(400, '제목은 1~200자, 내용은 1~5000자로 입력하고 문의 유형을 선택해주세요.');
  if (key !== null && (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(key))) fail(400, '올바른 요청 번호가 필요합니다.');
  let id;
  try {
    const [result] = await db.query(`INSERT INTO ADMIN_INQUIRY (member_id, subject, email, message, category, request_key, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`, [memberId, subject, user.email, message, category, key]);
    id = result.insertId;
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY' || !key) throw error;
    const [[existing]] = await db.query('SELECT inquiry_id FROM ADMIN_INQUIRY WHERE member_id = ? AND request_key = ?', [memberId, key]);
    if (!existing) throw error;
    id = existing.inquiry_id;
  }
  return detail(id, memberId);
}
async function reply(id, memberId, input) {
  const answer = typeof input?.answer === 'string' ? input.answer.trim() : '';
  if (!answer || answer.length > 5000) fail(400, '답변은 1~5000자로 입력해주세요.');
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const user = await member(memberId, connection, true);
    if (Number(user.role_id) !== 2) fail(403, '관리자만 답변할 수 있습니다.');
    const [[row]] = await connection.query('SELECT * FROM ADMIN_INQUIRY WHERE inquiry_id = ? FOR UPDATE', [id]);
    if (!row) fail(404, '문의를 찾을 수 없습니다.');
    if (row.status !== 'pending') fail(409, '이미 답변이 등록된 문의입니다. 최신 내용을 확인해주세요.');
    await connection.query("UPDATE ADMIN_INQUIRY SET answer = ?, answered_by = ?, answered_at = NOW(), status = 'answered' WHERE inquiry_id = ?", [answer, memberId, id]);
    await connection.query(`INSERT INTO NOTIFICATION (member_id, related_type, related_id, notification_type, message, is_read, created_at)
      VALUES (?, 'inquiry', ?, 'admin', ?, FALSE, NOW())`, [row.member_id, id, `‘${row.subject}’ 문의에 답변이 등록됐어요.`]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  return detail(id, memberId);
}
module.exports = { list, detail, create, reply };
