const crypto = require("crypto");
const express = require("express");
const authenticateToken = require("../middlewares/authMiddleware");
const db = require("../db");

const router = express.Router();
const sessionsByToken = new Map();
const kioskSessionsById = new Map();
const lockerCommandQueues = new Map();
const lockerCommandsById = new Map();
const lockerStatesById = new Map();

const defaultTtlSeconds = 60;
const defaultLockerId = process.env.DEFAULT_LOCKER_ID || "locker-1";
const defaultLockerCommandRedeliveryMs = 10000;
const pickupApprovalPostStatuses = new Set(["reserved", "stored"]);
const pickupAccessiblePostStatuses = new Set(["stored"]);
let lockerCommandSequence = 0;

const getMemberId = (req) => req.user.member_id || req.user.id;

const toIsoString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

const normalizePurpose = (purpose) => {
  if (purpose === "pickup_auth" || purpose === "pickup_access") {
    return "pickup_auth";
  }

  if (purpose === "donation_storage") {
    return "donation_storage";
  }

  return "kiosk_login";
};

const parsePositiveInteger = (value) => {
  const normalizedValue = String(value || "").trim();
  const prefixedValue = normalizedValue.match(/^donate[_-](\d+)$/i);
  const numericValue = prefixedValue ? prefixedValue[1] : normalizedValue;

  if (!/^\d+$/.test(numericValue)) {
    return null;
  }

  const parsed = Number(numericValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeTtl = (rawValue) => {
  const ttl = Number(rawValue);

  if (!Number.isFinite(ttl) || ttl <= 0) {
    return defaultTtlSeconds;
  }

  return Math.min(Math.floor(ttl), 300);
};

const normalizeLockerId = (value) => {
  const lockerId = String(value || defaultLockerId).trim();
  return lockerId || defaultLockerId;
};

const normalizeRedeliveryMs = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(Math.floor(parsed), 1000)
    : defaultLockerCommandRedeliveryMs;
};

const lockerCommandRedeliveryMs = normalizeRedeliveryMs(process.env.LOCKER_COMMAND_REDELIVERY_MS);

const getLockerQueue = (lockerId) => {
  const normalizedLockerId = normalizeLockerId(lockerId);

  if (!lockerCommandQueues.has(normalizedLockerId)) {
    lockerCommandQueues.set(normalizedLockerId, []);
  }

  return lockerCommandQueues.get(normalizedLockerId);
};

const queueLockerCommand = (lockerId, type, payload = {}) => {
  const normalizedLockerId = normalizeLockerId(lockerId);
  const createdAt = new Date().toISOString();
  const command = {
    id: `locker_cmd_${Date.now()}_${lockerCommandSequence += 1}`,
    lockerId: normalizedLockerId,
    locker_id: normalizedLockerId,
    type,
    payload,
    status: "pending",
    createdAt,
    created_at: createdAt,
    deliveredAt: null,
    delivered_at: null,
    deliveryAttempts: 0,
    delivery_attempts: 0,
    acknowledgedAt: null,
    acknowledged_at: null,
  };

  lockerCommandsById.set(command.id, command);
  getLockerQueue(normalizedLockerId).push(command);
  return command;
};

const isCommandReadyForDelivery = (command, now = Date.now()) => {
  if (command.status === "pending") {
    return true;
  }

  if (command.status !== "delivered") {
    return false;
  }

  const deliveredAt = Date.parse(command.deliveredAt || command.delivered_at || "");
  return !Number.isFinite(deliveredAt) || now - deliveredAt >= lockerCommandRedeliveryMs;
};

const updateLockerState = (lockerId, state) => {
  const normalizedLockerId = normalizeLockerId(lockerId);
  const previous = lockerStatesById.get(normalizedLockerId) || {};
  const next = {
    lockerId: normalizedLockerId,
    locker_id: normalizedLockerId,
    locked: state.locked ?? previous.locked ?? true,
    doorOpen: state.doorOpen ?? state.door_open ?? previous.doorOpen ?? false,
    redLedOn: state.redLedOn ?? state.red_led_on ?? previous.redLedOn ?? false,
    occupied: state.occupied ?? previous.occupied ?? false,
    lastCommandId: state.lastCommandId ?? state.last_command_id ?? previous.lastCommandId ?? null,
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  lockerStatesById.set(normalizedLockerId, next);
  return next;
};

const getLockerState = (lockerId) =>
  lockerStatesById.get(normalizeLockerId(lockerId)) ||
  updateLockerState(lockerId, {});

const lockerCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const buildLockerDisplayCode = () => {
  const year = new Date().getFullYear();
  let suffix = "";

  for (let index = 0; index < 4; index += 1) {
    suffix += lockerCodeAlphabet[crypto.randomInt(lockerCodeAlphabet.length)];
  }

  return `WF-${year}-${suffix}`;
};

const buildQrCredentials = async () => {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const displayCode = buildLockerDisplayCode();
    const token = displayCode;
    const [existingRows] = await db.query(
      `SELECT qr_id
       FROM DYNAMIC_QR
       WHERE token = ? OR display_code = ?
       LIMIT 1`,
      [token, displayCode],
    );

    if (!existingRows.length) {
      return { token, displayCode };
    }
  }

  throw new Error("QR credential generation exhausted.");
};

const normalizeDisplayCode = (value) => {
  const rawValue = String(value || "").trim().toUpperCase();
  const compactValue = rawValue.replace(/[^A-Z0-9]/g, "");

  if (/^WF-\d{4}-[A-Z0-9]{4}$/.test(rawValue)) {
    return rawValue;
  }

  const codeBody = compactValue.startsWith("WF") ? compactValue.slice(2) : compactValue;

  if (/^[A-Z0-9]{8}$/.test(codeBody)) {
    return `WF-${codeBody.slice(0, 4)}-${codeBody.slice(4, 8)}`;
  }

  if (!compactValue.startsWith("WF") && /^[A-Z0-9]{4}$/.test(codeBody)) {
    return `WF-${new Date().getFullYear()}-${codeBody}`;
  }

  return null;
};

const toResponseSession = (session) => ({
  id: session.id,
  memberId: session.memberId,
  member_id: session.memberId,
  donateId: session.donateId,
  donate_id: session.donateId,
  purpose: session.purpose,
  token: session.token,
  displayCode: session.displayCode,
  display_code: session.displayCode,
  issuedAt: session.issuedAt,
  issued_at: session.issuedAt,
  expiresAt: session.expiresAt,
  expires_at: session.expiresAt,
  status: session.status,
  ttlSeconds: session.ttlSeconds,
  ttl_seconds: session.ttlSeconds,
  usedAt: session.usedAt,
  used_at: session.usedAt,
});

const expireIfNeeded = (session) => {
  if (session.status === "active" && new Date(session.expiresAt).getTime() <= Date.now()) {
    session.status = "expired";
  }

  return session;
};

const findSession = (token) => {
  const session = sessionsByToken.get(token);

  if (!session) {
    return null;
  }

  return expireIfNeeded(session);
};

const requireKioskAccess = (req, res, next) => {
  const expectedKey = process.env.KIOSK_API_KEY;

  if (!expectedKey) {
    return next();
  }

  const providedKey = req.headers["x-kiosk-key"];

  if (providedKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      code: "KIOSK_AUTH_FAILED",
      message: "키오스크 인증 정보가 올바르지 않습니다. 관리자에게 키오스크 API 키 설정을 확인해 주세요.",
    });
  }

  return next();
};

