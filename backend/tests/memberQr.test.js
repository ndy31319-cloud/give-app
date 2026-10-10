const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const QRCode = require('qrcode');
const sharp = require('sharp');
const jsQR = require('jsqr');
const { isMemberQrToken } = require('../services/memberQr');

async function decode(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data;
}

test('member QR image decodes to the exact issued token', async () => {
  const token = `give-member-v1:${crypto.randomBytes(32).toString('base64url')}`;
  assert.equal(isMemberQrToken(token), true);
  const png = await QRCode.toBuffer(token, { width: 512, margin: 4, errorCorrectionLevel: 'M' });
  assert.equal(await decode(png), token);
  const rotatedPhoto = await sharp(png).rotate(90).jpeg({ quality: 75 }).toBuffer();
  assert.equal(await decode(rotatedPhoto), token);
});

test('malformed or unrelated QR payloads cannot be member tokens', () => {
  for (const value of ['', 'WF-2026-0001', 'give-member-v1:short',
    'give-member-v1:' + '!'.repeat(43), null, {}, 123]) {
    assert.equal(isMemberQrToken(value), false);
  }
});
