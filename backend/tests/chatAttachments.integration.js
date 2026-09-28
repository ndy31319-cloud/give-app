// Uses only synthetic members, a dedicated room, and test image; cleans them up.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { getFirestore } = require('../lib/firebaseAdmin');
const media = require('../lib/chatMedia');
const storedImages = [];
const save = media.saveChatImage;
media.saveChatImage = async (...args) => {
  const result = await save(...args);
  storedImages.push(result);
  return result;
};
const chatRouter = require('../routes/chat');

test('text, photo and current location roundtrip through authenticated chat API', async t => {
  const members = [];
  const tag = `chat_test_${crypto.randomBytes(4).toString('hex')}`;
  const room = getFirestore().collection('chatRooms').doc(tag);
  const app = express();
  app.use(express.json());
  app.use('/api/chats', chatRouter);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api/chats/rooms/${tag}`;
  t.after(async () => {
    try {
      await new Promise(resolve => server.close(resolve));
      for (const image of storedImages) await image.remove().catch(() => {});
      await getFirestore().recursiveDelete(room);
      for (const id of members) await db.query('DELETE FROM MEMBER WHERE member_id = ?', [id]);
    } finally { await db.end(); }
  });
  for (let i = 0; i < 3; i++) {
    const [result] = await db.query(`INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, nickname)
      VALUES (1, ?, ?, ?, ?, '테스트동', ?)`, [crypto.randomUUID(), tag, `${tag}_${i}@example.invalid`, `${tag.slice(-8)}-${i}`, `${tag.slice(-8)}_${i}`]);
    members.push(result.insertId);
  }
  await room.set({ participantIds: members.slice(0, 2), participants: members.slice(0, 2).map(id => ({ member_id: id })), createdAt: new Date() });
  const headers = id => ({ Authorization: `Bearer ${jwt.sign({ member_id: id }, process.env.JWT_SECRET || 'give-local-development-secret')}` });
  const send = (id, body) => fetch(`${base}/messages`, { method: 'POST', headers: { ...headers(id), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWOQAAAAASUVORK5CYII=', 'base64');
  const form = (buffer = png, id = 'photo_test') => {
    const value = new FormData();
    value.append('clientMessageId', id);
    value.append('image', new Blob([buffer], { type: 'image/png' }), 'test.png');
    return value;
  };
  await t.test('nonparticipants cannot read, send or upload', async () => {
    assert.equal((await fetch(`${base}/messages`, { headers: headers(members[2]) })).status, 403);
    assert.equal((await send(members[2], { text: 'forbidden' })).status, 403);
    assert.equal((await fetch(`${base}/images`, { method: 'POST', headers: headers(members[2]), body: form() })).status, 403);
    assert.equal(storedImages.length, 0);
  });
  await t.test('text and typed location store correct coordinates; retry is idempotent', async () => {
    assert.equal((await send(members[0], { text: '안녕하세요' })).status, 201);
    const payload = { type: 'LOCATION', clientMessageId: 'location_test', location: { latitude: 37.5, longitude: 127, label: '현재 위치' } };
    assert.equal((await send(members[0], payload)).status, 201);
    assert.equal((await send(members[0], payload)).status, 200);
    assert.equal((await send(members[0], { ...payload, location: { latitude: 500, longitude: 0 } })).status, 400);
  });
  await t.test('photo uploads, appears to other participant, and oversized/fake files fail', async () => {
    const upload = await fetch(`${base}/images`, { method: 'POST', headers: headers(members[0]), body: form() });
    const result = await upload.json();
    assert.equal(upload.status, 201, JSON.stringify(result));
    assert.equal(result.data.type, 'IMAGE');
    assert.ok(result.data.image.url.startsWith('http'));
    assert.equal((await fetch(`${base}/images`, { method: 'POST', headers: headers(members[0]), body: form() })).status, 200);
    assert.equal((await fetch(`${base}/images`, { method: 'POST', headers: headers(members[0]), body: form(Buffer.from('not a photo'), 'bad') })).status, 400);
    assert.equal((await fetch(`${base}/images`, { method: 'POST', headers: headers(members[0]), body: form(Buffer.alloc(5 * 1024 * 1024 + 1), 'large') })).status, 400);
    const list = await (await fetch(`${base}/messages`, { headers: headers(members[1]) })).json();
    assert.equal(list.data.length, 3);
    assert.equal(list.data.find(message => message.type === 'LOCATION').location.latitude, 37.5);
    assert.equal(list.data.find(message => message.type === 'IMAGE').image.url, result.data.image.url);
  });
});