const requireLockerDeviceAccess = (req, res, next) => {
  const expectedKey = process.env.LOCKER_DEVICE_API_KEY;

  if (!expectedKey) {
    return next();
  }

  const providedKey = req.headers["x-locker-device-key"];

  if (providedKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      code: "LOCKER_DEVICE_AUTH_FAILED",
      message: "라즈베리파이 보관함 인증 정보가 올바르지 않습니다.",
    });
  }

  return next();
};

const formatKioskUser = (member) => ({
  id: member.member_id,
  memberId: member.member_id,
  member_id: member.member_id,
  name: member.name,
  nickname: member.nickname,
  email: member.email,
  phone: member.phone,
  roleId: member.role_id,
  role_id: member.role_id,
  dongName: member.dong_name,
  dong_name: member.dong_name,
});

router.post("/qr/kiosk-login", requireKioskAccess, async (req, res) => {
  const token = String(req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "QR 토큰을 입력해주세요.",
    });
  }

  const session = findSession(token);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "유효한 QR 세션을 찾을 수 없습니다.",
    });
  }

  if (session.status !== "active") {
    return res.status(409).json({
      success: false,
      data: toResponseSession(session),
      message: "이미 사용했거나 만료된 QR입니다.",
    });
  }

  try {
    const [members] = await db.query(
      `SELECT member_id, name, nickname, email, phone, role_id, dong_name
       FROM MEMBER
       WHERE member_id = ?`,
      [session.memberId],
    );

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: "QR에 연결된 회원 정보를 찾을 수 없습니다.",
      });
    }

    session.status = "used";
    session.usedAt = new Date().toISOString();

    const kioskSession = {
      kioskSessionId: `kiosk_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      kiosk_session_id: null,
      memberId: session.memberId,
      member_id: session.memberId,
      qrSessionId: session.id,
      qr_session_id: session.id,
      issuedAt: new Date().toISOString(),
      issued_at: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    kioskSession.kiosk_session_id = kioskSession.kioskSessionId;
    kioskSessionsById.set(kioskSession.kioskSessionId, kioskSession);

    return res.status(200).json({
      success: true,
      data: {
        user: formatKioskUser(members[0]),
        qrSession: toResponseSession(session),
        qr_session: toResponseSession(session),
        kioskSession,
        kiosk_session: kioskSession,
      },
      message: "키오스크 QR 로그인에 성공했습니다.",
    });
  } catch (error) {
    console.error("Kiosk QR login error:", error);
    return res.status(500).json({
      success: false,
      message: "키오스크 QR 로그인에 실패했습니다.",
    });
  }
});

router.post("/qr/issue", authenticateToken, async (req, res) => {
  const memberId = String(req.body.memberId || req.body.member_id || getMemberId(req));
  const purpose = normalizePurpose(req.body.purpose);
  const donateId = parsePositiveInteger(req.body.donateId || req.body.donate_id);
  const ttlSeconds = normalizeTtl(req.body.ttlSeconds || req.body.ttl_seconds);
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + ttlSeconds * 1000;

  if (purpose === "donation_storage" && !donateId) {
    return res.status(400).json({
      success: false,
      message: "Donation storage QR requires a donateId.",
    });
  }

  for (const session of sessionsByToken.values()) {
    if (
      session.memberId === memberId &&
      session.purpose === purpose &&
      session.donateId === donateId &&
      session.status === "active"
    ) {
      session.status = "expired";
    }
  }

  let session = null;

  try {
    if (purpose === "donation_storage") {
      const [donateRows] = await db.query(
        `SELECT donate_id, member_id, status
         FROM ITEM_DONATE
         WHERE donate_id = ? AND member_id = ?
         LIMIT 1`,
        [donateId, memberId],
      );

      if (donateRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Selected donation post was not found.",
        });
      }

      if (["completed", "canceled", "stored"].includes(donateRows[0].status)) {
        return res.status(409).json({
          success: false,
          message: "Selected donation post is already closed or stored.",
        });
      }
    }

    const qrCredential = await buildQrCredentials();
    session = {
      id: `qr_${issuedAtMs}`,
      memberId,
      donateId,
      purpose,
      token: qrCredential.token,
      displayCode: qrCredential.displayCode,
      issuedAt: toIsoString(issuedAtMs),
      expiresAt: toIsoString(expiresAtMs),
      status: "active",
      ttlSeconds,
      usedAt: null,
    };

    await db.query(
      `UPDATE DYNAMIC_QR
       SET status = 'expired'
       WHERE member_id = ? AND purpose = ? AND status = 'active'
         AND (donate_id <=> ?)`,
      [memberId, purpose, donateId],
    );
    const [result] = await db.query(
      `INSERT INTO DYNAMIC_QR
        (member_id, donate_id, purpose, token, display_code, status, ttl_seconds, issued_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, donateId, purpose, session.token, session.displayCode, session.status, ttlSeconds, new Date(issuedAtMs), new Date(expiresAtMs)],
    );

    session.id = String(result.insertId);
  } catch (error) {
    console.error("Issue QR DB error:", error);
    return res.status(503).json({
      success: false,
      message: "QR 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
  }

  sessionsByToken.set(session.token, session);

  return res.status(201).json({
    success: true,
    data: toResponseSession(session),
    message: "Dynamic QR issued.",
  });
});

