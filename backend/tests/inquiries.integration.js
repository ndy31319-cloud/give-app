const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
test('inquiry ownership, admin role, durable replies and notifications', async t => {
  const members = []; const tag = `inq_${crypto.randomBytes(4).toString('hex')}`;
  const app = express(); app.use(express.json()); app.use('/api/inquiries', require('../routes/inquiries')); app.use('/api/notifications', require('../routes/notifications'));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    try {
      await new Promise(resolve => server.close(resolve));
      for (const id of members) { await db.query('DELETE FROM NOTIFICATION WHERE member_id = ?', [id]); await db.query('DELETE FROM ADMIN_INQUIRY WHERE member_id = ?', [id]); }
      for (const id of members) await db.query('DELETE FROM MEMBER WHERE member_id = ?', [id]);
    } finally { await db.end(); }
  });
  for (let index = 0; index < 3; index++) {
    const [r] = await db.query(`INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, nickname) VALUES (?, ?, ?, ?, ?, '테스트동', ?)`, [index === 0 ? 2 : 1, crypto.randomUUID(), tag, `${tag}_${index}@example.invalid`, `${tag.slice(-8)}-${index}`, `${tag.slice(-8)}_${index}`]); members.push(r.insertId);
  }
  const [admin, owner, other] = members;
  const request = async (member, path, method = 'GET', body) => {
    const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${jwt.sign({ member_id: member, role_id: 2 }, process.env.JWT_SECRET || 'give-local-development-secret')}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  let inquiryId;
  await t.test('authenticated creation, duplicate retries and member isolation', async () => {
    assert.equal((await fetch(base + '/api/inquiries')).status, 401);
    const body = { subject: '테스트 문의', message: '내용', category: 'trade', requestKey: tag, member_id: other, email: 'forged@example.invalid' };
    const [a, b] = await Promise.all([request(owner, '/api/inquiries', 'POST', body), request(owner, '/api/inquiries', 'POST', body)]);
    assert.equal(a.status, 201); assert.equal(b.status, 201); assert.equal(a.body.data.id, b.body.data.id); inquiryId = a.body.data.id;
    assert.equal(a.body.data.memberId, String(owner)); assert.notEqual(a.body.data.email, body.email);
    assert.equal((await request(other, `/api/inquiries/${inquiryId}`)).status, 404);
    assert.equal((await request(other, `/api/inquiries?member_id=${owner}`)).body.data.items.length, 0);
    assert.equal((await request(owner, '/api/inquiries?mode=admin')).status, 403);
    assert.equal((await request(owner, `/api/inquiries/${inquiryId}/reply`, 'POST', { answer: '권한 없음' })).status, 403);
    assert.equal((await request(owner, '/api/inquiries', 'POST', { subject: '', message: '내용' })).status, 400);
    assert.equal((await request(admin, '/api/inquiries?mode=admin&cursor=bad')).status, 400);
  });
  await t.test('one concurrent reply, persistent status and exact owner notification link', async () => {
    const replies = await Promise.all([1, 2].map(() => request(admin, `/api/inquiries/${inquiryId}/reply`, 'POST', { answer: '확인했습니다.' })));
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
    const detail = (await request(owner, `/api/inquiries/${inquiryId}`)).body.data;
    assert.equal(detail.status, 'answered'); assert.equal(detail.answer, '확인했습니다.'); assert.ok(detail.answeredAt);
    const feed = (await request(owner, '/api/notifications/feed')).body.data;
    assert.equal(feed.items.length, 1); assert.deepEqual(feed.items[0].target, { type: 'inquiry', inquiryId });
    assert.equal((await request(other, '/api/notifications/feed')).body.data.items.length, 0);
  });
  await t.test('admin pagination is oldest-first and DB role revocation overrides token claims', async () => {
    const ids = [];
    for (let i = 0; i < 31; i++) {
      const [r] = await db.query("INSERT INTO ADMIN_INQUIRY (member_id, subject, email, message, status) VALUES (?, ?, 'fixture@example.invalid', '내용', 'pending')", [owner, `${tag}_${i}`]); ids.push(String(r.insertId));
    }
    // The admin endpoint is global; inspect only this test owner's records via the service ordering query below.
    const page = (await request(owner, '/api/inquiries?status=pending')).body.data;
    assert.equal(page.items.length, 30); assert.equal(page.pendingCount, 31); assert.ok(page.nextCursor);
    const next = (await request(owner, `/api/inquiries?status=pending&cursor=${page.nextCursor}`)).body.data;
    assert.equal(next.items.length, 1); assert.equal(next.nextCursor, null);
    const result = await request(admin, `/api/inquiries?mode=admin&status=pending&cursor=${Number(ids[0]) - 1}`);
    assert.equal(result.status, 200); assert.equal(result.body.data.items[0].id, ids[0]);
    await db.query('UPDATE MEMBER SET role_id = 1 WHERE member_id = ?', [admin]);
    assert.equal((await request(admin, '/api/inquiries?mode=admin')).status, 403);
    assert.equal((await request(admin, `/api/inquiries/${ids[0]}/reply`, 'POST', { answer: '답변' })).status, 403);
  });
});
