const express = require("express");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");
const { buildDonationOfferPickupMemo } = require("../services/wantedOffers");

const router = express.Router();

const ROLE_GENERAL = 1;
const ROLE_VULNERABLE = 3;
const DEFAULT_PRODUCT_ID = 51;
const DEFAULT_ITEM_CONDITION = "상태 무관";
const DONATION_OFFER_VISIT_GUIDE =
  "후원자가 보관함에 물품을 넣으면 키오스크의 물품 찾기에서 받을 수 있습니다.";

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

const buildDonationOfferContent = (wantedPost) => {
  const requestContent = normalizeNullableText(wantedPost.content);

  if (!requestContent) {
    return "요청글에 대한 나눔 의사로 등록된 보관함 입고용 나눔글입니다.";
  }

  return `요청글에 대한 나눔 의사로 등록된 보관함 입고용 나눔글입니다.\n\n요청 내용: ${requestContent}`;
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
      `SELECT r.request_id, r.member_id, r.title, r.content, r.status,
              r.dong_name, r.latitude, r.longitude,
              i.product_id, i.item_name, i.item_condition
       FROM ITEM_REQUEST r
       LEFT JOIN ITEM i ON i.request_id = r.request_id
       WHERE r.request_id = ?
       FOR UPDATE`,
      [requestId],
    );

    const wantedPost = requestRows[0];

    if (!wantedPost) {
      const error = new Error("요청글을 찾을 수 없습니다.");
      error.statusCode = 404;
      throw error;
    }

    if (Number(wantedPost.member_id) === Number(donorId)) {
      const error = new Error("본인이 작성한 요청글에는 나눔 의사를 보낼 수 없습니다.");
      error.statusCode = 409;
      throw error;
    }

    const pickupMemo = buildDonationOfferPickupMemo(requestId);
    const [existingOfferRows] = await connection.query(
      `SELECT d.donate_id, d.status, p.pickup_id, p.request_status
       FROM PICKUP_REQUEST p
       JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
       WHERE d.member_id = ?
         AND p.requester_id = ?
         AND p.memo = ?
         AND d.status IN ('open', 'reserved', 'storage_requested', 'stored')
         AND p.request_status IN ('pending', 'approved')
       ORDER BY p.pickup_id DESC
       LIMIT 1
       FOR UPDATE`,
      [donorId, wantedPost.member_id, pickupMemo],
    );

    if (existingOfferRows.length > 0) {
      const existingOffer = existingOfferRows[0];

      await connection.commit();

      return res.status(200).json({
        success: true,
        data: {
          requestId,
          request_id: requestId,
          donorId,
          donor_id: donorId,
          donateId: existingOffer.donate_id,
          donate_id: existingOffer.donate_id,
          pickupRequestId: existingOffer.pickup_id,
          pickup_request_id: existingOffer.pickup_id,
          donationStatus: existingOffer.status,
          donation_status: existingOffer.status,
          requestStatus: existingOffer.request_status,
          request_status: existingOffer.request_status,
          alreadyExists: true,
          already_exists: true,
          guide: DONATION_OFFER_VISIT_GUIDE,
        },
        message: "이미 나눔 의사를 보낸 요청글입니다.",
      });
    }

    if (String(wantedPost.status || "").toLowerCase() !== "open") {
      const error = new Error("현재 나눔 의사를 보낼 수 없는 요청글입니다.");
      error.statusCode = 409;
      throw error;
    }

    const [donorRows] = await connection.query(
      `SELECT nickname, name, dong_name, latitude, longitude
       FROM MEMBER
       WHERE member_id = ?
       LIMIT 1`,
      [donorId],
    );
    const donorName = donorRows[0]?.nickname || donorRows[0]?.name || "이웃";
    const message = `${donorName}님이 ‘${wantedPost.title}’ 요청에 나눔 의사를 보냈어요. ${DONATION_OFFER_VISIT_GUIDE}`;
    const donationDongName = wantedPost.dong_name || donorRows[0]?.dong_name || null;
    const donationLatitude = wantedPost.latitude ?? donorRows[0]?.latitude ?? null;
    const donationLongitude = wantedPost.longitude ?? donorRows[0]?.longitude ?? null;
    const productId = wantedPost.product_id || DEFAULT_PRODUCT_ID;
    const itemName = normalizeNullableText(wantedPost.item_name) || wantedPost.title;
    const itemCondition =
      normalizeNullableText(wantedPost.item_condition) || DEFAULT_ITEM_CONDITION;

    const [donationResult] = await connection.query(
      `INSERT INTO ITEM_DONATE
        (member_id, title, content, dong_name, latitude, longitude, status)
       VALUES (?, ?, ?, ?, ?, ?, 'reserved')`,
      [
        donorId,
        wantedPost.title,
        buildDonationOfferContent(wantedPost),
        donationDongName,
        donationLatitude,
        donationLongitude,
      ],
    );

    const donateId = donationResult.insertId;

    await connection.query(
      `INSERT INTO ITEM
        (donate_id, product_id, item_name, item_condition)
       VALUES (?, ?, ?, ?)`,
      [donateId, productId, itemName, itemCondition],
    );

    const [pickupResult] = await connection.query(
      `INSERT INTO PICKUP_REQUEST
        (requester_id, donate_id, request_status, requested_at, approved_at, memo, chat_synced)
       VALUES (?, ?, 'approved', NOW(), NOW(), ?, FALSE)`,
      [wantedPost.member_id, donateId, pickupMemo],
    );

    await connection.query(
      `UPDATE ITEM_REQUEST
       SET status = 'reserved', updated_at = NOW()
       WHERE request_id = ?`,
      [requestId],
    );

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
        donateId,
        donate_id: donateId,
        pickupRequestId: pickupResult.insertId,
        pickup_request_id: pickupResult.insertId,
        donationStatus: "reserved",
        donation_status: "reserved",
        requestStatus: "approved",
        request_status: "approved",
        alreadyExists: false,
        already_exists: false,
        guide: DONATION_OFFER_VISIT_GUIDE,
      },
      message: "나눔 의사를 전달했고 보관함 입고용 나눔글을 만들었습니다.",
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
