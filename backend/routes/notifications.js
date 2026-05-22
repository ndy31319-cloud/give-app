const express = require("express");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");

const router = express.Router();

const defaultSettings = {
  push: true,
  newPost: true,
  chat: true,
  activity: false,
};

const inMemorySettings = new Map();

const getMemberId = (req) => req.user.member_id || req.user.id;

const notificationTitles = {
  chat: "채팅 알림",
  request: "요청 알림",
  pickup_request: "수거 요청",
  pickup_approved: "수거 승인",
  pickup_completed: "수거 완료",
  admin: "관리자 알림",
};

const toNotification = (row) => {
  const notificationType = row.notification_type ?? row.notificationTypeCode ?? "system";

  return {
    id: String(row.notification_id ?? row.id),
    notificationId: row.notification_id ?? row.id,
    notification_id: row.notification_id ?? row.id,
    type: notificationType,
    relatedType: row.related_type ?? row.relatedType ?? null,
    relatedId: row.related_id ?? row.relatedId ?? null,
    notificationTypeCode: notificationType,
    notification_type: notificationType,
    title: notificationTitles[notificationType] ?? "알림",
    message: row.message ?? "",
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    created_at: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    isRead: Boolean(row.is_read ?? row.isRead),
  };
};

router.use(authenticateToken);

router.get("/", async (req, res) => {
  const memberId = getMemberId(req);

  try {
    const [rows] = await db.query(
      `SELECT notification_id, member_id, related_type, related_id,
              notification_type, message, is_read, created_at
       FROM NOTIFICATION
       WHERE member_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [memberId],
    );

    return res.status(200).json({
      success: true,
      data: rows.map(toNotification),
    });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Notification list error:", error);
      return res.status(500).json({
        success: false,
        message: "?뚮┝ 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??",
      });
    }

    return res.status(200).json({ success: true, data: [] });
  }
});

router.patch("/:id/read", async (req, res) => {
  const memberId = getMemberId(req);
  const notificationId = req.params.id;

  try {
    await db.query(
      "UPDATE NOTIFICATION SET is_read = TRUE WHERE notification_id = ? AND member_id = ?",
      [notificationId, memberId],
    );

    return res.status(200).json({
      success: true,
      data: { success: true },
    });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Notification read error:", error);
      return res.status(500).json({
        success: false,
        message: "?뚮┝ ?쎌쓬 泥섎━???ㅽ뙣?덉뒿?덈떎.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { success: true },
    });
  }
});

router.get("/settings/me", async (req, res) => {
  const memberId = getMemberId(req);

  try {
    const [rows] = await db.query(
      `SELECT push_enabled, new_post_enabled, chat_enabled, activity_enabled
       FROM NOTIFICATION_SETTING
       WHERE member_id = ?
       LIMIT 1`,
      [memberId],
    );

    const row = rows[0];
    return res.status(200).json({
      success: true,
      data: row
        ? {
            push: Boolean(row.push_enabled),
            newPost: Boolean(row.new_post_enabled),
            chat: Boolean(row.chat_enabled),
            activity: Boolean(row.activity_enabled),
          }
        : defaultSettings,
    });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Notification settings load error:", error);
      return res.status(500).json({
        success: false,
        message: "?뚮┝ ?ㅼ젙??遺덈윭?ㅼ? 紐삵뻽?듬땲??",
      });
    }

    return res.status(200).json({
      success: true,
      data: inMemorySettings.get(String(memberId)) ?? defaultSettings,
    });
  }
});

router.patch("/settings/me", async (req, res) => {
  const memberId = getMemberId(req);
  const settings = {
    push: Boolean(req.body.push),
    newPost: Boolean(req.body.newPost ?? req.body.new_post),
    chat: Boolean(req.body.chat),
    activity: Boolean(req.body.activity),
  };

  try {
    await db.query(
      `INSERT INTO NOTIFICATION_SETTING
        (member_id, push_enabled, new_post_enabled, chat_enabled, activity_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        push_enabled = VALUES(push_enabled),
        new_post_enabled = VALUES(new_post_enabled),
        chat_enabled = VALUES(chat_enabled),
        activity_enabled = VALUES(activity_enabled),
        updated_at = NOW()`,
      [memberId, settings.push, settings.newPost, settings.chat, settings.activity],
    );

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      console.error("Notification settings update error:", error);
      return res.status(500).json({
        success: false,
        message: "?뚮┝ ?ㅼ젙 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.",
      });
    }

    inMemorySettings.set(String(memberId), settings);
    return res.status(200).json({
      success: true,
      data: settings,
    });
  }
});

module.exports = router;
