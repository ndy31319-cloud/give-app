const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');
const locker = require('../services/locker');
const { ensureMemberQr, isMemberQrToken } = require('../services/memberQr');

const router = express.Router();

router.get('/me', authenticateToken, async (req, res) => {
  const memberId = req.user.member_id || req.user.id;
  try {
    await ensureMemberQr(db, memberId);
    const [rows] = await db.query(
      `SELECT m.member_id, m.nickname, m.role_id, q.token, q.issued_at
       FROM MEMBER_QR q
       JOIN MEMBER m ON m.member_id = q.member_id
       WHERE q.member_id = ? LIMIT 1`,
      [memberId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '발급된 회원 QR이 없습니다.' });
    }
    const member = rows[0];
    const imageDataUrl = await QRCode.toDataURL(member.token, {
      errorCorrectionLevel: 'M', margin: 4, width: 512,
    });
    const access = await locker.memberAccess(memberId);
    return res.json({
      success: true,
      data: {
        memberId: member.member_id,
        nickname: member.nickname,
        roleId: member.role_id,
        token: member.token,
        imageDataUrl,
        issuedAt: member.issued_at,
        access,
      },
    });
  } catch (error) {
    console.error('Load static member QR failed:', error);
    return res.status(500).json({ success: false, message: '회원 QR을 불러오지 못했습니다.' });
  }
});

// 회원 식별 테스트 전용. 보관함 잠금 해제나 거래 상태 변경은 하지 않습니다.
router.post('/validate', async (req, res) => {
  const expectedKey = process.env.KIOSK_API_KEY;
  if (!expectedKey) {
    return res.status(503).json({ success: false, errorCode: 'KIOSK_NOT_CONFIGURED', message: '키오스크 인증키가 설정되지 않았습니다.' });
  }
  if (expectedKey && req.headers['x-kiosk-key'] !== expectedKey) {
    return res.status(403).json({ success: false, errorCode: 'KIOSK_UNAUTHORIZED', message: '키오스크 인증 정보가 올바르지 않습니다.' });
  }
  const token = String(req.body.token || '').trim();
  if (!token) {
    return res.status(400).json({ success: false, errorCode: 'QR_EMPTY', message: 'QR을 인식하지 못했습니다. 다시 비춰주세요.' });
  }
  if (!isMemberQrToken(token)) {
    return res.status(400).json({ success: false, errorCode: 'QR_INVALID', message: '유효하지 않은 QR코드입니다.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT m.member_id, m.nickname, m.role_id
       FROM MEMBER_QR q
       JOIN MEMBER m ON m.member_id = q.member_id
       WHERE q.token = ? LIMIT 1`,
      [token],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, errorCode: 'QR_UNREGISTERED', message: '등록되지 않은 회원 QR입니다.' });
    }
    return res.json({
      success: true,
      data: {
        memberId: rows[0].member_id,
        nickname: rows[0].nickname,
        roleId: rows[0].role_id,
      },
    });
  } catch (error) {
    console.error('Validate static member QR failed:', error);
    return res.status(500).json({ success: false, errorCode: 'QR_VERIFY_FAILED', message: '회원 QR 확인에 실패했습니다.' });
  }
});

module.exports = router;
