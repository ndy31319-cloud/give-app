const express = require('express');
const locker = require('../services/locker');
const { deviceAuth, handle } = require('./locker');

const router = express.Router();
router.use(deviceAuth);

// Existing Raspberry Pi branch uses these paths for donor deposit.
router.post('/qr/validate', handle(async (req) => {
  const transfer = await locker.scan(req.body.token, 'deposit');
  return { purpose: 'deposit', memberId: transfer.donorId,
    transferId: transfer.transferId, title: transfer.title };
}));
router.post('/qr/consume', handle((req) =>
  locker.confirmByToken(req.body.token, 'deposit')));
router.post('/status', handle((req) => locker.recordDeviceStatus(req.body)));

module.exports = router;