const loadDbQrSession = async (credential) => {
  const token = String(credential || "").trim();
  const displayCode = normalizeDisplayCode(token);
  const [rows] = await db.query(
    `SELECT qr_id, member_id, donate_id, purpose, token, display_code, status,
            issued_at, expires_at, used_at, ttl_seconds
     FROM DYNAMIC_QR
     WHERE token = ? OR (? IS NOT NULL AND display_code = ?)
     ORDER BY issued_at DESC
     LIMIT 1`,
    [token, displayCode, displayCode],
  );

  if (!rows[0]) {
    return null;
  }

  const row = rows[0];
  const session = {
    id: String(row.qr_id),
    memberId: String(row.member_id),
    donateId: row.donate_id ? String(row.donate_id) : null,
    purpose: row.purpose,
    token: row.token,
    displayCode: row.display_code,
    issuedAt: toIsoString(row.issued_at),
    expiresAt: toIsoString(row.expires_at),
    status: row.status,
    ttlSeconds: Number(row.ttl_seconds ?? defaultTtlSeconds),
    usedAt: row.used_at ? toIsoString(row.used_at) : null,
  };

  expireIfNeeded(session);
  if (session.status === "expired" && row.status === "active") {
    await db.query("UPDATE DYNAMIC_QR SET status = 'expired' WHERE qr_id = ?", [row.qr_id]);
  }

  return session;
};

const loadAnyQrSession = async (token, actionLabel) => {
  let session = null;

  try {
    session = await loadDbQrSession(token);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error(`${actionLabel} QR DB error:`, error);
      throw error;
    }
  }

  return session;
};

const loadDonationStorageContext = async (session) => {
  if (session.purpose !== "donation_storage" || !session.donateId) {
    return null;
  }

  try {
    const [rows] = await db.query(
      `SELECT d.donate_id, d.title, d.status, d.dong_name,
              m.member_id, m.name, m.nickname, m.phone
       FROM ITEM_DONATE d
       LEFT JOIN MEMBER m ON m.member_id = d.member_id
       WHERE d.donate_id = ? AND d.member_id = ?
       LIMIT 1`,
      [session.donateId, session.memberId],
    );

    if (!rows[0]) {
      return null;
    }

    const row = rows[0];
    return {
      donation: {
        donateId: String(row.donate_id),
        donate_id: String(row.donate_id),
        title: row.title,
        status: row.status,
        dongName: row.dong_name,
        dong_name: row.dong_name,
      },
      donor: {
        memberId: row.member_id,
        member_id: row.member_id,
        name: row.name,
        nickname: row.nickname,
        phone: row.phone,
      },
    };
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Load donation storage context error:", error);
      throw error;
    }
  }

  return null;
};

const normalizePickupItem = (row) => ({
  pickupId: String(row.pickup_id),
  pickup_id: String(row.pickup_id),
  donateId: String(row.donate_id),
  donate_id: String(row.donate_id),
  requesterId: row.requester_id,
  requester_id: row.requester_id,
  title: row.title,
  status: row.request_status,
  requestStatus: row.request_status,
  request_status: row.request_status,
  postStatus: row.post_status,
  post_status: row.post_status,
  lockerId: row.locker_id || defaultLockerId,
  locker_id: row.locker_id || defaultLockerId,
  lockerNumber: row.locker_number || "1번 보관함",
  locker_number: row.locker_number || "1번 보관함",
  donorId: row.donor_id,
  donor_id: row.donor_id,
  requestedAt: row.requested_at,
  requested_at: row.requested_at,
});

