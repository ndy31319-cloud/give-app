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

  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const parsed = Number(normalizedValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
      message: "?§Ïò§?§ÌÅ¨ ?∏Ï¶ù ?ïÎ≥¥Í∞Ä ?¨Î∞îÎ•¥Ï? ?äÏäµ?àÎã§.",
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
      message: "QR ?†ÌÅ∞???ÖÎ†•?¥Ï£º?∏Ïöî.",
    });
  }

  const session = findSession(token);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "?†Ìö®??QR ?∏ÏÖò??Ï∞æÏùÑ ???ÜÏäµ?àÎã§.",
    });
  }

  if (session.status !== "active") {
    return res.status(409).json({
      success: false,
      data: toResponseSession(session),
      message: "?¥Î? ?¨Ïö©?òÏóàÍ±∞ÎÇò ÎßåÎ£å??QR?ÖÎãà??",
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
        message: "QR???∞Í≤∞???åÏõê ?ïÎ≥¥Î•?Ï∞æÏùÑ ???ÜÏäµ?àÎã§.",
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
      message: "?§Ïò§?§ÌÅ¨ QR Î°úÍ∑∏?∏Ïóê ?±Í≥µ?àÏäµ?àÎã§.",
    });
  } catch (error) {
    console.error("Kiosk QR login error:", error);
    return res.status(500).json({
      success: false,
      message: "?§Ïò§?§ÌÅ¨ QR Î°úÍ∑∏?∏Ïóê ?§Ìå®?àÏäµ?àÎã§.",
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

  const token = ["give", purpose, memberId, donateId || "none", issuedAtMs, expiresAtMs, crypto.randomUUID()].join("|");
  const session = {
    id: `qr_${issuedAtMs}`,
    memberId,
    donateId,
    purpose,
    token,
    displayCode: buildDisplayCode(),
    issuedAt: toIsoString(issuedAtMs),
    expiresAt: toIsoString(expiresAtMs),
    status: "active",
    ttlSeconds,
    usedAt: null,
  };

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
      [memberId, donateId, purpose, token, session.displayCode, session.status, ttlSeconds, new Date(issuedAtMs), new Date(expiresAtMs)],
    );

    session.id = String(result.insertId);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Issue QR DB error:", error);
      return res.status(500).json({
        success: false,
        message: "Dynamic QR issue failed.",
      });
    }
  }

  sessionsByToken.set(token, session);

  return res.status(201).json({
    success: true,
    data: toResponseSession(session),
    message: "Dynamic QR issued.",
  });
});

const loadDbQrSession = async (token) => {
  const [rows] = await db.query(
    `SELECT qr_id, member_id, donate_id, purpose, token, display_code, status,
            issued_at, expires_at, used_at, ttl_seconds
     FROM DYNAMIC_QR
     WHERE token = ?
     LIMIT 1`,
    [token],
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

router.post("/qr/validate", authenticateToken, async (req, res) => {
  const token = String(req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "QR ≈‰≈´¿ª ¿‘∑¬«ÿ¡÷ººø‰.",
    });
  }

  let session = null;
  try {
    session = await loadDbQrSession(token);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Validate QR DB error:", error);
      return res.status(500).json({
        success: false,
        message: "QR ∞À¡ıø° Ω«∆–«ﬂΩ¿¥œ¥Ÿ.",
      });
    }
  }

  if (!session) {
    session = findSession(token);
  }

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "¿Ø»ø«— QR ººº«¿ª √£¿ª ºˆ æ¯Ω¿¥œ¥Ÿ.",
    });
  }

  if (session.status !== "active") {
    return res.status(409).json({
      success: false,
      data: toResponseSession(session),
      message: "¿ÃπÃ ªÁøÎ«ﬂ∞≈≥™ ∏∏∑·µ» QR¿‘¥œ¥Ÿ.",
    });
  }

  return res.status(200).json({
    success: true,
    data: toResponseSession(session),
    message: "QR ∞À¡ıø° º∫∞¯«ﬂΩ¿¥œ¥Ÿ.",
  });
});

router.post("/qr/consume", authenticateToken, async (req, res) => {
  const token = String(req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "QR ≈‰≈´¿ª ¿‘∑¬«ÿ¡÷ººø‰.",
    });
  }

  let session = null;
  try {
    session = await loadDbQrSession(token);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Consume QR DB error:", error);
      return res.status(500).json({
        success: false,
        message: "QR ªÁøÎ √≥∏Æø° Ω«∆–«ﬂΩ¿¥œ¥Ÿ.",
      });
    }
  }

  if (!session) {
    session = findSession(token);
  }

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "¿Ø»ø«— QR ººº«¿ª √£¿ª ºˆ æ¯Ω¿¥œ¥Ÿ.",
    });
  }

  if (session.status !== "active") {
    return res.status(409).json({
      success: false,
      data: toResponseSession(session),
      message: "¿ÃπÃ ªÁøÎ«ﬂ∞≈≥™ ∏∏∑·µ» QR¿‘¥œ¥Ÿ.",
    });
  }

  session.status = "used";
  session.usedAt = new Date().toISOString();

  try {
    await db.query(
      "UPDATE DYNAMIC_QR SET status = 'used', used_at = NOW() WHERE token = ?",
      [token],
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
        message: "QR ªÁøÎ √≥∏Æø° Ω«∆–«ﬂΩ¿¥œ¥Ÿ.",
      });
    }
  }

  return res.status(200).json({
    success: true,
    data: toResponseSession(session),
    message: "QR ªÁøÎ √≥∏Æ∞° øœ∑·µ«æ˙Ω¿¥œ¥Ÿ.",
  });
});

router.get("/relay", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      locked: true,
      message: "?†Í∏à ?†Ï? ?ÅÌÉú?ÖÎãà??",
    },
  });
});

router.get("/sensor", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      itemDetected: false,
      message: "Î¨ºÌíà Í∞êÏ?Î•??ÄÍ∏?Ï§ëÏûÖ?àÎã§.",
    },
  });
});

module.exports = router;
