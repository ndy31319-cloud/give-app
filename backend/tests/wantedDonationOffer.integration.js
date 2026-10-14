const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const wanted = require("../routes/wanted");
const device = require("../routes/device");

test("wanted donation offer creates a QR-ready donation storage post", async (t) => {
  const tag = `wanted_offer_${crypto.randomBytes(4).toString("hex")}`;
  const members = [];
  const donations = [];
  const pickups = [];
  const requests = [];

  const app = express();
  app.use(express.json());
  app.use("/api/wanted", wanted);
  app.use("/api/device", device);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    try {
      await new Promise((resolve) => server.close(resolve));
      for (const donateId of donations) {
        await db.query("DELETE FROM DYNAMIC_QR WHERE donate_id = ?", [donateId]);
        await db.query("DELETE FROM PICKUP_REQUEST WHERE donate_id = ?", [donateId]);
        await db.query("DELETE FROM ITEM WHERE donate_id = ?", [donateId]);
        await db.query("DELETE FROM ITEM_DONATE WHERE donate_id = ?", [donateId]);
      }
      for (const requestId of requests) {
        await db.query("DELETE FROM ITEM WHERE request_id = ?", [requestId]);
        await db.query("DELETE FROM ITEM_REQUEST WHERE request_id = ?", [requestId]);
      }
      for (const memberId of members) {
        await db.query("DELETE FROM NOTIFICATION WHERE member_id = ?", [memberId]);
        await db.query("DELETE FROM MEMBER WHERE member_id = ?", [memberId]);
      }
    } finally {
      await db.end();
    }
  });

  const [[product]] = await db.query("SELECT product_id FROM PRODUCT ORDER BY product_id LIMIT 1");
  assert.ok(product?.product_id, "fixture database needs at least one PRODUCT row");

  const insertMember = async (roleId, suffix) => {
    const shortTag = tag.replace("wanted_offer_", "wo_");
    const [result] = await db.query(
      `INSERT INTO MEMBER
        (role_id, member_pw, name, email, phone, dong_name, nickname)
       VALUES (?, ?, ?, ?, ?, '테스트동', ?)`,
      [
        roleId,
        crypto.randomUUID(),
        `${shortTag}_${suffix}`,
        `${tag}_${suffix}@example.invalid`,
        `${tag.slice(-8)}-${suffix.slice(0, 1)}`,
        `${shortTag}_${suffix.slice(0, 1)}`,
      ],
    );
    members.push(result.insertId);
    return result.insertId;
  };

  const donorId = await insertMember(1, "donor");
  const requesterId = await insertMember(3, "requester");
  const [requestResult] = await db.query(
    `INSERT INTO ITEM_REQUEST
      (member_id, title, content, status, dong_name)
     VALUES (?, ?, ?, 'open', '테스트동')`,
    [requesterId, tag, "보관함으로 받고 싶어요."],
  );
  const requestId = requestResult.insertId;
  requests.push(requestId);
  await db.query(
    `INSERT INTO ITEM
      (request_id, product_id, item_name, item_condition)
     VALUES (?, ?, ?, '상태 무관')`,
    [requestId, product.product_id, tag],
  );

  const donorToken = jwt.sign(
    { member_id: donorId, role_id: 1 },
    process.env.JWT_SECRET || "give-local-development-secret",
  );
  const authHeaders = {
    Authorization: `Bearer ${donorToken}`,
    "Content-Type": "application/json",
  };

  const offerResponse = await fetch(`${base}/api/wanted/${requestId}/donation-offer`, {
    method: "POST",
    headers: authHeaders,
  });
  const offerBody = await offerResponse.json();
  assert.equal(offerResponse.status, 201, JSON.stringify(offerBody));
  assert.ok(offerBody.data.donateId);
  assert.ok(offerBody.data.pickupRequestId);
  donations.push(offerBody.data.donateId);
  pickups.push(offerBody.data.pickupRequestId);

  const [[donation]] = await db.query(
    "SELECT member_id, title, status FROM ITEM_DONATE WHERE donate_id = ?",
    [offerBody.data.donateId],
  );
  assert.deepEqual(
    {
      member_id: Number(donation.member_id),
      title: donation.title,
      status: donation.status,
    },
    { member_id: donorId, title: tag, status: "reserved" },
  );

  const [[pickup]] = await db.query(
    "SELECT requester_id, request_status FROM PICKUP_REQUEST WHERE pickup_id = ?",
    [offerBody.data.pickupRequestId],
  );
  assert.deepEqual(
    { requester_id: Number(pickup.requester_id), request_status: pickup.request_status },
    { requester_id: requesterId, request_status: "approved" },
  );

  const [[wantedPost]] = await db.query(
    "SELECT status FROM ITEM_REQUEST WHERE request_id = ?",
    [requestId],
  );
  assert.equal(wantedPost.status, "reserved");

  const duplicateResponse = await fetch(`${base}/api/wanted/${requestId}/donation-offer`, {
    method: "POST",
    headers: authHeaders,
  });
  const duplicateBody = await duplicateResponse.json();
  assert.equal(duplicateResponse.status, 200, JSON.stringify(duplicateBody));
  assert.equal(duplicateBody.data.donateId, offerBody.data.donateId);
  assert.equal(duplicateBody.data.alreadyExists, true);

  const qrResponse = await fetch(`${base}/api/device/qr/issue`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      purpose: "donation_storage",
      donateId: offerBody.data.donateId,
      ttlSeconds: 60,
    }),
  });
  const qrBody = await qrResponse.json();
  assert.equal(qrResponse.status, 201, JSON.stringify(qrBody));
  assert.equal(qrBody.data.purpose, "donation_storage");
  assert.equal(Number(qrBody.data.donateId), Number(offerBody.data.donateId));
  assert.match(qrBody.data.token, /^WF-\d{4}-[A-Z0-9]{4}$/);
  assert.equal(qrBody.data.token, qrBody.data.displayCode);

  const kioskHeaders = {
    "Content-Type": "application/json",
    ...(process.env.KIOSK_API_KEY ? { "x-kiosk-key": process.env.KIOSK_API_KEY } : {}),
  };
  const validateResponse = await fetch(`${base}/api/device/qr/storage/validate`, {
    method: "POST",
    headers: kioskHeaders,
    body: JSON.stringify({ token: qrBody.data.token }),
  });
  const validateBody = await validateResponse.json();
  assert.equal(validateResponse.status, 200, JSON.stringify(validateBody));
  assert.equal(validateBody.data.qrSession.token, qrBody.data.token);
  assert.equal(Number(validateBody.data.donation.donateId), Number(offerBody.data.donateId));

  const suffixOnly = qrBody.data.token.split("-").at(-1);
  const manualValidateResponse = await fetch(`${base}/api/device/qr/storage/validate`, {
    method: "POST",
    headers: kioskHeaders,
    body: JSON.stringify({ token: suffixOnly }),
  });
  const manualValidateBody = await manualValidateResponse.json();
  assert.equal(manualValidateResponse.status, 200, JSON.stringify(manualValidateBody));
  assert.equal(manualValidateBody.data.qrSession.token, qrBody.data.token);
});
