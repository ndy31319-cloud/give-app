const db = require('../db');
const { readAppointment, transition } = require('../lib/appointment');
const { getFirestore } = require('../lib/firebaseAdmin');
const { activeStatuses, nextStatus, validateCancelReason, fail } = require('../lib/tradeState');

const selectTrade = `SELECT p.*, d.member_id AS donor_id, d.title, d.status AS post_status,
  UNIX_TIMESTAMP(p.expires_at) * 1000 AS expires_ms,
  m.nickname AS requester_name FROM PICKUP_REQUEST p
  JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
  JOIN MEMBER m ON m.member_id = p.requester_id`;

function payload(row) {
  return {
    id: String(row.pickup_id), roomId: row.chat_room_id,
    donateId: String(row.donate_id), donorId: String(row.donor_id),
    requesterId: String(row.requester_id), requesterName: row.requester_name || '이웃',
    status: row.request_status, postStatus: row.post_status,
    expiresAt: row.expires_ms ? new Date(Number(row.expires_ms)).toISOString() : null,
    title: row.title,
    cancelReason: row.cancel_reason || null,
    appointment: readAppointment(row.appointment),
  };
}

async function transaction(fn) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function notify(connection, memberId, pickupId, type, text) {
  await connection.query(`INSERT INTO NOTIFICATION
    (member_id, related_type, related_id, notification_type, message, is_read, created_at)
    VALUES (?, 'pickup', ?, ?, ?, FALSE, NOW())`, [memberId, pickupId, type, text]);
}

// All state changes lock the donation first, then its requests in the same order.
async function expireLocked(connection, donation) {
  const [expired] = await connection.query(`SELECT pickup_id, requester_id FROM PICKUP_REQUEST
    WHERE donate_id = ? AND request_status = 'pending' AND expires_at <= NOW() FOR UPDATE`, [donation.donate_id]);
  if (!expired.length) return;
  await connection.query(`UPDATE PICKUP_REQUEST SET request_status = 'expired', resolved_at = NOW(), chat_synced = FALSE
    WHERE donate_id = ? AND request_status = 'pending' AND expires_at <= NOW()`, [donation.donate_id]);
  const [active] = await connection.query(`SELECT pickup_id FROM PICKUP_REQUEST
    WHERE donate_id = ? AND request_status IN ('pending', 'approved')`, [donation.donate_id]);
  if (!active.length && donation.status === 'reserved') {
    await connection.query("UPDATE ITEM_DONATE SET status = 'open' WHERE donate_id = ?", [donation.donate_id]);
    donation.status = 'open';
  }
  for (const row of expired) {
    for (const memberId of [row.requester_id, donation.member_id]) {
      await notify(connection, memberId, row.pickup_id, 'pickup_expired', `‘${donation.title}’ 나눔 요청의 응답 시간이 만료됐어요.`);
    }
  }
}

async function expireDonation(donateId) {
  await transaction(async connection => {
    const [rows] = await connection.query('SELECT * FROM ITEM_DONATE WHERE donate_id = ? FOR UPDATE', [donateId]);
    if (rows[0]) await expireLocked(connection, rows[0]);
  });
}

async function create(donateId, requesterId) {
  await expireDonation(donateId);
  const id = await transaction(async connection => {
    const [donations] = await connection.query('SELECT * FROM ITEM_DONATE WHERE donate_id = ? FOR UPDATE', [donateId]);
    const donation = donations[0];
    if (!donation) fail(404, '게시글을 찾을 수 없습니다.');
    if (Number(donation.member_id) === Number(requesterId)) fail(409, '본인 게시글에는 요청할 수 없습니다.');
    const [active] = await connection.query(`SELECT * FROM PICKUP_REQUEST WHERE donate_id = ?
      AND request_status IN ('pending', 'approved') FOR UPDATE`, [donateId]);
    if (active.length) {
      const mine = active.find(row => Number(row.requester_id) === Number(requesterId) && row.chat_room_id);
      if (mine) return mine.pickup_id; // Retry after a timeout returns the original request/room.
      fail(409, '다른 분의 나눔 요청이 진행 중입니다.');
    }
    if (donation.status !== 'open') fail(409, '현재 나눔 요청이 가능한 게시글이 아닙니다.');
    const [previous] = await connection.query(`SELECT chat_room_id FROM PICKUP_REQUEST
      WHERE donate_id = ? AND requester_id = ? AND chat_room_id IS NOT NULL
      ORDER BY pickup_id ASC LIMIT 1`, [donateId, requesterId]);
    const [result] = await connection.query(`INSERT INTO PICKUP_REQUEST
      (requester_id, donate_id, request_status, requested_at, expires_at, chat_synced)
      VALUES (?, ?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), FALSE)`, [requesterId, donateId]);
    await connection.query('UPDATE PICKUP_REQUEST SET chat_room_id = ? WHERE pickup_id = ?',
      [previous[0]?.chat_room_id || `trade_${result.insertId}`, result.insertId]);
    await connection.query("UPDATE ITEM_DONATE SET status = 'reserved' WHERE donate_id = ?", [donateId]);
    const [members] = await connection.query('SELECT nickname FROM MEMBER WHERE member_id = ?', [requesterId]);
    await notify(connection, donation.member_id, result.insertId, 'pickup_request', `${members[0]?.nickname || '이웃'}님이 ‘${donation.title}’ 나눔을 요청했어요.`);
    return result.insertId;
  });
  await sync(id);
  return get(id, requesterId);
}

