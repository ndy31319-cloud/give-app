const express = require('express');
const authenticateToken = require('../middlewares/authMiddleware');
const reviews = require('../services/reviews');

const router = express.Router();
router.use(authenticateToken);

const memberIdOf = req => Number(req.user.member_id || req.user.id);
const donateIdOf = req => Number(req.params.donateId);

router.get('/donations/:donateId/status', async (req, res) => {
  try {
    res.json({ success: true, data: await reviews.eligibilityByDonate(donateIdOf(req), memberIdOf(req)) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : '후기 정보를 불러오지 못했습니다.' });
  }
});

router.post('/donations/:donateId', async (req, res) => {
  try {
    res.status(201).json({ success: true, data: await reviews.createByDonate(donateIdOf(req), memberIdOf(req), req.body) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : '후기를 저장하지 못했습니다. 다시 시도해주세요.' });
  }
});

module.exports = router;
