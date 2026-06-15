const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");
const { buildUploadUrl } = require("../lib/uploadUrl");

const inMemoryContacts = [];

const getMemberId = (req) => req.user.member_id || req.user.id;

const toIsoString = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

const normalizeUploadUrl = (req, imageUrl) => {
  return buildUploadUrl(req, imageUrl);
};

const mapDonateStatus = (status) => {
  if (status === "completed") return "completed";
  if (status === "canceled") return "canceled";
  return "inProgress";
};

const buildDisplayCode = (value) => {
  let hash = 2166136261;
  const source = String(value || Date.now());

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const seed = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `GIVE-${seed.slice(0, 4)}-${seed.slice(4, 8)}`;
};

const getLatestActiveQr = async (memberId) => {
  try {
    const [rows] = await db.query(
      `SELECT qr_id, member_id, purpose, token, display_code, status, issued_at, expires_at, used_at, ttl_seconds
       FROM DYNAMIC_QR
       WHERE member_id = ? AND status = 'active'
       ORDER BY issued_at DESC
       LIMIT 1`,
      [memberId],
    );

    return rows[0] || null;
  } catch {
    return null;
  }
};

const getShareCount = async (memberId) => {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM ITEM_DONATE WHERE member_id = ?",
    [memberId],
  );
  return Number(rows[0]?.count ?? 0);
};

const getRequestCount = async (memberId) => {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM ITEM_REQUEST WHERE member_id = ?",
    [memberId],
  );
  return Number(rows[0]?.count ?? 0);
};

router.get("/summary", authenticateToken, async (req, res) => {
  const memberId = getMemberId(req);

  try {
    const [memberRows] = await db.query(
      `SELECT member_id, name, nickname, email, phone, role_id, dong_name,
              bio, profile_image, created_at
       FROM MEMBER
       WHERE member_id = ?`,
      [memberId],
    );

    if (memberRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "?뚯썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.",
      });
    }

    const member = memberRows[0];
    const [shareCount, requestCount, activeQr] = await Promise.all([
      getShareCount(memberId),
      getRequestCount(memberId),
      getLatestActiveQr(memberId),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        user: {
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
          profileImage: member.profile_image,
          profile_image: member.profile_image,
          bio: member.bio,
          createdAt: toIsoString(member.created_at),
          created_at: toIsoString(member.created_at),
        },
        counts: {
          shares: shareCount,
          requests: requestCount,
        },
        activeQr: activeQr
          ? {
              id: String(activeQr.qr_id),
              memberId: activeQr.member_id,
              member_id: activeQr.member_id,
              purpose: activeQr.purpose,
              token: activeQr.token,
              displayCode: activeQr.display_code || buildDisplayCode(activeQr.token),
              display_code: activeQr.display_code || buildDisplayCode(activeQr.token),
              status: activeQr.status,
              issuedAt: toIsoString(activeQr.issued_at),
              issued_at: toIsoString(activeQr.issued_at),
              expiresAt: toIsoString(activeQr.expires_at),
              expires_at: toIsoString(activeQr.expires_at),
              ttlSeconds: Number(activeQr.ttl_seconds ?? 30),
              ttl_seconds: Number(activeQr.ttl_seconds ?? 30),
              usedAt: toIsoString(activeQr.used_at),
              used_at: toIsoString(activeQr.used_at),
            }
          : null,
        device: {
          status: "idle",
          message: "?붾컮?댁뒪媛 ?湲?以묒엯?덈떎.",
        },
      },
      message: "留덉씠?섏씠吏 ?붿빟 議고쉶???깃났?덉뒿?덈떎.",
    });
  } catch (error) {
    console.error("Mypage summary error:", error);
    return res.status(500).json({
      success: false,
      message: "留덉씠?섏씠吏 ?붿빟??遺덈윭?ㅼ? 紐삵뻽?듬땲??",
    });
  }
});

