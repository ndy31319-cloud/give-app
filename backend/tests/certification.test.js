const { test } = require('node:test');
const assert = require('node:assert/strict');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { decodeCertificate, verifyCertificate, normalizeCertificateId } = require('../services/certification');

test('QR on a photographed page decodes even with rotation and JPEG compression', async () => {
  const qr = await QRCode.toBuffer('12345', { width: 360, margin: 4 });
  const page = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#fff' } })
    .composite([{ input: qr, top: 1100, left: 650 }]).jpeg({ quality: 65 }).toBuffer();
  assert.equal(await decodeCertificate(page), '12345');
  assert.equal(await decodeCertificate(await sharp(page).rotate(90).toBuffer()), '12345');
});

test('absent QR and unreadable images have recognition errors, unlike decoded invalid content', async () => {
  const blank = await sharp({ create: { width: 240, height: 240, channels: 3, background: '#fff' } }).png().toBuffer();
  await assert.rejects(decodeCertificate(blank), { errorCode: 'QR_NOT_FOUND' });
  await assert.rejects(decodeCertificate(Buffer.from('not a picture')), { errorCode: 'QR_UNREADABLE' });
  const text = await decodeCertificate(await QRCode.toBuffer('not-a-certificate'));
  assert.throws(() => normalizeCertificateId(text), { errorCode: 'CERT_INVALID' });
});

test('manual input is a strictly validated internal code_id and never SQL or arbitrary objects', () => {
  assert.equal(normalizeCertificateId(' 000123 '), '123');
  for (const input of [undefined, null, {}, [], 0, -1, '1 OR 1=1', '12x', '1.5', '2147483648']) {
    assert.throws(() => normalizeCertificateId(input), { errorCode: 'CERT_INVALID' });
  }
});

test('validation uses code_id, distinguishes used codes, and never writes', async () => {
  let calls = 0;
  const database = { query: async (sql, params) => {
    calls++;
    assert.match(sql, /^SELECT .* WHERE code_id = \? FOR UPDATE$/);
    assert.deepEqual(params, ['123']);
    return [[{ code_id: 123, is_used: 0, member_id: null }]];
  } };
  assert.deepEqual(await verifyCertificate(database, '123', { lock: true }), { code: '123', codeId: 123 });
  assert.equal(calls, 1);
  for (const row of [{ code_id: 123, is_used: 1 }, { code_id: 123, is_used: 0, member_id: 7 }]) {
    await assert.rejects(verifyCertificate({ query: async () => [[row]] }, '123'), {
      errorCode: 'CERT_USED', statusCode: 409, message: '사용된 인증서입니다.',
    });
  }
  await assert.rejects(verifyCertificate({ query: async () => [[]] }, '123'), { errorCode: 'CERT_INVALID' });
});
