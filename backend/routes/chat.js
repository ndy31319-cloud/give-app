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

router.use(authenticateToken);

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

module.exports = router;