const findPickupItemForMember = async ({ pickupId, donateId, requesterId }) => {
  const params = [requesterId];
  const conditions = ["p.requester_id = ?"];

  if (pickupId) {
    conditions.push("p.pickup_id = ?");
    params.push(pickupId);
  }

  if (donateId) {
    conditions.push("p.donate_id = ?");
    params.push(donateId);
  }

  const [rows] = await db.query(
    `SELECT p.pickup_id, p.donate_id, p.requester_id, p.request_status,
            p.requested_at, d.member_id AS donor_id, d.title,
            d.status AS post_status,
            ? AS locker_id,
            '1번 보관함' AS locker_number
     FROM PICKUP_REQUEST p
     JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
     WHERE ${conditions.join(" AND ")}
       AND p.request_status IN ('pending', 'approved', 'completed')
     ORDER BY p.pickup_id DESC
     LIMIT 1`,
    [defaultLockerId, ...params],
  );

  return rows[0] ? normalizePickupItem(rows[0]) : null;
};

const approveLockerPickupItem = async (connection, item) => {
  if (item.status === "approved") {
    return {
      ...item,
      status: "approved",
      requestStatus: "approved",
      request_status: "approved",
    };
  }

  if (item.status !== "pending") {
    const error = new Error("이미 처리된 수령 요청입니다.");
    error.statusCode = 409;
    error.code = "LOCKER_PICKUP_REQUEST_NOT_PENDING";
    throw error;
  }

  try {
    await connection.query(
      `UPDATE PICKUP_REQUEST
       SET request_status = 'approved',
           approved_at = NOW(),
           chat_synced = FALSE
       WHERE pickup_id = ?`,
      [item.pickupId],
    );
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
    await connection.query(
      "UPDATE PICKUP_REQUEST SET request_status = 'approved' WHERE pickup_id = ?",
      [item.pickupId],
    );
  }

  try {
    await connection.query(
      `INSERT INTO NOTIFICATION
        (member_id, related_type, related_id, notification_type, message, is_read, created_at)
       VALUES (?, 'pickup', ?, 'pickup_approved', ?, FALSE, NOW())`,
      [
        item.requesterId,
        item.pickupId,
        item.postStatus === "stored"
          ? "물품 수령이 수락되었습니다. 키오스크에서 물품 찾기를 진행해주세요."
          : "물품 수령 요청이 수락되었습니다. 물품이 보관함에 입고되면 키오스크에서 찾을 수 있습니다.",
      ],
    );
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      throw error;
    }
  }

  return {
    ...item,
    status: "approved",
    requestStatus: "approved",
    request_status: "approved",
  };
};

const ensureUsableDonationStorageSession = (session, res) => {
  if (!session) {
    res.status(404).json({
      success: false,
      code: "QR_NOT_FOUND",
      message: "DB에서 이 QR 토큰을 찾지 못했습니다. 앱에서 보관함 QR을 새로 발급해 주세요.",
    });
    return false;
  }

  if (session.purpose !== "donation_storage") {
    res.status(409).json({
      success: false,
      data: toResponseSession(session),
      code: "QR_WRONG_PURPOSE",
      message: "이 QR은 보관함 입고용 QR이 아닙니다. 앱의 보관함 QR 발급 메뉴에서 다시 발급해 주세요.",
    });
    return false;
  }

  if (session.status !== "active") {
    res.status(409).json({
      success: false,
      data: toResponseSession(session),
      code: session.status === "expired" ? "QR_EXPIRED" : "QR_ALREADY_USED",
      message: session.status === "expired"
        ? "QR 유효 시간이 만료되었습니다. 앱에서 새 QR을 발급해 주세요."
        : "이미 사용된 QR입니다. 앱에서 새 QR을 발급해 주세요.",
    });
    return false;
  }

  return true;
};
router.post("/qr/validate", authenticateToken, async (req, res) => {
  const token = String(req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      code: "QR_EMPTY",
      message: "QR 토큰을 입력해주세요.",
    });
  }

  let session = null;
  try {
    session = await loadDbQrSession(token);
  } catch (error) {
    console.error("Validate QR DB error:", error);
    return res.status(503).json({
      success: false,
      code: "QR_DB_ERROR",
      message: "QR 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
  }

  if (!session) {
    return res.status(404).json({
      success: false,
      code: "QR_NOT_FOUND",
      message: "유효한 QR 세션을 찾을 수 없습니다.",
    });
  }

  if (session.status !== "active") {
    return res.status(409).json({
      success: false,
      data: toResponseSession(session),
      code: session.status === "expired" ? "QR_EXPIRED" : "QR_ALREADY_USED",
      message: session.status === "expired"
        ? "QR이 만료되었습니다. 다시 발급해주세요."
        : "이미 사용된 QR입니다.",
    });
  }

  return res.status(200).json({
    success: true,
    data: toResponseSession(session),
    message: "QR 검증에 성공했습니다.",
  });
});

