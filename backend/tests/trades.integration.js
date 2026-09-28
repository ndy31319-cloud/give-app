// Explicit integration run: creates synthetic fixtures in configured MySQL/Firestore,
// then deletes only IDs created by this run. No existing member or post is used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../db');
const firebase = require('../lib/firebaseAdmin');
const realFirestore = firebase.getFirestore;
let simulateOffline = false;
firebase.getFirestore = () => {
  if (simulateOffline) throw new Error('Simulated Firestore outage');
  return realFirestore();
};
const trades = require('../services/trades');

test('request, concurrent contention, recovery, approval, cancellation, expiration and completion', async t => {
  const tag = `trade_test_${crypto.randomBytes(4).toString('hex')}`;
  const members = [];
  const donations = [];
  const rooms = new Set();
  const captureRooms = async () => {
    for (const id of donations) {
      const [rows] = await db.query('SELECT chat_room_id FROM PICKUP_REQUEST WHERE donate_id = ?', [id]);
      rows.forEach(row => { if (row.chat_room_id) rooms.add(row.chat_room_id); });
    }
  };
  t.after(async () => {
    simulateOffline = false;
    try {
      await captureRooms();
      for (const id of rooms) {
        const ref = realFirestore().collection('chatRooms').doc(id);
        await realFirestore().recursiveDelete(ref);
      }
      for (const id of donations) {
        await db.query('DELETE FROM PICKUP_REQUEST WHERE donate_id = ?', [id]);
        await db.query('DELETE FROM ITEM_DONATE WHERE donate_id = ?', [id]);
      }
      for (const id of members) {
        await db.query('DELETE FROM NOTIFICATION WHERE member_id = ?', [id]);
        await db.query('DELETE FROM MEMBER WHERE member_id = ?', [id]);
      }
    } finally { await db.end(); }
  });
  for (let index = 0; index < 3; index++) {
    const [result] = await db.query(`INSERT INTO MEMBER
      (role_id, member_pw, name, email, phone, dong_name, nickname)
      VALUES (1, ?, ?, ?, ?, '테스트동', ?)`,
    [crypto.randomUUID(), tag, `${tag}_${index}@example.invalid`, `${tag.slice(-8)}-${index}`, `${tag.slice(-8)}_${index}`]);
    members.push(result.insertId);
  }
  const [donor, requester, other] = members;
  async function post() {
    const [result] = await db.query("INSERT INTO ITEM_DONATE (member_id, title, content, status) VALUES (?, ?, 'integration fixture', 'open')", [donor, tag]);
    donations.push(result.insertId);
    return result.insertId;
  }
  async function status(id) {
    const [[row]] = await db.query('SELECT status FROM ITEM_DONATE WHERE donate_id = ?', [id]);
    return row.status;
  }

  await t.test('double request has one winner and one reserved post', async () => {
    const id = await post();
    await assert.rejects(trades.create(id, donor), error => error.statusCode === 409);
    const results = await Promise.allSettled([trades.create(id, requester), trades.create(id, other)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.statusCode, 409);
    const trade = results.find(r => r.status === 'fulfilled').value;
    assert.equal(await status(id), 'reserved');
    const loser = Number(trade.requesterId) === requester ? other : requester;
    await assert.rejects(trades.get(trade.id, loser), error => error.statusCode === 403);
    await assert.rejects(trades.act(trade.id, 'approve', trade.requesterId), error => error.statusCode === 403);
    const retried = await trades.create(id, trade.requesterId);
    assert.equal(retried.id, trade.id);
    const [[count]] = await db.query('SELECT COUNT(*) AS n FROM PICKUP_REQUEST WHERE donate_id = ?', [id]);
    assert.equal(count.n, 1);
    await trades.act(trade.id, 'approve', donor);
    await trades.act(trade.id, 'approve', donor);
    assert.equal(await status(id), 'reserved');
    await trades.act(trade.id, 'complete', donor);
    assert.equal(await status(id), 'completed');
    await assert.rejects(trades.act(trade.id, 'cancel', donor), error => error.statusCode === 409);
    const card = await realFirestore().collection('chatRooms').doc(trade.roomId).collection('messages').doc(`request_${trade.id}`).get();
    assert.equal(card.data().tradeRequest.status, 'completed');
    const [notices] = await db.query("SELECT member_id, notification_type FROM NOTIFICATION WHERE related_type = 'pickup' AND related_id = ? ORDER BY notification_id", [trade.id]);
    assert.deepEqual(notices.map(row => row.notification_type), ['pickup_request', 'pickup_approved', 'pickup_completed']);
    assert.deepEqual(notices.map(row => Number(row.member_id)), [donor, Number(trade.requesterId), Number(trade.requesterId)]);
  });

  await t.test('Firestore outage retains one durable request; retry delivers the same room', async () => {
    const id = await post();
    simulateOffline = true;
    await assert.rejects(trades.create(id, requester), /Simulated Firestore outage/);
    assert.equal(await status(id), 'reserved');
    const [[original]] = await db.query('SELECT * FROM PICKUP_REQUEST WHERE donate_id = ?', [id]);
    assert.equal(original.chat_synced, 0);
    simulateOffline = false;
    const trade = await trades.create(id, requester);
    assert.equal(trade.id, String(original.pickup_id));
    await trades.act(trade.id, 'reject', donor);
    assert.equal(await status(id), 'open');
    const again = await trades.create(id, other);
    assert.notEqual(again.id, trade.id);
    const old = await trades.act(trade.id, 'reject', donor);
    assert.equal(old.postStatus, 'reserved');
    await trades.act(again.id, 'cancel', other);
    assert.equal(await status(id), 'open');
  });

  await t.test('appointment agreement, stale proposals, activity readback and closed-trade protection', async () => {
    const id = await post();
    const trade = await trades.create(id, requester);
    const proposal = { revision: 0, at: new Date(Date.now() + 86400000).toISOString(), place: '테스트 정문', latitude: 37.5, longitude: 127 };
    await assert.rejects(trades.appointment(trade.id, 'propose', proposal, requester), e => e.statusCode === 409);
    await trades.act(trade.id, 'approve', donor);
    await assert.rejects(trades.appointment(trade.id, 'propose', proposal, other), e => e.statusCode === 403);
    const results = await Promise.allSettled([
      trades.appointment(trade.id, 'propose', proposal, requester),
      trades.appointment(trade.id, 'propose', { ...proposal, place: '테스트 후문' }, donor),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.statusCode, 409);
    const current = await trades.get(trade.id, donor);
    const proposer = Number(current.appointment.pending.proposedBy);
    const confirmer = proposer === donor ? requester : donor;
    await assert.rejects(trades.appointment(trade.id, 'confirm', { revision: 1 }, proposer), e => e.statusCode === 403);
    const confirmed = await trades.appointment(trade.id, 'confirm', { revision: 1 }, confirmer);
    assert.equal(confirmed.appointment.pending, null);
    await assert.rejects(trades.appointment(trade.id, 'confirm', { revision: 1 }, confirmer), e => e.statusCode === 409);
    const changed = await trades.appointment(trade.id, 'propose', { ...proposal, revision: 2, place: '도서관 앞' }, donor);
    assert.deepEqual(changed.appointment.confirmed, confirmed.appointment.confirmed);
    const { listActivity } = require('../services/activity');
    const activity = await listActivity(requester, {});
    assert.deepEqual(activity.sentRequests.find(row => row.id === trade.id).appointment, changed.appointment);
    const snapshot = await realFirestore().collection('chatRooms').doc(trade.roomId).collection('messages').doc(`request_${trade.id}`).get();
    assert.deepEqual(snapshot.data().tradeRequest.appointment, changed.appointment);
    await trades.act(trade.id, 'cancel', requester);
    await assert.rejects(trades.appointment(trade.id, 'confirm', { revision: 3 }, requester), e => e.statusCode === 409);
    const [notices] = await db.query("SELECT notification_id FROM NOTIFICATION WHERE related_type = 'pickup' AND related_id = ? AND notification_type = 'request'", [trade.id]);
    assert.equal(notices.length, 3);
  });

  await t.test('expiration reopens post and prevents stale acceptance; approved requests do not expire', async () => {
    const id = await post();
    const trade = await trades.create(id, requester);
    assert.ok(new Date(trade.expiresAt).getTime() > Date.now() + 23 * 3600000);
    await db.query('UPDATE PICKUP_REQUEST SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE pickup_id = ?', [trade.id]);
    await assert.rejects(trades.act(trade.id, 'approve', donor), error => error.statusCode === 409);
    assert.equal(await status(id), 'open');
    assert.equal((await trades.get(trade.id, requester)).status, 'expired');
    const again = await trades.create(id, other);
    await trades.act(again.id, 'approve', donor);
    await db.query('UPDATE PICKUP_REQUEST SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE pickup_id = ?', [again.id]);
    await trades.expireDonation(id);
    assert.equal((await trades.get(again.id, other)).status, 'approved');
    await trades.act(again.id, 'cancel', donor);
    assert.equal(await status(id), 'open');
    await trades.sync(trade.id);
  });
});