async function get(id, memberId) {
  let [rows] = await db.query(`${selectTrade} WHERE p.pickup_id = ?`, [id]);
  let row = rows[0];
  if (!row || !row.chat_room_id) fail(404, '나눔 요청을 찾을 수 없습니다.');
  if (![row.donor_id, row.requester_id].some(value => Number(value) === Number(memberId))) fail(403, '거래 당사자만 조회할 수 있습니다.');
  if (row.request_status === 'pending' && Number(row.expires_ms) <= Date.now()) {
    await expireDonation(row.donate_id);
    [rows] = await db.query(`${selectTrade} WHERE p.pickup_id = ?`, [id]);
    row = rows[0];
  }
  return payload(row);
}

async function act(id, action, memberId, input = {}) {
  const current = await get(id, memberId); // Also persists expiration before rejecting stale actions.
  await transaction(async connection => {
    const [donations] = await connection.query('SELECT * FROM ITEM_DONATE WHERE donate_id = ? FOR UPDATE', [current.donateId]);
    if (!donations[0]) fail(404, '게시글을 찾을 수 없습니다.');
    const [rows] = await connection.query(`${selectTrade} WHERE p.pickup_id = ? FOR UPDATE`, [id]);
    const row = rows[0];
    if (!row) fail(404, '나눔 요청을 찾을 수 없습니다.');
    // The worker and approval use the same locks. Do not accept a request past its deadline.
    if (row.request_status === 'pending') {
      const [[clock]] = await connection.query('SELECT NOW() AS now');
      if (new Date(row.expires_at) <= new Date(clock.now)) fail(409, '응답 시간이 만료된 요청입니다.');
    }
    const target = nextStatus(row, action, memberId);
    if (row.request_status === target) return;
    const cancelReason = action === 'cancel' ? validateCancelReason(input?.reason) : null;
    if (donations[0].status !== 'reserved') fail(409, '게시글 상태가 변경되어 거래를 처리할 수 없습니다.');
    await connection.query(`UPDATE PICKUP_REQUEST SET request_status = ?, chat_synced = FALSE,
      approved_at = IF(? = 'approved', NOW(), approved_at),
      pickup_at = IF(? = 'completed', NOW(), pickup_at),
      resolved_at = IF(? IN ('rejected','canceled','completed'), NOW(), resolved_at),
      cancel_reason = IF(? = 'canceled', ?, cancel_reason)
      WHERE pickup_id = ?`, [target, target, target, target, target, cancelReason, id]);
    const postStatus = target === 'completed' ? 'completed' : activeStatuses.has(target) ? 'reserved' : 'open';
    await connection.query('UPDATE ITEM_DONATE SET status = ? WHERE donate_id = ?', [postStatus, row.donate_id]);
    const recipient = Number(memberId) === Number(row.donor_id) ? row.requester_id : row.donor_id;
    const notices = {
      approved: ['pickup_approved', `‘${row.title}’ 나눔 요청이 수락됐어요. 약속을 정해보세요.`],
      rejected: ['pickup_rejected', `‘${row.title}’ 나눔 요청이 거절됐어요.`],
      canceled: ['pickup_canceled', `상대방이 ‘${row.title}’ 나눔 거래를 취소했어요.`],
      completed: ['pickup_completed', `‘${row.title}’ 나눔이 완료됐어요.`],
    };
    await notify(connection, recipient, row.pickup_id, ...notices[target]);
  });
  // DB is authoritative. A delivery failure remains in the durable retry queue.
  await sync(id).catch(error => console.error('Trade chat sync pending:', error.message));
  return get(id, memberId);
}

