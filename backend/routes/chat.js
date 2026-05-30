const express = require("express");
const { admin, getFirestore } = require("../lib/firebaseAdmin");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");

const router = express.Router();

const formatParticipant = (member) => ({
  member_id: Number(member.member_id),
  name: member.name || null,
  nickname: member.nickname || null,
  email: member.email || null,
});

const getCurrentMemberId = (req) => Number(req.user.member_id || req.user.id);

const buildRoomKey = ({ participantIds, relatedPostId, relatedPostType }) => {
  const normalizedParticipants = [...new Set(participantIds.map(Number))]
    .filter(Boolean)
    .sort((a, b) => a - b);
  const postType = relatedPostType || "none";
  const postId = relatedPostId == null ? "none" : String(relatedPostId);

  return `${normalizedParticipants.join(":")}__${postType}__${postId}`;
};

const getMembersByIds = async (memberIds) => {
  const uniqueIds = [...new Set(memberIds.map(Number).filter(Boolean))];

  if (uniqueIds.length === 0) {
    return [];
  }

  const placeholders = uniqueIds.map(() => "?").join(", ");
  const [rows] = await db.query(
    `SELECT member_id, name, nickname, email
     FROM MEMBER
     WHERE member_id IN (${placeholders})`,
    uniqueIds,
  );

  return rows;
};

const ensureRoomParticipant = async (roomId, memberId) => {
  const firestore = getFirestore();
  const roomRef = firestore.collection("chatRooms").doc(String(roomId));
  const roomSnapshot = await roomRef.get();

  if (!roomSnapshot.exists) {
    const error = new Error("채팅방을 찾을 수 없습니다.");
    error.statusCode = 404;
    throw error;
  }

  const roomData = roomSnapshot.data();
  const participantIds = Array.isArray(roomData.participantIds)
    ? roomData.participantIds.map(Number)
    : [];

  if (!participantIds.includes(Number(memberId))) {
    const error = new Error("채팅방 접근 권한이 없습니다.");
    error.statusCode = 403;
    throw error;
  }

  return { roomRef, roomData };
};

const deleteRoomMessages = async (roomRef) => {
  const snapshot = await roomRef.collection("messages").get();

  if (snapshot.empty) {
    return;
  }

  const firestore = getFirestore();
  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

const inMemoryReviews = [];

const normalizeRelatedPostType = (type) => {
  if (type === "share" || type === "donate") {
    return "donate";
  }

  if (type === "need" || type === "request") {
    return "request";
  }

  return null;
};

const getRelatedPostMeta = (roomData) => ({
  postId:
    roomData.relatedPostId || roomData.postId || roomData.donateId || null,
  postType: normalizeRelatedPostType(
    roomData.relatedPostType || roomData.postType,
  ),
});

const findDonatePost = async (donateId) => {
  const [rows] = await db.query(
    `SELECT donate_id, member_id, title, status
     FROM ITEM_DONATE
     WHERE donate_id = ?`,
    [donateId],
  );

  return rows[0] || null;
};

const findExistingReview = async (donateId, writerId) => {
  try {
    const [rows] = await db.query(
      `SELECT review_id, donate_id, writer_id, target_member_id, rating, content, created_at
       FROM REVIEW
       WHERE donate_id = ? AND writer_id = ?
       LIMIT 1`,
      [donateId, writerId],
    );

    return rows[0] || null;
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      throw error;
    }

    return (
      inMemoryReviews.find(
        (review) =>
          Number(review.donate_id) === Number(donateId) &&
          Number(review.writer_id) === Number(writerId),
      ) || null
    );
  }
};

const getReviewEligibility = async (roomId, memberId) => {
  const { roomData } = await ensureRoomParticipant(roomId, memberId);
  const { postId, postType } = getRelatedPostMeta(roomData);

  if (!postId || postType !== "donate") {
    return {
      roomData,
      canReview: false,
      reason: "후기를 작성할 수 있는 나눔 게시글이 연결되어 있지 않습니다.",
      donate: null,
      existingReview: null,
    };
  }

  const donate = await findDonatePost(postId);

  if (!donate) {
    return {
      roomData,
      canReview: false,
      reason: "연결된 나눔 게시글을 찾을 수 없습니다.",
      donate: null,
      existingReview: null,
    };
  }

  if (donate.status !== "completed") {
    return {
      roomData,
      canReview: false,
      reason: "나눔완료 상태에서만 후기를 작성할 수 있습니다.",
      donate,
      existingReview: null,
    };
  }

  if (Number(donate.member_id) === Number(memberId)) {
    return {
      roomData,
      canReview: false,
      reason: "본인이 작성한 나눔에는 후기를 작성할 수 없습니다.",
      donate,
      existingReview: null,
    };
  }

  const existingReview = await findExistingReview(donate.donate_id, memberId);

  if (existingReview) {
    return {
      roomData,
      canReview: false,
      reason: "이미 후기를 작성했습니다.",
      donate,
      existingReview,
    };
  }

  return {
    roomData,
    canReview: true,
    reason: null,
    donate,
    existingReview: null,
  };
};

