const crypto = require("crypto");
const express = require("express");
const authenticateToken = require("../middlewares/authMiddleware");
const db = require("../db");

const router = express.Router();
const sessionsByToken = new Map();
const kioskSessionsById = new Map();

const defaultTtlSeconds = 30;

const getMemberId = (req) => req.user.member_id || req.user.id;

const toIsoString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

const normalizePurpose = (purpose) => {
  if (purpose === "pickup_access") {
    return "pickup_access";
  }

  return "donation_access";
};

const normalizeTtl = (rawValue) => {
  const ttl = Number(rawValue);

  if (!Number.isFinite(ttl) || ttl <= 0) {
    return defaultTtlSeconds;
  }

  return Math.min(Math.floor(ttl), 300);
};

const buildDisplayCode = () => {
  const seed = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `GIVE-${seed.slice(0, 4)}-${seed.slice(4, 8)}-${seed.slice(8, 12)}`;
};

const toResponseSession = (session) => ({
  id: session.id,
  memberId: session.memberId,
  member_id: session.memberId,
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
      message: "키오스크 인증 정보가 올바르지 않습니다.",
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
      message: "이미 사용되었거나 만료된 QR입니다.",
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

router.post("/qr/issue", authenticateToken, (req, res) => {
  const memberId = String(req.body.memberId || req.body.member_id || getMemberId(req));
  const purpose = normalizePurpose(req.body.purpose);
  const ttlSeconds = normalizeTtl(req.body.ttlSeconds || req.body.ttl_seconds);
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + ttlSeconds * 1000;

  for (const session of sessionsByToken.values()) {
    if (session.memberId === memberId && session.purpose === purpose && session.status === "active") {
      session.status = "expired";
    }
  }

  const token = `give|${purpose}|${memberId}|${issuedAtMs}|${expiresAtMs}|${crypto.randomUUID()}`;
  const session = {
    id: `qr_${issuedAtMs}`,
    memberId,
    purpose,
    token,
    displayCode: buildDisplayCode(),
    issuedAt: toIsoString(issuedAtMs),
    expiresAt: toIsoString(expiresAtMs),
    status: "active",
    ttlSeconds,
    usedAt: null,
  };

  sessionsByToken.set(token, session);

  return res.status(201).json({
    success: true,
    data: toResponseSession(session),
    message: "동적 QR이 발급되었습니다.",
  });
});

router.post("/qr/validate", authenticateToken, (req, res) => {
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
      message: "이미 사용되었거나 만료된 QR입니다.",
    });
  }

  return res.status(200).json({
    success: true,
    data: toResponseSession(session),
    message: "QR 검증에 성공했습니다.",
  });
});

router.post("/qr/consume", authenticateToken, (req, res) => {
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
      message: "이미 사용되었거나 만료된 QR입니다.",
    });
  }

  session.status = "used";
  session.usedAt = new Date().toISOString();

  return res.status(200).json({
    success: true,
    data: toResponseSession(session),
    message: "QR 사용 처리가 완료되었습니다.",
  });
});

router.get("/relay", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      locked: true,
      message: "잠금 유지 상태입니다.",
    },
  });
});

router.get("/sensor", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      itemDetected: false,
      message: "물품 감지를 대기 중입니다.",
    },
  });
});

module.exports = router;
