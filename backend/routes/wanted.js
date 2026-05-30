const express = require("express");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");

const router = express.Router();

const ROLE_VULNERABLE = 3;
const DEFAULT_PRODUCT_ID = 51;
const DEFAULT_ITEM_CONDITION = "상태 무관";

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

module.exports = router;
