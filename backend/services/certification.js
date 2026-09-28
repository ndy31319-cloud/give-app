const sharp = require('sharp');
const jsQR = require('jsqr');

function certificationError(errorCode, message, statusCode = 400) {
  return Object.assign(new Error(message), { errorCode, statusCode });
}

function normalizeCertificateId(value) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!/^\d{1,10}$/.test(text) || Number(text) < 1 || Number(text) > 2147483647) {
    throw certificationError('CERT_INVALID', '등록된 인증 번호를 확인해주세요.');
  }
  return String(Number(text));
}

// QR payload and manual input both identify CERTIFICATION_CODE.code_id.
async function verifyCertificate(database, value, { lock = false } = {}) {
  const code = normalizeCertificateId(value);
  const [rows] = await database.query(
    `SELECT code_id, is_used, member_id FROM CERTIFICATION_CODE WHERE code_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [code],
  );
  if (!rows.length) throw certificationError('CERT_INVALID', '등록된 인증 번호를 확인해주세요.');
  if (Number(rows[0].is_used) || rows[0].member_id != null) {
    throw certificationError('CERT_USED', '사용된 인증서입니다.', 409);
  }
  return { code, codeId: rows[0].code_id };
}

async function decodeCertificate(buffer) {
  let pixels;
  try {
    pixels = await sharp(buffer, { limitInputPixels: 30000000 })
      .rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).toColourspace('srgb').ensureAlpha()
      .raw().toBuffer({ resolveWithObject: true });
  } catch {
    throw certificationError('QR_UNREADABLE', '사진을 읽지 못했습니다. 인증서의 QR이 선명하게 보이도록 다시 촬영해주세요.', 422);
  }
  const qr = jsQR(new Uint8ClampedArray(pixels.data), pixels.info.width, pixels.info.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (!qr) throw certificationError('QR_NOT_FOUND', 'QR을 찾지 못했습니다. QR 부분을 가까이에서 다시 촬영해주세요.', 422);
  return qr.data;
}

module.exports = { certificationError, normalizeCertificateId, verifyCertificate, decodeCertificate };
