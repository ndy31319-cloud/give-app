const express = require("express");
const { admin, getFirestore } = require("../lib/firebaseAdmin");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");
const multer = require('multer');
const { parseMessage } = require('../lib/chatContent');
const { saveChatImage } = require('../lib/chatMedia');
const chatImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('image');

const router = express.Router();

const formatParticipant = (member) => ({
  member_id: Number(member.member_id),
  name: member.name || null,
  nickname: member.nickname || null,
  email: member.email || null,
  dong_name: member.dong_name || null,
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
    `SELECT member_id, name, nickname, email, dong_name
     FROM MEMBER
     WHERE member_id IN (${placeholders})`,
    uniqueIds,
  );

  return rows;
};

const ensureRoomParticipant = async (roomId, memberId) => {
  const firestore = getFirestore();
  let roomRef = firestore.collection("chatRooms").doc(String(roomId));
  let roomSnapshot = await roomRef.get();

  if (!roomSnapshot.exists) {
    const error = new Error("채팅방을 찾을 수 없습니다.");
    error.statusCode = 404;
    throw error;
  }

  if (roomSnapshot.data().mergedInto) {
    roomRef = firestore.collection("chatRooms").doc(roomSnapshot.data().mergedInto);
    roomSnapshot = await roomRef.get();
    if (!roomSnapshot.exists) {
      const error = new Error("채팅방을 찾을 수 없습니다.");
      error.statusCode = 404;
      throw error;
    }
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

const reviews = require('../services/reviews');
const handleReviewStatus = async (req, res) => {
  try {
    const memberId = getCurrentMemberId(req);
    const { roomRef } = await ensureRoomParticipant(req.params.roomId, memberId);
    res.json({ success: true, data: await reviews.eligibility(roomRef.id, memberId) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : '후기 정보를 불러오지 못했습니다.' });
  }
};
const handleCreateReview = async (req, res) => {
  try {
    const memberId = getCurrentMemberId(req);
    const { roomRef } = await ensureRoomParticipant(req.params.roomId, memberId);
    res.status(201).json({ success: true, data: await reviews.create(roomRef.id, memberId, req.body) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : '후기를 저장하지 못했습니다. 다시 시도해주세요.' });
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
      .get();

    if (!existingRoomSnapshot.empty) {
      const existingRoom = existingRoomSnapshot.docs.find(doc => !doc.data().mergedInto);
      if (existingRoom) {
        return res.status(200).json({
          success: true,
          message: "이미 존재하는 채팅방입니다.",
          data: {
            id: existingRoom.id,
            ...existingRoom.data(),
          },
        });
      }
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
      .filter(room => !room.mergedInto)
      .sort((a, b) => {
        const aTime =
          a.lastMessageAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime =
          b.lastMessageAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    const participantIds = rooms.flatMap(room => room.participantIds || []);
    const [reputation, members] = await Promise.all([
      reviews.scores(participantIds),
      getMembersByIds(participantIds),
    ]);
    const currentMembers = new Map(members.map(member => [Number(member.member_id), member]));
    for (const room of rooms) {
      room.participants = (room.participants || []).map(member => {
        const current = currentMembers.get(Number(member.member_id));
        return {
          ...member,
          ...(current ? formatParticipant(current) : {}),
          temperature: reputation[member.member_id]?.score ?? 36.5,
        };
      });
    }
    return res.status(200).json({ success: true, data: rooms });
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

async function persistMessage(roomId, memberId, content, clientMessageId) {
  if (clientMessageId && !/^[a-zA-Z0-9_-]{1,100}$/.test(clientMessageId)) {
    throw Object.assign(new Error('올바른 메시지 번호가 필요합니다.'), { statusCode: 400 });
  }
  const { roomRef } = await ensureRoomParticipant(roomId, memberId);
  const [members] = await db.query('SELECT member_id, name, nickname, email, dong_name FROM MEMBER WHERE member_id = ?', [memberId]);
  if (!members[0]) throw Object.assign(new Error('회원 정보를 찾을 수 없습니다.'), { statusCode: 404 });
  const messageRef = clientMessageId
    ? roomRef.collection('messages').doc(`member_${memberId}_${clientMessageId}`)
    : roomRef.collection('messages').doc();
  const firestore = getFirestore();
  return firestore.runTransaction(async transaction => {
    const room = await transaction.get(roomRef);
    if (!room.exists || !room.data().participantIds?.map(Number).includes(Number(memberId))) {
      throw Object.assign(new Error('채팅방 접근 권한이 없습니다.'), { statusCode: 403 });
    }
    const existing = await transaction.get(messageRef);
    if (existing.exists) return { data: { id: existing.id, ...existing.data() }, created: false };
    const now = new Date();
    const data = { messageId: messageRef.id, roomId: roomRef.id, ...content, sender: formatParticipant(members[0]), createdAt: now };
    transaction.set(messageRef, data);
    transaction.update(roomRef, { lastMessage: content.text, lastMessageAt: now, updatedAt: now });
    return { data: { id: messageRef.id, ...data }, created: true };
  });
}

router.post('/rooms/:roomId/images', async (req, res) => {
  const memberId = getCurrentMemberId(req);
  try {
    // Reject nonparticipants before accepting file data.
    await ensureRoomParticipant(req.params.roomId, memberId);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
  chatImageUpload(req, res, async error => {
    if (error) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? '사진은 5MB 이하로 보내주세요.' : '사진 한 장을 선택해주세요.' });
    if (!req.file) return res.status(400).json({ message: '사진을 선택해주세요.' });
    let uploaded;
    try {
      if (req.body.clientMessageId && !/^[a-zA-Z0-9_-]{1,100}$/.test(req.body.clientMessageId)) {
        return res.status(400).json({ message: '올바른 메시지 번호가 필요합니다.' });
      }
      uploaded = await saveChatImage(req, req.file.buffer);
      const result = await persistMessage(req.params.roomId, memberId,
        { type: 'IMAGE', text: '사진을 보냈어요.', image: { url: uploaded.url } }, req.body.clientMessageId);
      if (!result.created) await uploaded.remove().catch(() => {});
      return res.status(result.created ? 201 : 200).json({ success: true, data: result.data });
    } catch (failure) {
      // Do not delete on an ambiguous network failure: Firestore may have committed.
      if (uploaded && failure.statusCode) await uploaded.remove().catch(() => {});
      console.error('Chat image send error:', failure.message);
      return res.status(failure.statusCode || 500).json({ message: failure.statusCode ? failure.message : '사진 전송에 실패했습니다. 다시 시도해주세요.' });
    }
  });
});

router.post("/rooms/:roomId/messages", async (req, res) => {
  const memberId = getCurrentMemberId(req);
  const { roomId } = req.params;
  try {
    const result = await persistMessage(roomId, memberId, parseMessage(req.body), req.body.clientMessageId);
    return res.status(result.created ? 201 : 200).json({ success: true, data: result.data });
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
    if (roomData.tradeRequestId) {
      const [active] = await db.query(`SELECT pickup_id FROM PICKUP_REQUEST
        WHERE pickup_id = ? AND request_status IN ('pending', 'approved')`, [roomData.tradeRequestId]);
      if (active.length) return res.status(409).json({ success: false, message: '나눔 요청을 취소하거나 거래를 완료한 뒤 나가주세요.' });
    }
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
