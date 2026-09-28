// Dedicated SQL fixtures only. No existing users or posts are queried as test subjects.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const mypage = require('../routes/mypage');

test('activity API separates own posts, sent and received requests', async t => {
  const tag = `activity_${crypto.randomBytes(4).toString('hex')}`;
  const members = [], donations = [], wanted = [];
  const requests = {};
  const app = express();
  app.use('/api/mypage', mypage);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api/mypage/activity`;
  t.after(async () => {
    try {
      await new Promise(resolve => server.close(resolve));
      for (const id of donations) {
        await db.query('DELETE FROM PICKUP_REQUEST WHERE donate_id = ?', [id]);
        await db.query('DELETE FROM ITEM_DONATE WHERE donate_id = ?', [id]);
      }
      for (const id of wanted) await db.query('DELETE FROM ITEM_REQUEST WHERE request_id = ?', [id]);
      for (const id of members) {
        await db.query('DELETE FROM NOTIFICATION WHERE member_id = ?', [id]);
        await db.query('DELETE FROM MEMBER WHERE member_id = ?', [id]);
      }
    } finally { await db.end(); }
  });
  for (let index = 0; index < 3; index++) {
    const [result] = await db.query(`INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, nickname)
      VALUES (1, ?, ?, ?, ?, '테스트동', ?)`, [crypto.randomUUID(), tag, `${tag}_${index}@example.invalid`, `${tag.slice(-8)}-${index}`, `${tag.slice(-8)}_${index}`]);
    members.push(result.insertId);
  }
  const [donor, requester, outsider] = members;
  for (const state of ['pending', 'approved', 'completed', 'rejected', 'canceled', 'expired', 'picked_up', 'overdue']) {
    const [post] = await db.query("INSERT INTO ITEM_DONATE (member_id, title, content, status) VALUES (?, ?, 'integration fixture', ?)",
      [donor, `${tag}_${state}`, ['completed', 'picked_up'].includes(state) ? 'completed' : ['pending', 'approved', 'overdue'].includes(state) ? 'reserved' : 'open']);
    donations.push(post.insertId);
    const [request] = await db.query(`INSERT INTO PICKUP_REQUEST
      (requester_id, donate_id, request_status, chat_room_id, requested_at, expires_at)
      VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [requester, post.insertId, state === 'overdue' ? 'pending' : state,
      state === 'picked_up' ? null : `${tag}_${state}`, state === 'overdue' ? -1 : 24]);
    requests[state] = request.insertId;
  }
  const [requestPost] = await db.query("INSERT INTO ITEM_REQUEST (member_id, title, content, status) VALUES (?, ?, 'fixture', 'open')", [requester, `${tag}_wanted`]);
  wanted.push(requestPost.insertId);
  const get = async (memberId, query = '') => {
    const response = await fetch(base + query, { headers: { Authorization: `Bearer ${jwt.sign({ member_id: memberId }, process.env.JWT_SECRET || 'give-local-development-secret')}` } });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body.data;
  };
  await t.test('authentication and ownership filters cannot be overridden by query parameters', async () => {
    assert.equal((await fetch(base)).status, 401);
    const empty = await get(outsider, `?memberId=${donor}&member_id=${requester}`);
    assert.deepEqual(empty.counts, { shares: 0, requests: 0, received: 0, wanted: 0 });
    assert.deepEqual(empty.sentRequests, []);
    assert.deepEqual(empty.receivedRequests, []);
  });
  await t.test('donor sees own posts and received requests, not sent requests', async () => {
    const data = await get(donor);
    assert.equal(data.donatedPosts.length, 8);
    assert.equal(data.receivedRequests.length, 8);
    assert.equal(data.sentRequests.length, 0);
    assert.equal(data.requestedPosts.length, 0);
    assert.ok(data.receivedRequests.every(row => row.donorId === String(donor) && row.requesterId === String(requester)));
    assert.ok(data.donatedPosts.every(row => row.image === null && row.id.startsWith('donate_')));
  });
  await t.test('requester gets actual sent count separate from wanted posts and existing room IDs', async () => {
    const data = await get(requester);
    assert.equal(data.counts.requests, 8);
    assert.equal(data.counts.wanted, 1);
    assert.equal(data.requestedPosts[0].id, `request_${wanted[0]}`);
    assert.equal(data.receivedRequests.length, 0);
    for (const state of ['pending', 'approved', 'completed', 'rejected', 'canceled', 'expired']) {
      const row = data.sentRequests.find(row => row.id === String(requests[state]));
      assert.equal(row.status, state);
      assert.equal(row.roomId, `${tag}_${state}`);
    }
    const legacy = data.sentRequests.find(row => row.id === String(requests.picked_up));
    assert.equal(legacy.status, 'completed');
    assert.equal(legacy.roomId, null);
  });
  await t.test('expired pending request becomes expired and post reopens on list refresh', async () => {
    const data = await get(requester);
    const overdue = data.sentRequests.find(row => row.id === String(requests.overdue));
    assert.equal(overdue.status, 'expired');
    assert.equal(overdue.postStatus, 'open');
    const [[row]] = await db.query('SELECT request_status FROM PICKUP_REQUEST WHERE pickup_id = ?', [requests.overdue]);
    assert.equal(row.request_status, 'expired');
  });
});
