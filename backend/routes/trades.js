const express = require('express');
const authenticateToken = require('../middlewares/authMiddleware');
const trades = require('../services/trades');
const router = express.Router();
router.use(authenticateToken);
const handle = fn => async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ message: '올바른 번호가 필요합니다.' });
    res.json({ success: true, data: await fn(req, req.user.member_id || req.user.id) });
  } catch (error) {
    console.error('Trade request:', error.message);
    res.status(error.statusCode || 503).json({ message: error.statusCode ? error.message : '요청 처리 또는 채팅 연결이 지연되고 있습니다. 잠시 후 다시 눌러주세요. 기존 요청은 중복 생성되지 않습니다.' });
  }
};
router.post('/posts/:id', handle((req, memberId) => trades.create(req.params.id, memberId)));
router.get('/:id', handle((req, memberId) => trades.get(req.params.id, memberId)));
router.put('/:id/appointment', handle((req, memberId) => trades.appointment(req.params.id, 'propose', req.body, memberId)));
router.post('/:id/appointment/confirm', handle((req, memberId) => trades.appointment(req.params.id, 'confirm', req.body, memberId)));
router.post('/:id/:action', handle((req, memberId) => trades.act(req.params.id, req.params.action, memberId)));
module.exports = router;
