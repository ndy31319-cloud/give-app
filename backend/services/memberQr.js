const crypto = require('crypto');

const MEMBER_QR_PATTERN = /^give-member-v1:[A-Za-z0-9_-]{43}$/;

function isMemberQrToken(token) {
  return typeof token === 'string' && MEMBER_QR_PATTERN.test(token);
}

async function ensureMemberQr(connection, memberId) {
  const token = `give-member-v1:${crypto.randomBytes(32).toString('base64url')}`;
  await connection.query(
    'INSERT IGNORE INTO MEMBER_QR (member_id, token) VALUES (?, ?)',
    [memberId, token],
  );
  const [rows] = await connection.query(
    'SELECT token FROM MEMBER_QR WHERE member_id = ? LIMIT 1', [memberId],
  );
  if (!rows.length) throw new Error('회원 QR 발급에 실패했습니다.');
  return rows[0].token;
}

module.exports = { ensureMemberQr, isMemberQrToken };
