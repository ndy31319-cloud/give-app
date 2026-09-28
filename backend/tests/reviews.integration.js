const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { getFirestore } = require('../lib/firebaseAdmin');
const reviews = require('../services/reviews');

test('completed-trade reviews and live reputation', async t => {
  const tag = `review_${crypto.randomBytes(4).toString('hex')}`;
  const members = [], donations = [], rooms = [];
  const app = express(); app.use(express.json());
  app.use('/api/chats', require('../routes/chat'));
  app.use('/api/members', require('../routes/members'));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    try {
      await new Promise(resolve => server.close(resolve));
      for (const room of rooms) await getFirestore().recursiveDelete(getFirestore().collection('chatRooms').doc(room));
      for (const id of donations) {
        await db.query('DELETE FROM REVIEW WHERE donate_id = ?', [id]);
        await db.query('DELETE FROM PICKUP_REQUEST WHERE donate_id = ?', [id]);
        await db.query('DELETE FROM ITEM_DONATE WHERE donate_id = ?', [id]);
      }
      for (const id of members) await db.query('DELETE FROM MEMBER WHERE member_id = ?', [id]);
    } finally { await db.end(); }
  });
  for (let index = 0; index < 3; index++) {
    const [result] = await db.query(`INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, nickname)
      VALUES (1, ?, ?, ?, ?, '테스트동', ?)`, [crypto.randomUUID(), tag, `${tag}_${index}@example.invalid`, `${tag.slice(-8)}-${index}`, `${tag.slice(-8)}_${index}`]);
    members.push(result.insertId);
  }
  const [donor, requester, outsider] = members;
  const [post] = await db.query("INSERT INTO ITEM_DONATE (member_id, title, content, status) VALUES (?, ?, 'fixture', 'reserved')", [donor, tag]);
  donations.push(post.insertId);
  for (const [index, member] of [requester, outsider].entries()) {
    const room = `${tag}_${index}`; rooms.push(room);
    await db.query(`INSERT INTO PICKUP_REQUEST (donate_id, requester_id, request_status, chat_room_id, requested_at)
      VALUES (?, ?, ?, ?, NOW())`, [post.insertId, member, index === 0 ? 'approved' : 'rejected', room]);
    await getFirestore().collection('chatRooms').doc(room).set({ participantIds: [donor, member], participants: [{ member_id: donor, nickname: 'donor' }, { member_id: member, nickname: 'requester' }] });
  }
  async function request(member, path, method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${jwt.sign({ member_id: member }, process.env.JWT_SECRET || 'give-local-development-secret')}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const path = `/api/chats/rooms/${rooms[0]}/review`;
  await t.test('auth and completed participation are required, including old rejected rooms', async () => {
    assert.equal((await fetch(base + path + '-status')).status, 401);
    assert.equal((await request(outsider, path + '-status')).status, 403);
    assert.equal((await request(requester, path, 'POST', { rating: 5, content: '후기' })).status, 409);
    assert.equal((await request(requester, path + '-status')).body.data.canReview, false);
    await db.query("UPDATE ITEM_DONATE SET status = 'completed' WHERE donate_id = ?", [post.insertId]);
    await db.query("UPDATE PICKUP_REQUEST SET request_status = 'completed' WHERE chat_room_id = ?", [rooms[0]]);
    assert.equal((await request(outsider, `/api/chats/rooms/${rooms[1]}/review`, 'POST', { rating: 5, content: '잘못된 후기' })).status, 409);
    assert.equal((await request(requester, path, 'POST', { rating: 6, content: '후기' })).status, 400);
    assert.equal((await request(requester, path, 'POST', { rating: 5, content: '가'.repeat(501) })).status, 400);
  });
  await t.test('concurrent duplicate sends create one review and ignore forged target IDs', async () => {
    const results = await Promise.all([1, 2].map(() => request(requester, path, 'POST', { rating: 5, content: '친절해요', targetMemberId: outsider, writerId: donor })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal(results.find(r => r.status === 201).body.data.targetMemberId, String(donor));
    const status = (await request(requester, path + '-status')).body.data;
    assert.equal(status.canReview, false); assert.equal(status.alreadyReviewed, true);
    const profile = (await request(requester, `/api/members/${donor}/reputation`)).body.data;
    assert.equal(profile.score, 37); assert.equal(profile.count, 1); assert.equal(profile.reviews[0].content, '친절해요');
  });
  await t.test('donor can review recipient; invalid historical reviews do not inflate scores', async () => {
    assert.equal((await request(donor, path + '-status')).body.data.targetMemberId, requester);
    assert.equal((await request(donor, path, 'POST', { rating: 2, content: '약속이 아쉬웠어요' })).status, 201);
    const profile = await reviews.profile(requester);
    assert.equal(profile.score, 36); assert.equal(profile.negative, 1);
    await db.query('INSERT INTO REVIEW (donate_id, writer_id, target_member_id, rating, content) VALUES (?, ?, ?, 5, ?)', [post.insertId, outsider, donor, '과거의 거래 외 후기']);
    assert.equal((await reviews.profile(donor)).count, 1);
    const data = (await request(requester, '/api/chats/rooms')).body.data;
    assert.equal(data.find(room => room.id === rooms[0]).participants.find(p => p.member_id === donor).temperature, 37);
    assert.equal((await reviews.profile(outsider)).score, 36.5);
    assert.equal(reviews.score(1000, 0), 100); assert.equal(reviews.score(0, 1000), 0);
  });
});