router.post("/qr/storage/validate", requireKioskAccess, async (req, res) => {
  const token = String(req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      code: "QR_EMPTY",
      message: "QR에서 토큰을 읽지 못했습니다. 앱에서 생성한 보관함 QR을 카메라 안에 맞춰 주세요.",
    });
  }

  let session = null;
  try {
    session = await loadAnyQrSession(token, "Kiosk storage validate");
  } catch (error) {
    console.error("Kiosk storage validate DB error:", error);
    return res.status(500).json({
      success: false,
      code: "QR_DB_ERROR",
      message: "QR 세션 DB를 확인하는 중 오류가 발생했습니다. 네트워크와 Render 백엔드 상태를 확인한 뒤 다시 시도해 주세요.",
    });
  }

  if (!ensureUsableDonationStorageSession(session, res)) {
    return;
  }

  let context = null;
  try {
    context = await loadDonationStorageContext(session);
  } catch (error) {
    console.error("Kiosk donation context DB error:", error);
    return res.status(500).json({
      success: false,
      code: "DONATION_LOOKUP_FAILED",
      message: "QR은 읽었지만 연결된 나눔 게시글 정보를 불러오지 못했습니다. 게시글 상태와 DB 연결을 확인해 주세요.",
    });
  }

  if (!context) {
    return res.status(404).json({
      success: false,
      code: "DONATION_NOT_FOUND",
      message: "QR은 유효하지만 연결된 나눔 게시글을 찾지 못했습니다. 앱에서 새 보관함 QR을 발급해 주세요.",
    });
  }

  const lockerCommand = queueLockerCommand(defaultLockerId, "OPEN_FOR_STORAGE", {
    qrSessionId: session.id,
    qr_session_id: session.id,
    donateId: session.donateId,
    donate_id: session.donateId,
    memberId: session.memberId,
    member_id: session.memberId,
  });

  return res.status(200).json({
    success: true,
    data: {
      qrSession: toResponseSession(session),
      qr_session: toResponseSession(session),
      lockerCommand,
      locker_command: lockerCommand,
      ...(context || {}),
    },
    message: "Storage QR validation succeeded. Locker open command queued.",
  });
});
router.post("/qr/consume", authenticateToken, async (req, res) => {
  const token = String(req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "QR 토큰을 입력해주세요.",
    });
  }

  let session = null;
  try {
    session = await loadDbQrSession(token);
  } catch (error) {
    console.error("Consume QR DB error:", error);
    return res.status(503).json({
      success: false,
      message: "QR 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
  }

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "유효한 QR 세션을 찾을 수 없습니다.",
    });
  }

  if (session.status !== "active") {
    return res.status(409).json({
      success: false,
      data: toResponseSession(session),
      message: "이미 사용했거나 만료된 QR입니다.",
    });
  }

  session.status = "used";
  session.usedAt = new Date().toISOString();

  try {
    await db.query(
      "UPDATE DYNAMIC_QR SET status = 'used', used_at = NOW() WHERE token = ?",
      [session.token],
    );

    if (session.purpose === "donation_storage" && session.donateId) {
      await db.query(
        `UPDATE ITEM_DONATE
         SET status = 'stored', updated_at = NOW()
         WHERE donate_id = ? AND member_id = ?`,
        [session.donateId, session.memberId],
      );
    }
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Consume QR update DB error:", error);
      return res.status(500).json({
        success: false,
        message: "QR 사용 처리에 실패했습니다.",
      });
    }
  }

  return res.status(200).json({
    success: true,
    data: toResponseSession(session),
    message: "QR 사용 처리가 완료되었습니다.",
  });
});

router.post("/qr/storage/consume", requireKioskAccess, async (req, res) => {
  const token = String(req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      code: "QR_EMPTY",
      message: "QR에서 토큰을 읽지 못했습니다. 앱에서 생성한 보관함 QR을 카메라 안에 맞춰 주세요.",
    });
  }

  let session = null;
  try {
    session = await loadAnyQrSession(token, "Kiosk storage consume");
  } catch (error) {
    console.error("Kiosk storage consume DB error:", error);
    return res.status(500).json({
      success: false,
      code: "QR_CONSUME_FAILED",
      message: "물품 보관 완료를 DB에 반영하지 못했습니다. 물품을 꺼내지 말고 관리자에게 상태 확인을 요청해 주세요.",
    });
  }

  if (!ensureUsableDonationStorageSession(session, res)) {
    return;
  }

  session.status = "used";
  session.usedAt = new Date().toISOString();

  try {
    await db.query(
      "UPDATE DYNAMIC_QR SET status = 'used', used_at = NOW() WHERE token = ?",
      [session.token],
    );

    await db.query(
      `UPDATE ITEM_DONATE
       SET status = 'stored', updated_at = NOW()
       WHERE donate_id = ? AND member_id = ?`,
      [session.donateId, session.memberId],
    );
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Kiosk storage consume update DB error:", error);
      return res.status(500).json({
        success: false,
        code: "QR_CONSUME_FAILED",
        message: "물품 보관 완료를 DB에 반영하지 못했습니다. 물품을 꺼내지 말고 관리자에게 상태 확인을 요청해 주세요.",
      });
    }
  }

  let context = null;
  try {
    context = await loadDonationStorageContext(session);
  } catch {
    context = null;
  }

  const lockerCommand = queueLockerCommand(defaultLockerId, "CLOSE_WITH_ITEM_LED_ON", {
    qrSessionId: session.id,
    qr_session_id: session.id,
    donateId: session.donateId,
    donate_id: session.donateId,
    memberId: session.memberId,
    member_id: session.memberId,
  });

  return res.status(200).json({
    success: true,
    data: {
      qrSession: toResponseSession(session),
      qr_session: toResponseSession(session),
      lockerCommand,
      locker_command: lockerCommand,
      ...(context || {}),
    },
    message: "Donation storage was completed. Locker close command queued.",
  });
});