async function sync(id) {
  // Hold the request lock until the exact state is delivered, avoiding stale workers overwriting newer cards.
  return transaction(async connection => {
    const [rows] = await connection.query('SELECT * FROM PICKUP_REQUEST WHERE pickup_id = ? FOR UPDATE', [id]);
    const request = rows[0];
    if (!request?.chat_room_id || request.chat_synced) return;
    const [details] = await connection.query(`${selectTrade} WHERE p.pickup_id = ?`, [id]);
    const row = details[0];
    if (!row) return;
    const [members] = await connection.query('SELECT member_id, name, nickname, email, dong_name FROM MEMBER WHERE member_id IN (?, ?)', [row.donor_id, row.requester_id]);
    const firestore = getFirestore();
    const room = firestore.collection('chatRooms').doc(row.chat_room_id);
    const snapshot = await room.get();
    const batch = firestore.batch();
    const text = `${row.requester_name || '이웃'}님이 나눔을 요청했어요!`;
    const createdAt = new Date(row.requested_at);
    if (!snapshot.exists) {
      batch.set(room, {
        roomId: room.id, roomKey: room.id, name: row.title,
        createdBy: row.requester_id, participantIds: members.map(m => Number(m.member_id)),
        participants: members, donorId: String(row.donor_id), requesterId: String(row.requester_id),
        relatedPostId: String(row.donate_id), postId: `donate_${row.donate_id}`, relatedPostType: 'donate',
        tradeRequestId: String(id), lastMessage: text, lastMessageAt: createdAt,
        createdAt, updatedAt: createdAt,
      });
    } else if (Number(snapshot.data()?.tradeRequestId || 0) < Number(id)) {
      batch.set(room, {
        tradeRequestId: String(id), lastMessage: text, lastMessageAt: createdAt,
        updatedAt: createdAt, participants: members,
        participantIds: members.map(m => Number(m.member_id)),
      }, { merge: true });
    }
    batch.set(room.collection('messages').doc(`request_${id}`), {
      messageId: `request_${id}`, roomId: room.id, type: 'TRADE_REQUEST', text,
      sender: members.find(m => Number(m.member_id) === Number(row.requester_id)),
      tradeRequest: payload(row), createdAt,
    });
    await batch.commit();
    await connection.query('UPDATE PICKUP_REQUEST SET chat_synced = TRUE WHERE pickup_id = ?', [id]);
  });
}

let working = false;
async function maintain() {
  if (working) return;
  working = true;
  try {
    const [expired] = await db.query(`SELECT DISTINCT donate_id FROM PICKUP_REQUEST
      WHERE request_status = 'pending' AND expires_at <= NOW() LIMIT 100`);
    for (const row of expired) await expireDonation(row.donate_id);
    const [pending] = await db.query('SELECT pickup_id FROM PICKUP_REQUEST WHERE chat_synced = FALSE AND chat_room_id IS NOT NULL LIMIT 100');
    for (const row of pending) {
      await sync(row.pickup_id).catch(error => console.error('Trade delivery retry:', error.message));
    }
  } finally { working = false; }
}

async function appointment(id, action, input, memberId) {
  const current = await get(id, memberId);
  await transaction(async connection => {
    await connection.query('SELECT donate_id FROM ITEM_DONATE WHERE donate_id = ? FOR UPDATE', [current.donateId]);
    const [[row]] = await connection.query(`${selectTrade} WHERE p.pickup_id = ? FOR UPDATE`, [id]);
    if (!row || row.request_status !== 'approved' || row.post_status !== 'reserved') fail(409, '수락된 진행 중 거래에서만 약속을 정할 수 있어요.');
    const next = transition(readAppointment(row.appointment), action, input, memberId);
    await connection.query('UPDATE PICKUP_REQUEST SET appointment = ?, chat_synced = FALSE WHERE pickup_id = ?', [JSON.stringify(next), id]);
    const recipient = Number(memberId) === Number(row.donor_id) ? row.requester_id : row.donor_id;
    await notify(connection, recipient, row.pickup_id, 'request', `‘${row.title}’ 만남 약속${action === 'confirm' ? '이 확정됐어요.' : ' 제안이 도착했어요. 장소와 시간을 확인해주세요.'}`);
  });
  await sync(id).catch(error => console.error('Appointment chat sync pending:', error.message));
  return get(id, memberId);
}
module.exports = { create, get, act, sync, maintain, expireDonation, appointment };
