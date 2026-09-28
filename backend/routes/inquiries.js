const router = require('express').Router();
const service = require('../services/inquiries');
router.use(require('../middlewares/authMiddleware'));
const handle = (fn, status = 200) => async (req, res) => {
  try {
    if (req.params.id && !/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ message: '올바른 문의 번호가 필요합니다.' });
    res.status(status).json({ success: true, data: await fn(req, req.user.member_id || req.user.id) });
  } catch (error) { res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : '문의 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' }); }
};
router.get('/', handle((req, member) => service.list(member, req.query)));
router.post('/', handle((req, member) => service.create(member, req.body), 201));
router.get('/:id', handle((req, member) => service.detail(req.params.id, member)));
router.post('/:id/reply', handle((req, member) => service.reply(req.params.id, member, req.body)));
module.exports = router;