router.get("/locker/status", requireKioskAccess, (req, res) => {
  const lockerId = normalizeLockerId(req.query.lockerId || req.query.locker_id);

  return res.status(200).json({
    success: true,
    data: getLockerState(lockerId),
  });
});

router.post("/locker/status", requireLockerDeviceAccess, (req, res) => {
  const lockerId = normalizeLockerId(req.body.lockerId || req.body.locker_id);
  const state = updateLockerState(lockerId, req.body || {});

  return res.status(200).json({
    success: true,
    data: state,
  });
});

router.get("/locker/commands/next", requireLockerDeviceAccess, (req, res) => {
  const lockerId = normalizeLockerId(req.query.lockerId || req.query.locker_id);
  const queue = getLockerQueue(lockerId);
  const now = Date.now();
  const command = queue.find((item) => isCommandReadyForDelivery(item, now));

  if (!command) {
    return res.status(200).json({
      success: true,
      data: null,
      message: "No pending locker command.",
    });
  }

  const deliveryAttempts = Number(command.deliveryAttempts || command.delivery_attempts || 0) + 1;
  command.status = "delivered";
  command.deliveredAt = new Date(now).toISOString();
  command.delivered_at = command.deliveredAt;
  command.deliveryAttempts = deliveryAttempts;
  command.delivery_attempts = deliveryAttempts;

  return res.status(200).json({
    success: true,
    data: command,
  });
});

router.post("/locker/commands/:id/ack", requireLockerDeviceAccess, (req, res) => {
  const command = lockerCommandsById.get(req.params.id);

  if (!command) {
    return res.status(404).json({
      success: false,
      code: "LOCKER_COMMAND_NOT_FOUND",
      message: "보관함 명령을 찾을 수 없습니다.",
    });
  }

  command.status = req.body.success === false ? "failed" : "acknowledged";
  command.acknowledgedAt = new Date().toISOString();
  command.acknowledged_at = command.acknowledgedAt;
  command.error = req.body.error || null;

  const state = updateLockerState(command.lockerId, {
    ...(req.body.state || {}),
    lastCommandId: command.id,
  });

  return res.status(200).json({
    success: true,
    data: {
      command,
      state,
    },
  });
});

router.get("/locker/pickup/items", authenticateToken, async (req, res) => {
  const requesterId = getMemberId(req);

  try {
    const [rows] = await db.query(
      `SELECT p.pickup_id, p.donate_id, p.requester_id, p.request_status,
              p.requested_at, d.member_id AS donor_id, d.title,
              d.status AS post_status,
              ? AS locker_id,
              '1번 보관함' AS locker_number
       FROM PICKUP_REQUEST p
       JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
       WHERE p.requester_id = ?
         AND p.request_status IN ('pending', 'approved')
         AND d.status IN ('reserved', 'stored')
       ORDER BY p.pickup_id DESC`,
      [defaultLockerId, requesterId],
    );
    const items = rows.map(normalizePickupItem);
    const availableItems = items.filter(
      (item) => item.status === "approved" && pickupAccessiblePostStatuses.has(item.postStatus),
    );
    const pendingItems = items.filter(
      (item) => item.status === "pending" ||
        (item.status === "approved" && !pickupAccessiblePostStatuses.has(item.postStatus)),
    );

    return res.status(200).json({
      success: true,
      data: {
        items: availableItems,
        pendingItems,
        pending_items: pendingItems,
      },
    });
  } catch (error) {
    console.error("Locker pickup items error:", error);
    return res.status(500).json({
      success: false,
      message: "수령 가능한 보관함 물품을 불러오지 못했습니다.",
    });
  }
});

