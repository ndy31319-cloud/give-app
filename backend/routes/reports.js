const router = require('express').Router();
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  const memberId = req.user.member_id || req.user.id;
  const targetType = String(req.body?.targetType || req.body?.target_type || '').trim();
  const targetId = String(req.body?.targetId || req.body?.target_id || '').trim();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  if (!['chat_room', 'post', 'comment', 'member'].includes(targetType)) {
    return res.status(400).json({ message: '신고 대상을 확인해주세요.' });
  }
  if (!targetId || targetId.length > 100) {
    return res.status(400).json({ message: '신고 대상 번호를 확인해주세요.' });
  }
  if (!reason || reason.length > 2000) {
    return res.status(400).json({ message: '신고 사유를 1~2000자로 입력해주세요.' });
  }

  try {
    const [[member]] = await db.query('SELECT email FROM MEMBER WHERE member_id = ?', [memberId]);
    if (!member) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const subject = `${targetType === 'chat_room' ? '채팅방' : '서비스'} 신고 접수 (${targetId})`;
    const message = `신고 대상: ${targetType}/${targetId}\n\n신고 사유:\n${reason}`;
    const requestKey = `report_${memberId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const [result] = await db.query(
      `INSERT INTO ADMIN_INQUIRY
       (member_id, subject, email, message, category, request_key, status, created_at)
       VALUES (?, ?, ?, ?, 'other', ?, 'pending', NOW())`,
      [memberId, subject, member.email, message, requestKey],
    );

    return res.status(201).json({
      success: true,
      data: {
        reportId: `report_${result.insertId}`,
        reporterId: String(memberId),
        targetType,
        targetId,
        reason,
        status: 'received',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('신고 저장 오류:', error);
    return res.status(500).json({ message: '신고 접수에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

module.exports = router;
