const db = require('../db');
const { readAppointment } = require('../lib/appointment');
const { expireDonation } = require('./trades');
const { buildUploadUrl } = require('../lib/uploadUrl');

const iso = value => value ? new Date(Number(value) * 1000).toISOString() : null;

async function listActivity(memberId, req) {
  // Refresh only this member's expired requests; do not return stale reservations.
  const [expired] = await db.query(`SELECT DISTINCT p.donate_id FROM PICKUP_REQUEST p
    JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
    WHERE (p.requester_id = ? OR d.member_id = ?) AND p.request_status = 'pending'
      AND p.expires_at <= NOW()`, [memberId, memberId]);
  for (const row of expired) await expireDonation(row.donate_id);

  const [[donations], [wanted], [requests]] = await Promise.all([
    db.query(`SELECT d.donate_id AS post_id, d.title, d.status,
      UNIX_TIMESTAMP(d.created_at) AS created_seconds,
      (SELECT MIN(image_url) FROM ITEM_DONATE_IMAGE WHERE donate_id = d.donate_id) AS image_url
      FROM ITEM_DONATE d WHERE d.member_id = ? ORDER BY d.created_at DESC, d.donate_id DESC`, [memberId]),
    db.query(`SELECT r.request_id AS post_id, r.title, r.status,
      UNIX_TIMESTAMP(r.created_at) AS created_seconds,
      (SELECT MIN(image_url) FROM ITEM_REQUEST_IMAGE WHERE request_id = r.request_id) AS image_url
      FROM ITEM_REQUEST r WHERE r.member_id = ? ORDER BY r.created_at DESC, r.request_id DESC`, [memberId]),
    db.query(`SELECT p.pickup_id, p.donate_id, p.requester_id, p.request_status, p.chat_room_id, p.appointment,
      UNIX_TIMESTAMP(p.requested_at) AS created_seconds,
      UNIX_TIMESTAMP(p.expires_at) AS expires_seconds,
      d.member_id AS donor_id, d.title, d.status AS post_status,
      COALESCE(NULLIF(donor.nickname, ''), donor.name) AS donor_name,
      COALESCE(NULLIF(requester.nickname, ''), requester.name) AS requester_name,
      (SELECT MIN(image_url) FROM ITEM_DONATE_IMAGE WHERE donate_id = d.donate_id) AS image_url
      FROM PICKUP_REQUEST p JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
      JOIN MEMBER donor ON donor.member_id = d.member_id
      JOIN MEMBER requester ON requester.member_id = p.requester_id
      WHERE p.requester_id = ? OR d.member_id = ?
      ORDER BY p.requested_at DESC, p.pickup_id DESC`, [memberId, memberId]),
  ]);

  const post = (row, type) => ({
    id: `${type}_${row.post_id}`, postId: String(row.post_id), type,
    title: row.title, status: row.status,
    image: row.image_url ? buildUploadUrl(req, row.image_url) : null,
    createdAt: iso(row.created_seconds),
  });
  const trades = requests.map(row => ({
    id: String(row.pickup_id), postId: `donate_${row.donate_id}`, title: row.title,
    donorId: String(row.donor_id), requesterId: String(row.requester_id),
    donorName: row.donor_name || '이웃', requesterName: row.requester_name || '이웃',
    status: row.request_status === 'picked_up' ? 'completed' : row.request_status,
    postStatus: row.post_status, roomId: row.chat_room_id || null,
    appointment: readAppointment(row.appointment),
    image: row.image_url ? buildUploadUrl(req, row.image_url) : null,
    createdAt: iso(row.created_seconds), expiresAt: iso(row.expires_seconds),
  }));
  const sentRequests = trades.filter(row => row.requesterId === String(memberId));
  const receivedRequests = trades.filter(row => row.donorId === String(memberId));
  return {
    donatedPosts: donations.map(row => post(row, 'donate')),
    requestedPosts: wanted.map(row => post(row, 'request')),
    sentRequests, receivedRequests,
    counts: { shares: donations.length, requests: sentRequests.length, received: receivedRequests.length, wanted: wanted.length },
  };
}

module.exports = { listActivity };