router.get("/locker/pickup/requests/by-donation/:id", authenticateToken, async (req, res) => {
  const donorId = getMemberId(req);
  const donateId = parsePositiveInteger(req.params.id);

  if (!donateId) {
    return res.status(400).json({
      success: false,
      code: "DONATION_ID_REQUIRED",
      message: "나눔글 번호가 올바르지 않습니다.",
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT p.pickup_id, p.donate_id, p.requester_id, p.request_status,
              p.requested_at, d.member_id AS donor_id, d.title,
              d.status AS post_status,
              ? AS locker_id,
              '1번 보관함' AS locker_number
       FROM ITEM_DONATE d
       LEFT JOIN PICKUP_REQUEST p
         ON p.donate_id = d.donate_id
        AND p.request_status IN ('pending', 'approved')
       WHERE d.donate_id = ?
         AND d.member_id = ?
       ORDER BY p.pickup_id DESC
       LIMIT 1`,
      [defaultLockerId, donateId, donorId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        code: "DONATION_NOT_FOUND",
        message: "나눔글을 찾지 못했습니다.",
      });
    }

    if (!rows[0].pickup_id) {
      return res.status(200).json({
        success: true,
        data: { item: null },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        item: normalizePickupItem(rows[0]),
      },
    });
  } catch (error) {
    console.error("Locker pickup request by donation error:", error);
    return res.status(500).json({
      success: false,
      message: "나눔글의 수령 요청을 불러오지 못했습니다.",
    });
  }
});

router.post("/locker/pickup/requests/by-donation/:id/approve", authenticateToken, async (req, res) => {
  const donorId = getMemberId(req);
  const donateId = parsePositiveInteger(req.params.id);

  if (!donateId) {
    return res.status(400).json({
      success: false,
      code: "DONATION_ID_REQUIRED",
      message: "나눔글 번호가 올바르지 않습니다.",
    });
  }

  let connection;
  let committed = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT p.pickup_id, p.donate_id, p.requester_id, p.request_status,
              p.requested_at, d.member_id AS donor_id, d.title,
              d.status AS post_status,
              ? AS locker_id,
              '1번 보관함' AS locker_number
       FROM PICKUP_REQUEST p
       JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
       WHERE p.donate_id = ?
         AND d.member_id = ?
         AND p.request_status IN ('pending', 'approved')
       ORDER BY p.pickup_id DESC
       LIMIT 1
       FOR UPDATE`,
      [defaultLockerId, donateId, donorId],
    );
    const item = rows[0] ? normalizePickupItem(rows[0]) : null;

    if (!item) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        code: "LOCKER_PICKUP_REQUEST_NOT_FOUND",
        message: "수락할 예약 요청을 찾지 못했습니다.",
      });
    }

    if (!pickupApprovalPostStatuses.has(item.postStatus)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        code: "LOCKER_PICKUP_POST_NOT_APPROVABLE",
        message: "예약 또는 입고 상태의 나눔글만 수령 요청을 수락할 수 있습니다.",
      });
    }

    const approvedItem = await approveLockerPickupItem(connection, item);

    await connection.commit();
    committed = true;

    return res.status(200).json({
      success: true,
      data: { item: approvedItem },
      message: "물품 수령 요청을 수락했습니다.",
    });
  } catch (error) {
    if (connection && !committed) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.warn("Locker pickup approve by donation rollback failed:", rollbackError.message);
      }
    }
    console.error("Locker pickup approve by donation error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.statusCode ? error.message : "물품 수령 요청 수락에 실패했습니다.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post("/locker/pickup/requests/:id/approve", authenticateToken, async (req, res) => {
  const donorId = getMemberId(req);
  const pickupId = parsePositiveInteger(req.params.id);

  if (!pickupId) {
    return res.status(400).json({
      success: false,
      code: "LOCKER_PICKUP_REQUEST_ID_REQUIRED",
      message: "수락할 수령 요청 번호가 올바르지 않습니다.",
    });
  }

  let connection;
  let committed = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT p.pickup_id, p.donate_id, p.requester_id, p.request_status,
              p.requested_at, d.member_id AS donor_id, d.title,
              d.status AS post_status,
              ? AS locker_id,
              '1번 보관함' AS locker_number
       FROM PICKUP_REQUEST p
       JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
       WHERE p.pickup_id = ?
       LIMIT 1
       FOR UPDATE`,
      [defaultLockerId, pickupId],
    );
    const item = rows[0] ? normalizePickupItem(rows[0]) : null;

    if (!item) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        code: "LOCKER_PICKUP_REQUEST_NOT_FOUND",
        message: "수령 요청을 찾지 못했습니다.",
      });
    }

    if (Number(item.donorId) !== Number(donorId)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        code: "LOCKER_PICKUP_APPROVAL_FORBIDDEN",
        message: "이 수령 요청을 수락할 권한이 없습니다.",
      });
    }

    if (!pickupApprovalPostStatuses.has(item.postStatus)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        code: "LOCKER_PICKUP_POST_NOT_APPROVABLE",
        message: "예약 또는 입고 상태의 나눔글만 수령 요청을 수락할 수 있습니다.",
      });
    }

    if (item.status === "approved") {
      await connection.commit();
      committed = true;
      return res.status(200).json({
        success: true,
        data: {
          item: {
            ...item,
            status: "approved",
            requestStatus: "approved",
            request_status: "approved",
          },
        },
        message: "이미 수락된 수령 요청입니다.",
      });
    }

    const approvedItem = await approveLockerPickupItem(connection, item);

    await connection.commit();
    committed = true;

    return res.status(200).json({
      success: true,
      data: {
        item: approvedItem,
      },
      message: "물품 수령 요청을 수락했습니다.",
    });
  } catch (error) {
    if (connection && !committed) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.warn("Locker pickup approve rollback failed:", rollbackError.message);
      }
    }
    console.error("Locker pickup approve error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.statusCode ? error.message : "물품 수령 요청 수락에 실패했습니다.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post("/locker/pickup/open", authenticateToken, async (req, res) => {
  const requesterId = getMemberId(req);
  const pickupId = parsePositiveInteger(req.body.pickupId || req.body.pickup_id);
  const donateId = parsePositiveInteger(req.body.donateId || req.body.donate_id);
  const lockerId = normalizeLockerId(req.body.lockerId || req.body.locker_id);

  if (!pickupId && !donateId) {
    return res.status(400).json({
      success: false,
      code: "LOCKER_PICKUP_ITEM_REQUIRED",
      message: "수령할 보관함 물품을 선택해 주세요.",
    });
  }

  try {
    const item = await findPickupItemForMember({ pickupId, donateId, requesterId });

    if (!item || !["pending", "approved"].includes(item.status)) {
      return res.status(404).json({
        success: false,
        code: "LOCKER_PICKUP_ITEM_NOT_FOUND",
        message: "수령 가능한 보관함 물품을 찾지 못했습니다.",
      });
    }

    if (item.status !== "approved") {
      return res.status(409).json({
        success: false,
        code: "LOCKER_PICKUP_APPROVAL_REQUIRED",
        message: "기부자가 물품 수령을 수락한 뒤 보관함을 열 수 있습니다.",
      });
    }

    if (!pickupAccessiblePostStatuses.has(item.postStatus)) {
      return res.status(409).json({
        success: false,
        code: "LOCKER_PICKUP_STORAGE_REQUIRED",
        message: "아직 보관함 입고가 완료되지 않았습니다. 기부자가 물품을 보관한 뒤 다시 시도해 주세요.",
      });
    }

    const lockerCommand = queueLockerCommand(lockerId, "OPEN_FOR_PICKUP", {
      pickupId: item.pickupId,
      pickup_id: item.pickupId,
      donateId: item.donateId,
      donate_id: item.donateId,
      requesterId,
      requester_id: requesterId,
    });

    return res.status(200).json({
      success: true,
      data: {
        item,
        lockerCommand,
        locker_command: lockerCommand,
      },
      message: "보관함 열림 명령을 보냈습니다.",
    });
  } catch (error) {
    console.error("Locker pickup open error:", error);
    return res.status(500).json({
      success: false,
      message: "보관함 열림 명령을 처리하지 못했습니다.",
    });
  }
});

router.post("/locker/pickup/complete", authenticateToken, async (req, res) => {
  const requesterId = getMemberId(req);
  const pickupId = parsePositiveInteger(req.body.pickupId || req.body.pickup_id);
  const donateId = parsePositiveInteger(req.body.donateId || req.body.donate_id);
  const lockerId = normalizeLockerId(req.body.lockerId || req.body.locker_id);

  if (!pickupId && !donateId) {
    return res.status(400).json({
      success: false,
      code: "LOCKER_PICKUP_ITEM_REQUIRED",
      message: "수령 완료 처리할 보관함 물품을 선택해 주세요.",
    });
  }

  let connection;
  let item = null;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const params = [requesterId];
    const conditions = ["p.requester_id = ?"];

    if (pickupId) {
      conditions.push("p.pickup_id = ?");
      params.push(pickupId);
    }

    if (donateId) {
      conditions.push("p.donate_id = ?");
      params.push(donateId);
    }

    const [rows] = await connection.query(
      `SELECT p.pickup_id, p.donate_id, p.requester_id, p.request_status,
              p.requested_at, d.member_id AS donor_id, d.title,
              d.status AS post_status,
              ? AS locker_id,
              '1번 보관함' AS locker_number
       FROM PICKUP_REQUEST p
       JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
       WHERE ${conditions.join(" AND ")}
       LIMIT 1
       FOR UPDATE`,
      [lockerId, ...params],
    );

    item = rows[0] ? normalizePickupItem(rows[0]) : null;

    if (!item || item.status !== "approved") {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        code: "LOCKER_PICKUP_ITEM_NOT_FOUND",
        message: "수령 완료 처리할 보관함 물품을 찾지 못했습니다.",
      });
    }

    if (!pickupAccessiblePostStatuses.has(item.postStatus)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        code: "LOCKER_PICKUP_STORAGE_REQUIRED",
        message: "아직 보관함 입고가 완료되지 않아 수령 완료 처리할 수 없습니다.",
      });
    }

    try {
      await connection.query(
        `UPDATE PICKUP_REQUEST
         SET request_status = 'completed',
             pickup_at = NOW(),
             resolved_at = NOW(),
             chat_synced = FALSE
         WHERE pickup_id = ?`,
        [item.pickupId],
      );
    } catch (error) {
      if (error?.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }
      await connection.query(
        "UPDATE PICKUP_REQUEST SET request_status = 'completed' WHERE pickup_id = ?",
        [item.pickupId],
      );
    }

    await connection.query(
      "UPDATE ITEM_DONATE SET status = 'completed', updated_at = NOW() WHERE donate_id = ?",
      [item.donateId],
    );

    try {
      await connection.query(
        `INSERT INTO NOTIFICATION
          (member_id, related_type, related_id, notification_type, message, is_read, created_at)
         VALUES (?, 'pickup', ?, 'pickup_completed', ?, FALSE, NOW())`,
        [
          item.donorId,
          item.pickupId,
          "물품 수령이 완료되었습니다.",
        ],
      );
    } catch (error) {
      if (error?.code !== "ER_NO_SUCH_TABLE") {
        throw error;
      }
    }

    await connection.commit();

    const lockerCommand = queueLockerCommand(lockerId, "CLOSE_EMPTY_LED_OFF", {
      pickupId: item.pickupId,
      pickup_id: item.pickupId,
      donateId: item.donateId,
      donate_id: item.donateId,
      requesterId,
      requester_id: requesterId,
      donorId: item.donorId,
      donor_id: item.donorId,
    });

    return res.status(200).json({
      success: true,
      data: {
        item: {
          ...item,
          status: "completed",
          requestStatus: "completed",
          request_status: "completed",
          postStatus: "completed",
          post_status: "completed",
        },
        lockerCommand,
        locker_command: lockerCommand,
      },
      message: "물품 수령 완료 처리와 보관함 닫힘 명령이 완료되었습니다.",
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.warn("Locker pickup complete rollback failed:", rollbackError.message);
      }
    }
    console.error("Locker pickup complete error:", error);
    return res.status(500).json({
      success: false,
      message: "물품 수령 완료 처리에 실패했습니다.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get("/relay", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      locked: true,
      message: "잠금 대기 상태입니다.",
    },
  });
});

router.get("/sensor", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      itemDetected: false,
      message: "물품 감지 대기 중입니다.",
    },
  });
});

module.exports = router;
