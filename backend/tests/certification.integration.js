const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const sharp = require('sharp');
const db = require('../db');

test('certificate scan, manual validation and transactional signup', async t => {
  const tag = `cert_${crypto.randomBytes(4).toString('hex')}`;
  const codes = [], emails = [];
  const app = express(); app.use(express.json());
  app.use('/api/certification', require('../routes/certification'));
  app.use('/api/members', require('../routes/members'));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    try {
      await new Promise(resolve => server.close(resolve));
      for (const id of codes) await db.query('DELETE FROM CERTIFICATION_CODE WHERE code_id = ?', [id]);
      for (const email of emails) await db.query('DELETE FROM MEMBER WHERE email = ?', [email]);
    } finally { await db.end(); }
  });
  for (let index = 0; index < 2; index++) {
    const [result] = await db.query('INSERT INTO CERTIFICATION_CODE (code, is_used) VALUES (?, FALSE)', [`${tag}_${index}`]);
    codes.push(result.insertId);
  }
  const json = async (path, body) => {
    const result = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: result.status, body: await result.json() };
  };
  const scan = async (buffer, type = 'image/png') => {
    const body = new FormData(); body.append('image', new Blob([buffer], { type }), 'certificate.png');
    const result = await fetch(base + '/api/certification/scan', { method: 'POST', body });
    return { status: result.status, body: await result.json() };
  };
  const signup = (index, code = String(codes[0])) => {
    const email = `${tag}_${index}@example.invalid`; emails.push(email);
    return { name: '인증테스트', nickname: `${tag}_${index}`, email,
      phone: `019${crypto.randomInt(10000000, 99999999)}`, member_pw: 'Test1234!', dong_name: '테스트동', isVulnerable: true, qr_code: code };
  };
  await t.test('photo and manual verification use the internal ID without consuming it', async () => {
    const result = await scan(await QRCode.toBuffer(String(codes[0]), { width: 400 }));
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.code, String(codes[0]));
    assert.equal((await json('/api/certification/verify', { code: ` 00${codes[0]} ` })).status, 200);
    assert.equal((await json('/api/certification/verify', { code: `${tag}_0` })).body.errorCode, 'CERT_INVALID');
    const [[row]] = await db.query('SELECT is_used, member_id FROM CERTIFICATION_CODE WHERE code_id = ?', [codes[0]]);
    assert.equal(row.is_used, 0); assert.equal(row.member_id, null);
  });
  await t.test('scan failures distinguish unreadable photos, invalid QR values and upload errors', async () => {
    const blank = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } }).png().toBuffer();
    assert.equal((await scan(blank)).body.errorCode, 'QR_NOT_FOUND');
    assert.equal((await scan(Buffer.from('bad picture'))).body.errorCode, 'QR_UNREADABLE');
    assert.equal((await scan(await QRCode.toBuffer('not-a-certificate'))).body.errorCode, 'CERT_INVALID');
    assert.equal((await scan(Buffer.from('bad file'), 'text/plain')).body.errorCode, 'IMAGE_UPLOAD');
    assert.equal((await scan(Buffer.alloc(10 * 1024 * 1024 + 1))).body.errorCode, 'IMAGE_UPLOAD');
  });
  await t.test('beneficiary signup cannot bypass validation; failed input leaves code usable', async () => {
    assert.equal((await json('/api/members/signup', signup(0, ''))).body.errorCode, 'CERT_INVALID');
    const payload = signup(1); payload.member_pw = 'short';
    assert.equal((await json('/api/members/signup', payload)).status, 400);
    assert.equal((await json('/api/certification/verify', { code: String(codes[0]) })).status, 200);
  });
  await t.test('concurrent signups create one beneficiary and show the used-certificate message', async () => {
    const results = await Promise.all([2, 3].map(index => json('/api/members/signup', signup(index))));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    const winner = results.find(r => r.status === 201).body.data;
    assert.equal(winner.user.role_id, 3);
    assert.equal(results.find(r => r.status === 409).body.message, '사용된 인증서입니다.');
    const [[row]] = await db.query('SELECT is_used, member_id, used_at FROM CERTIFICATION_CODE WHERE code_id = ?', [codes[0]]);
    assert.equal(row.is_used, 1); assert.equal(row.member_id, winner.user.member_id); assert.ok(row.used_at);
    assert.equal((await json('/api/certification/verify', { code: String(codes[0]) })).body.message, '사용된 인증서입니다.');
    assert.equal((await scan(await QRCode.toBuffer(String(codes[0])))).body.message, '사용된 인증서입니다.');
  });
  await t.test('a failure after member insertion rolls back both member and certificate', async () => {
    const originalGet = db.getConnection.bind(db);
    const mock = t.mock.method(db, 'getConnection', async () => {
      const connection = await originalGet();
      const query = connection.query.bind(connection);
      connection.query = (sql, params) => {
        if (sql.includes('UPDATE CERTIFICATION_CODE')) throw new Error('Injected update failure');
        return query(sql, params);
      };
      const release = connection.release.bind(connection);
      connection.release = () => { connection.query = query; release(); };
      return connection;
    });
    const payload = signup(4, String(codes[1]));
    try { assert.equal((await json('/api/members/signup', payload)).status, 500); }
    finally { mock.mock.restore(); }
    const [members] = await db.query('SELECT member_id FROM MEMBER WHERE email = ?', [payload.email]);
    assert.equal(members.length, 0);
    assert.equal((await json('/api/certification/verify', { code: String(codes[1]) })).status, 200);
  });
  await t.test('ordinary signup still works without a certificate', async () => {
    const payload = signup(5, ''); payload.isVulnerable = false;
    const result = await json('/api/members/signup', payload);
    assert.equal(result.status, 201); assert.equal(result.body.data.user.role_id, 1);
  });
});