router.get("/histories", authenticateToken, async (req, res) => {
  const memberId = getMemberId(req);

  try {
    const sql = `
      SELECT
        d.donate_id AS post_id,
        d.title,
        d.status,
        d.created_at,
        'donate' AS post_type,
        MIN(di.image_url) AS image_url
      FROM ITEM_DONATE d
      LEFT JOIN ITEM_DONATE_IMAGE di ON di.donate_id = d.donate_id
      WHERE d.member_id = ?
      GROUP BY d.donate_id, d.title, d.status, d.created_at

      UNION ALL

      SELECT
        r.request_id AS post_id,
        r.title,
        r.status,
        r.created_at,
        'request' AS post_type,
        MIN(ri.image_url) AS image_url
      FROM ITEM_REQUEST r
      LEFT JOIN ITEM_REQUEST_IMAGE ri ON ri.request_id = r.request_id
      WHERE r.member_id = ?
      GROUP BY r.request_id, r.title, r.status, r.created_at

      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql, [memberId, memberId]);
    const histories = rows.map((row) => ({
      id: `${row.post_type}_${row.post_id}`,
      postId: row.post_id,
      post_id: row.post_id,
      title: row.title,
      status: row.status,
      displayStatus: row.post_type === "donate" ? mapDonateStatus(row.status) : row.status,
      display_status: row.post_type === "donate" ? mapDonateStatus(row.status) : row.status,
      postType: row.post_type,
      post_type: row.post_type,
      image: normalizeUploadUrl(req, row.image_url),
      image_url: normalizeUploadUrl(req, row.image_url),
      createdAt: toIsoString(row.created_at),
      created_at: toIsoString(row.created_at),
    }));

    return res.status(200).json({
      success: true,
      data: {
        histories,
        total: histories.length,
      },
      message: "?댁뿭 議고쉶???깃났?덉뒿?덈떎.",
    });
  } catch (error) {
    console.error("Mypage histories error:", error);
    return res.status(500).json({
      success: false,
      message: "?댁뿭??遺덈윭?ㅻ뒗 ???ㅽ뙣?덉뒿?덈떎.",
    });
  }
});

router.get("/stats", authenticateToken, async (req, res) => {
  const memberId = getMemberId(req);
  const period = req.query.period === "3months" ? 3 : req.query.period === "year" ? 12 : 6;

  try {
    const [mineRows] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_key, COUNT(*) AS count
       FROM ITEM_DONATE
       WHERE member_id = ?
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')`,
      [memberId, period],
    );

    const [allRows] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_key, COUNT(*) AS count
       FROM ITEM_DONATE
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')`,
      [period],
    );

    const mineMap = new Map(mineRows.map((row) => [row.month_key, Number(row.count)]));
    const allMap = new Map(allRows.map((row) => [row.month_key, Number(row.count)]));
    const now = new Date();
    const monthlyStats = [];

    for (let index = period - 1; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const mine = mineMap.get(monthKey) ?? 0;
      const total = allMap.get(monthKey) ?? 0;

      monthlyStats.push({
        month: `${date.getMonth() + 1}월`,
        monthKey,
        month_key: monthKey,
        mine,
        average: Number((total / Math.max(1, period)).toFixed(1)),
      });
    }

    const myAverage = Number(
      (monthlyStats.reduce((sum, item) => sum + item.mine, 0) / period).toFixed(1),
    );
    const allAverage = Number(
      (monthlyStats.reduce((sum, item) => sum + item.average, 0) / period).toFixed(1),
    );

    return res.status(200).json({
      success: true,
      data: {
        period: req.query.period || "6months",
        myAverage,
        my_average: myAverage,
        allAverage,
        all_average: allAverage,
        difference: Number((myAverage - allAverage).toFixed(1)),
        monthlyStats,
        monthly_stats: monthlyStats,
      },
      message: "나눔 통계 조회에 성공했습니다.",
    });
  } catch (error) {
    console.error("Mypage stats error:", error);
    return res.status(500).json({
      success: false,
      message: "나눔 통계를 불러오지 못했습니다.",
    });
  }
});

router.post("/contact", authenticateToken, async (req, res) => {
  const memberId = getMemberId(req);
  const subject = String(req.body.subject || "").trim();
  const email = String(req.body.email || "").trim();
  const message = String(req.body.message || "").trim();

  if (!subject || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "제목, 이메일, 문의 내용을 모두 입력해주세요.",
    });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO ADMIN_INQUIRY (member_id, subject, email, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [memberId, subject, email, message, "pending"],
    );

    return res.status(201).json({
      success: true,
      data: {
        inquiryId: result.insertId,
        inquiry_id: result.insertId,
        memberId,
        member_id: memberId,
        subject,
        email,
        message,
        status: "pending",
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      message: "문의가 접수되었습니다.",
    });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Mypage contact error:", error);
      return res.status(500).json({
        success: false,
        message: "문의 접수에 실패했습니다.",
      });
    }

    const contact = {
      inquiryId: inMemoryContacts.length + 1,
      inquiry_id: inMemoryContacts.length + 1,
      memberId,
      member_id: memberId,
      subject,
      email,
      message,
      status: "pending",
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    inMemoryContacts.push(contact);

    return res.status(201).json({
      success: true,
      data: contact,
      message: "문의가 접수되었습니다.",
    });
  }
});

module.exports = router;
