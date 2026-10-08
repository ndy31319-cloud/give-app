const express = require("express");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");

const router = express.Router();

const ROLE_GENERAL = 1;
const ROLE_VULNERABLE = 3;
const DEFAULT_PRODUCT_ID = 51;
const DEFAULT_ITEM_CONDITION = "상태 무관";
const DONATION_OFFER_VISIT_GUIDE =
  "3일 후에 방문해 확인해주세요. 그때 물품이 없으면 사정으로 인해 나눔이 어려운 것으로 이해해주세요.";

const parsePositiveInteger = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const parsed = Number(normalizedValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeNullableText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || null;
};

const normalizeCreatedFrom = (value) => {
  const normalizedValue = String(value || "web").trim().toLowerCase();
  return normalizedValue === "app" ? "app" : "web";
};

router.post("/", authenticateToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const memberId = req.user.member_id || req.user.id;
    const roleId = Number(req.user.role_id);
    const title = normalizeNullableText(req.body.title || req.body.item_name);
    const content = normalizeNullableText(req.body.content);
    const createdFrom = normalizeCreatedFrom(req.body.createdFrom || req.body.created_from);
    const productId =
      parsePositiveInteger(req.body.category_id) ||
      parsePositiveInteger(req.body.product_id) ||
      parsePositiveInteger(req.body.category) ||
      DEFAULT_PRODUCT_ID;
    const itemName = normalizeNullableText(req.body.item_name) || title;
    const itemCondition =
      normalizeNullableText(req.body.item_condition) || DEFAULT_ITEM_CONDITION;
    const urgency = normalizeNullableText(req.body.urgency);

    if (roleId !== ROLE_VULNERABLE) {
      return res.status(403).json({
        message: "요청해요 글쓰기는 취약계층 회원만 이용할 수 있습니다.",
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "필요한 물품명을 입력해주세요.",
      });
    }

    await connection.beginTransaction();

    const [memberRows] = await connection.query(
      `SELECT dong_name, latitude, longitude
       FROM MEMBER
       WHERE member_id = ?`,
      [memberId],
    );

    if (memberRows.length === 0) {
      const error = new Error("회원 정보를 찾을 수 없습니다.");
      error.statusCode = 404;
      throw error;
    }

    const member = memberRows[0];
    const dongName = normalizeNullableText(req.body.dongName || req.body.dong_name) || member.dong_name;
    const latitude = req.body.latitude ?? member.latitude;
    const longitude = req.body.longitude ?? member.longitude;

    const [postResult] = await connection.query(
      `INSERT INTO ITEM_REQUEST
        (member_id, title, content, dong_name, latitude, longitude, status, created_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, title, content, dongName, latitude, longitude, "open", createdFrom],
    );

    const requestId = postResult.insertId;

    await connection.query(
      `INSERT INTO ITEM (request_id, product_id, item_name, item_condition)
       VALUES (?, ?, ?, ?)`,
      [requestId, productId, itemName, itemCondition],
    );

    await connection.commit();

    return res.status(201).json({
      request: {
        requestId,
        request_id: requestId,
        memberId,
        member_id: memberId,
        categoryId: productId,
        category_id: productId,
        itemName,
        item_name: itemName,
        title,
        content,
        urgency,
        dongName,
        dong_name: dongName,
        latitude,
        longitude,
        status: "open",
        createdFrom,
        created_from: createdFrom,
        createdAt: new Date().toISOString(),
      },
      message: "요청해요 게시글이 등록되었습니다.",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create wanted post error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "요청해요 게시글 등록 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
});

router.post("/:id/donation-offer", authenticateToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const requestId = parsePositiveInteger(req.params.id);
    const donorId = req.user.member_id || req.user.id;
    const roleId = Number(req.user.role_id);

    if (!requestId) {
      return res.status(400).json({
        message: "올바른 요청글 번호가 필요합니다.",
      });
    }

    if (roleId !== ROLE_GENERAL) {
      return res.status(403).json({
        message: "나눔 의사 보내기는 일반회원만 이용할 수 있습니다.",
      });
    }

    await connection.beginTransaction();

    const [requestRows] = await connection.query(
      `SELECT request_id, member_id, title, status
       FROM ITEM_REQUEST
       WHERE request_id = ?
       FOR UPDATE`,
      [requestId],
    );

    const wantedPost = requestRows[0];

    if (!wantedPost) {
      const error = new Error("요청글을 찾을 수 없습니다.");
      error.statusCode = 404;
      throw error;
    }

    if (String(wantedPost.status || "").toLowerCase() !== "open") {
      const error = new Error("현재 나눔 의사를 보낼 수 없는 요청글입니다.");
      error.statusCode = 409;
      throw error;
    }

    if (Number(wantedPost.member_id) === Number(donorId)) {
      const error = new Error("본인이 작성한 요청글에는 나눔 의사를 보낼 수 없습니다.");
      error.statusCode = 409;
      throw error;
    }

    const [donorRows] = await connection.query(
      `SELECT nickname, name
       FROM MEMBER
       WHERE member_id = ?
       LIMIT 1`,
      [donorId],
    );
    const donorName = donorRows[0]?.nickname || donorRows[0]?.name || "이웃";
    const message = `${donorName}님이 ‘${wantedPost.title}’ 요청에 나눔 의사를 보냈어요. ${DONATION_OFFER_VISIT_GUIDE}`;

    await connection.query(
      `INSERT INTO NOTIFICATION
        (member_id, related_type, related_id, notification_type, message, is_read, created_at)
       VALUES (?, 'request', ?, 'wanted_donation_offer', ?, FALSE, NOW())`,
      [wantedPost.member_id, requestId, message],
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      data: {
        requestId,
        request_id: requestId,
        donorId,
        donor_id: donorId,
        guide: DONATION_OFFER_VISIT_GUIDE,
      },
      message: "나눔 의사를 전달했습니다.",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create wanted donation offer error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "나눔 의사 전달 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