const buildReviewStatusPayload = (eligibility, memberId) => ({
  canReview: eligibility.canReview,
  can_review: eligibility.canReview,
  reason: eligibility.reason,
  donateId: eligibility.donate?.donate_id ?? null,
  donate_id: eligibility.donate?.donate_id ?? null,
  postStatus: eligibility.donate?.status ?? null,
  post_status: eligibility.donate?.status ?? null,
  targetMemberId: eligibility.donate?.member_id ?? null,
  target_member_id: eligibility.donate?.member_id ?? null,
  writerId: memberId,
  writer_id: memberId,
  alreadyReviewed: Boolean(eligibility.existingReview),
  already_reviewed: Boolean(eligibility.existingReview),
});

const insertReview = async ({
  donateId,
  writerId,
  targetMemberId,
  rating,
  content,
}) => {
  try {
    const [result] = await db.query(
      `INSERT INTO REVIEW (donate_id, writer_id, target_member_id, rating, content, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [donateId, writerId, targetMemberId, rating, content],
    );

    const [rows] = await db.query(
      `SELECT review_id, donate_id, writer_id, target_member_id, rating, content, created_at
       FROM REVIEW
       WHERE review_id = ?`,
      [result.insertId],
    );

    return rows[0];
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      throw error;
    }

    const review = {
      review_id: inMemoryReviews.length + 1,
      donate_id: donateId,
      writer_id: writerId,
      target_member_id: targetMemberId,
      rating,
      content,
      created_at: new Date().toISOString(),
    };

    inMemoryReviews.push(review);
    return review;
  }
};

const handleReviewStatus = async (req, res) => {
  const memberId = getCurrentMemberId(req);
  const roomId = req.params.roomId;

  try {
    const eligibility = await getReviewEligibility(roomId, memberId);

    return res.status(200).json({
      success: true,
      data: buildReviewStatusPayload(eligibility, memberId),
      message: "후기 작성 가능 여부를 조회했습니다.",
    });
  } catch (error) {
    console.error("Review status error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "후기 작성 가능 여부를 조회하지 못했습니다.",
    });
  }
};

const handleCreateReview = async (req, res) => {
  const memberId = getCurrentMemberId(req);
  const roomId = req.params.roomId;
  const rating = Number(req.body.rating);
  const content = String(req.body.content || req.body.message || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: "평점은 1점부터 5점까지 입력할 수 있습니다.",
    });
  }

  if (!content) {
    return res.status(400).json({
      success: false,
      message: "후기 내용을 입력해주세요.",
    });
  }

  try {
    const eligibility = await getReviewEligibility(roomId, memberId);

    if (!eligibility.canReview) {
      return res.status(409).json({
        success: false,
        data: buildReviewStatusPayload(eligibility, memberId),
        message: eligibility.reason,
      });
    }

    const review = await insertReview({
      donateId: eligibility.donate.donate_id,
      writerId: memberId,
      targetMemberId: eligibility.donate.member_id,
      rating,
      content,
    });

    return res.status(201).json({
      success: true,
      data: {
        reviewId: review.review_id,
        review_id: review.review_id,
        donateId: review.donate_id,
        donate_id: review.donate_id,
        writerId: review.writer_id,
        writer_id: review.writer_id,
        targetMemberId: review.target_member_id,
        target_member_id: review.target_member_id,
        rating: review.rating,
        content: review.content,
        createdAt: review.created_at,
        created_at: review.created_at,
      },
      message: "후기가 등록되었습니다.",
    });
  } catch (error) {
    console.error("Create review error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "후기 등록에 실패했습니다.",
    });
  }
};

router.use(authenticateToken);

router.get("/:roomId/review-status", handleReviewStatus);
router.post("/:roomId/review", handleCreateReview);
router.get("/rooms/:roomId/review-status", handleReviewStatus);
router.post("/rooms/:roomId/review", handleCreateReview);

router.post("/rooms", async (req, res) => {
  const creatorId = getCurrentMemberId(req);
  const {
    name,
    participantIds = [],
    relatedPostId = null,
    relatedPostType = null,
  } = req.body;

  try {
    const members = await getMembersByIds([creatorId, ...participantIds]);

    if (members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "채팅방에 참여할 사용자를 찾을 수 없습니다.",
      });
    }

    const participants = members.map(formatParticipant);
    const participantIdList = participants.map(
      (participant) => participant.member_id,
    );

    if (!participantIdList.includes(creatorId)) {
      return res.status(400).json({
        success: false,
        message: "채팅방 생성자는 반드시 참여자에 포함되어야 합니다.",
      });
    }

    const firestore = getFirestore();
    const roomKey = buildRoomKey({
      participantIds: participantIdList,
      relatedPostId,
      relatedPostType,
    });
    const existingRoomSnapshot = await firestore
      .collection("chatRooms")
      .where("roomKey", "==", roomKey)
      .limit(1)
      .get();

    if (!existingRoomSnapshot.empty) {
      const existingRoom = existingRoomSnapshot.docs[0];

      return res.status(200).json({
        success: true,
        message: "이미 존재하는 채팅방입니다.",
        data: {
          id: existingRoom.id,
          ...existingRoom.data(),
        },
      });
    }

    const roomRef = firestore.collection("chatRooms").doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const roomName =
      name ||
      participants
        .map(
          (participant) =>
            participant.nickname ||
            participant.name ||
            `회원${participant.member_id}`,
        )
        .join(", ");

    await roomRef.set({
      roomId: roomRef.id,
      roomKey,
      name: roomName,
      createdBy: creatorId,
      participants,
      participantIds: participantIdList,
      relatedPostId,
      relatedPostType,
      lastMessage: null,
      lastMessageAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const savedRoom = await roomRef.get();

    return res.status(201).json({
      success: true,
      message: "채팅방이 생성되었습니다.",
      data: {
        id: savedRoom.id,
        ...savedRoom.data(),
      },
    });
  } catch (error) {
    console.error("채팅방 생성 오류:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "채팅방 생성 중 오류가 발생했습니다.",
    });
  }
});

router.get("/rooms", async (req, res) => {
  const memberId = getCurrentMemberId(req);

  try {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection("chatRooms")
      .where("participantIds", "array-contains", memberId)
      .get();

    const rooms = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const aTime =
          a.lastMessageAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime =
          b.lastMessageAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    return res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    console.error("채팅방 목록 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "채팅방 목록을 불러오지 못했습니다.",
    });
  }
});

router.get("/rooms/:roomId/messages", async (req, res) => {
  const memberId = getCurrentMemberId(req);
  const { roomId } = req.params;

  try {
    const { roomRef } = await ensureRoomParticipant(roomId, memberId);
    const snapshot = await roomRef
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("메시지 조회 오류:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "메시지를 불러오지 못했습니다.",
    });
  }
});

router.post("/rooms/:roomId/messages", async (req, res) => {
  const memberId = getCurrentMemberId(req);
  const { roomId } = req.params;
  const { text } = req.body;

  if (!text || !String(text).trim()) {
    return res.status(400).json({
      success: false,
      message: "메시지 내용을 입력해 주세요.",
    });
  }

  try {
    const { roomRef, roomData } = await ensureRoomParticipant(roomId, memberId);
    const [members] = await db.query(
      `SELECT member_id, name, nickname, email
       FROM MEMBER
       WHERE member_id = ?`,
      [memberId],
    );

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: "보낸 사람 정보를 찾을 수 없습니다.",
      });
    }

    const sender = formatParticipant(members[0]);
    const messageRef = roomRef.collection("messages").doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const trimmedText = String(text).trim();

    await messageRef.set({
      messageId: messageRef.id,
      roomId,
      text: trimmedText,
      sender,
      createdAt: timestamp,
    });

    await roomRef.update({
      lastMessage: trimmedText,
      lastMessageAt: timestamp,
      updatedAt: timestamp,
      participants: roomData.participants || [],
    });

    const savedMessage = await messageRef.get();

    return res.status(201).json({
      success: true,
      message: "메시지가 전송되었습니다.",
      data: {
        id: savedMessage.id,
        ...savedMessage.data(),
      },
    });
  } catch (error) {
    console.error("메시지 전송 오류:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "메시지 전송 중 오류가 발생했습니다.",
    });
  }
});

router.delete("/rooms/:roomId", async (req, res) => {
  const memberId = getCurrentMemberId(req);
  const { roomId } = req.params;

  try {
    const { roomRef, roomData } = await ensureRoomParticipant(roomId, memberId);
    const nextParticipants = Array.isArray(roomData.participants)
      ? roomData.participants.filter(
          (participant) => Number(participant.member_id) !== Number(memberId),
        )
      : [];
    const nextParticipantIds = nextParticipants.map((participant) =>
      Number(participant.member_id),
    );

    if (nextParticipantIds.length === 0) {
      await deleteRoomMessages(roomRef);
      await roomRef.delete();
    } else {
      await roomRef.update({
        participants: nextParticipants,
        participantIds: nextParticipantIds,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "채팅방에서 나갔습니다.",
      data: {
        roomId,
        deleted: nextParticipantIds.length === 0,
      },
    });
  } catch (error) {
    console.error("채팅방 나가기 오류:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "채팅방 나가기 중 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
