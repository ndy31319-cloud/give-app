// Uses isolated synthetic members; cleanup deletes only fixtures from this run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const notifications = require('../routes/notifications');

test('notification feed, exact request links, pagination and persistent member-scoped reads', async t => {
  const tag = `notice_${crypto.randomBytes(4).toString('hex')}`;
  const members = [], donations = [], pickups = [];
  const app = express(); app.use(express.json()); app.use('/api/notifications', notifications);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`;
  t.after(async () => {
    try {
      await new Promise(resolve => server.close(resolve));
      for (const id of members) await db.query('DELETE FROM NOTIFICATION WHERE member_id = ?', [id]);
      for (const id of pickups) await db.query('DELETE FROM PICKUP_REQUEST WHERE pickup_id = ?', [id]);
      for (const id of donations) await db.query('DELETE FROM ITEM_DONATE WHERE donate_id = ?', [id]);
      for (const id of members) await db.query('DELETE FROM MEMBER WHERE member_id = ?', [id]);
    } finally { await db.end(); }
  });
  for (let index = 0; index < 3; index++) {
    const [result] = await db.query(`INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, nickname)
      VALUES (1, ?, ?, ?, ?, '테스트동', ?)`, [crypto.randomUUID(), tag, `${tag}_${index}@example.invalid`, `${tag.slice(-8)}-${index}`, `${tag.slice(-8)}_${index}`]);
    members.push(result.insertId);
  }
  const [donor, requester, outsider] = members;
  const [post] = await db.query("INSERT INTO ITEM_DONATE (member_id, title, content, status) VALUES (?, ?, 'fixture', 'open')", [donor, tag]);
  donations.push(post.insertId);
  for (let index = 0; index < 2; index++) {
    const [result] = await db.query(`INSERT INTO PICKUP_REQUEST (requester_id, donate_id, request_status, chat_room_id, requested_at)
      VALUES (?, ?, 'rejected', ?, NOW())`, [requester, post.insertId, `${tag}_room_${index}`]);
    pickups.push(result.insertId);
  }
  async function insert(member, type = 'pickup', related = pickups[0], code = 'pickup_request', read = false) {
    const [result] = await db.query(`INSERT INTO NOTIFICATION (member_id, related_type, related_id, notification_type, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())`, [member, type, related, code, tag, read]);
    return String(result.insertId);
  }
  async function request(member, path, method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${jwt.sign({ member_id: member }, process.env.JWT_SECRET || 'give-local-development-secret')}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const first = await insert(donor);
  const second = await insert(donor, 'pickup', pickups[1]);
  const legacy = await insert(donor, 'donate', post.insertId);
  const foreign = await insert(outsider);
  await t.test('authentication, ownership and exact request target', async () => {
    assert.equal((await fetch(base + '/feed')).status, 401);
    const result = await request(donor, `/feed?member_id=${outsider}`);
    assert.equal(result.status, 200);
    const items = result.body.data.items;
    assert.equal(items.length, 3);
    assert.equal(items.find(n => n.id === first).target.roomId, `${tag}_room_0`);
    assert.equal(items.find(n => n.id === second).target.roomId, `${tag}_room_1`);
    assert.deepEqual(items.find(n => n.id === legacy).target, { type: 'post', postId: `donate_${post.insertId}` });
    assert.notEqual((await request(outsider, '/feed')).body.data.items[0].target?.type, 'chat');
    assert.equal((await request(donor, `/${foreign}/read`, 'PATCH')).status, 404);
    assert.equal((await request(donor, '/feed?before=bad')).status, 400);
    assert.equal((await request(donor, '/read-all', 'PATCH', {})).status, 400);
  });
  await t.test('global unread count, cursor pages, unread filter and idempotent persisted reads', async () => {
    for (let index = 0; index < 31; index++) await insert(donor);
    const page1 = (await request(donor, '/feed')).body.data;
    assert.equal(page1.items.length, 30); assert.equal(page1.unreadCount, 34);
    const page2 = (await request(donor, `/feed?before=${page1.nextCursor}`)).body.data;
    assert.equal(page2.items.length, 4); assert.equal(page2.nextCursor, null);
    assert.equal(new Set([...page1.items, ...page2.items].map(n => n.id)).size, 34);
    assert.equal((await request(donor, `/${second}/read`, 'PATCH')).status, 200);
    assert.equal((await request(donor, `/${second}/read`, 'PATCH')).status, 200);
    const filtered = (await request(donor, `/feed?unread=1&before=${page1.nextCursor}`)).body.data;
    assert.equal(filtered.unreadCount, 33); assert.ok(filtered.items.every(n => !n.isRead && n.id !== second));
    const [[row]] = await db.query('SELECT is_read FROM NOTIFICATION WHERE notification_id = ?', [second]);
    assert.equal(row.is_read, 1);
  });
  await t.test('read-all preserves newer arrivals and other members; missing targets stay readable', async () => {
    const snapshot = (await request(donor, '/feed')).body.data.items[0].id;
    const newest = await insert(donor, 'pickup', 2147483647, 'pickup_expired');
    assert.equal((await request(donor, '/read-all', 'PATCH', { throughId: snapshot })).status, 200);
    const data = (await request(donor, '/feed?unread=1')).body.data;
    assert.equal(data.unreadCount, 1); assert.equal(data.items[0].id, newest); assert.equal(data.items[0].target, null);
    assert.equal((await request(outsider, '/feed')).body.data.unreadCount, 1);
  });
});
