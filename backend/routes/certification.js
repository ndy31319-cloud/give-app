const express = require('express');
const multer = require('multer');
const db = require('../db');
const { certificationError, decodeCertificate, verifyCertificate } = require('../services/certification');

const router = express.Router();
// Certificate photos stay in memory; never publish them through /uploads.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, callback) => {
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    callback(supported.includes(file.mimetype) ? null : certificationError('IMAGE_TYPE', '사진 파일을 선택해주세요.'), true);
  },
}).single('image');

function fail(res, error) {
  return res.status(error.statusCode || 500).json({
    success: false,
    errorCode: error.errorCode || 'CERT_SERVER_ERROR',
    message: error.statusCode ? error.message : '인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.',
  });
}

// These endpoints must be available before login. Verification does not consume a code.
router.post('/verify', async (req, res) => {
  try {
    const { code } = await verifyCertificate(db, req.body?.code);
    res.json({ success: true, data: { code }, message: '인증서가 확인되었습니다.' });
  } catch (error) { fail(res, error); }
});

let activeScans = 0;
router.post('/scan', (req, res) => {
  if (activeScans >= 2) return fail(res, certificationError('SCAN_BUSY', '인증 요청이 많습니다. 잠시 후 다시 시도해주세요.', 503));
  activeScans += 1;
  let released = false;
  const release = () => { if (!released) { released = true; activeScans -= 1; } };
  req.once('aborted', release);
  upload(req, res, async (uploadError) => {
    try {
      if (uploadError) throw certificationError('IMAGE_UPLOAD', uploadError.code === 'LIMIT_FILE_SIZE'
        ? '10MB 이하의 사진을 첨부해주세요.' : '사진 한 장을 첨부해주세요.', 400);
      if (!req.file) throw certificationError('IMAGE_REQUIRED', '인증서 사진을 첨부해주세요.');
      const decoded = await decodeCertificate(req.file.buffer);
      const { code } = await verifyCertificate(db, decoded);
      res.json({ success: true, data: { code }, message: '인증서가 확인되었습니다.' });
    } catch (error) { if (!res.destroyed) fail(res, error); }
    finally {
      if (req.file) req.file.buffer = null;
      req.off('aborted', release);
      release();
    }
  });
});

module.exports = router;
