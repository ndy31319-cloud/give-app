const express = require('express');
const authenticateToken = require('../middlewares/authMiddleware');
const locker = require('../services/locker');
const { isProductionRuntime, matchesApiKey, normalizeApiKey } = require('../lib/env');

const router = express.Router();

function handle(work) {
  return async (req, res) => {
    try {
      return res.json({ success: true, data: await work(req) });
    } catch (error) {
      console.error('Locker request:', error.message);
      return res.status(error.statusCode || 500).json({
        success: false,
        errorCode: error.errorCode || undefined,
        message: error.statusCode ? error.message : '보관함 요청을 처리하지 못했습니다.',
      });
    }
  };
}

function deviceAuth(req, res, next) {
  // DEVICE_API_KEY is the legacy name. Render and the Raspberry Pi use
  // LOCKER_DEVICE_API_KEY, so accept both during the migration.
  const expected = normalizeApiKey(
    process.env.LOCKER_DEVICE_API_KEY || process.env.DEVICE_API_KEY,
  );
  const supplied = req.get('X-Device-Key') || '';
  if (!expected) {
    return res.status(isProductionRuntime() ? 503 : 401).json({
      success: false,
      code: 'LOCKER_DEVICE_AUTH_NOT_CONFIGURED',
      message: '기기 인증키가 설정되지 않았습니다.',
    });
  }
  if (!matchesApiKey(expected, supplied)) {
    return res.status(403).json({ success: false, message: '기기 인증 정보가 올바르지 않습니다.' });
  }
  return next();
}

router.get('/eligible', authenticateToken, handle((req) =>
  locker.eligible(req.user.member_id || req.user.id)));
router.get('/me/access', authenticateToken, handle((req) =>
  locker.memberAccess(req.user.member_id || req.user.id)));
router.post('/select/:pickupId', authenticateToken, handle((req) =>
  locker.select(req.user.member_id || req.user.id, req.params.pickupId)));

router.post('/device/scan', deviceAuth, handle((req) =>
  locker.scan(req.body.token, req.body.action)));
router.post('/device/confirm', deviceAuth, handle((req) =>
  locker.confirm(req.body.transferId, req.body.action)));
router.get('/device/transfers/:transferId', deviceAuth, handle((req) =>
  locker.status(req.params.transferId)));

module.exports = { router, deviceAuth, handle };
