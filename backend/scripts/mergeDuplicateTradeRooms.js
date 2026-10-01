// Keep the oldest room for repeated requests by the same person on the same post.
// Run without --apply to inspect affected room IDs first. No chat data is deleted.
const db = require('../db');
const { getFirestore } = require('../lib/firebaseAdmin');

const apply = process.argv.includes('--apply');

async function mergeGroup(rows) {
  const firestore = getFirestore();
  const canonicalId = rows[0].chat_room_id;
  const canonicalRef = firestore.collection('chatRooms').doc(canonicalId);
  const canonical = await canonicalRef.get();
  if (!canonical.exists) throw new Error(`Canonical room ${canonicalId} does not exist`);
  if (String(canonical.data().relatedPostId) !== String(rows[0].donate_id)) {
    throw new Error(`Canonical room ${canonicalId} belongs to another post`);
  }
  const canonicalParticipants = (canonical.data().participantIds || []).map(Number).sort((a, b) => a - b);
  const sourceIds = [...new Set(rows.map(row => row.chat_room_id))].filter(id => id !== canonicalId);
  const sources = await Promise.all(sourceIds.map(async id => {
    const ref = firestore.collection('chatRooms').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error(`Source room ${id} does not exist`);
    if (snapshot.data().mergedInto && snapshot.data().mergedInto !== canonicalId) {
      throw new Error(`Source room ${id} already merged elsewhere`);
    }
    if (String(snapshot.data().relatedPostId) !== String(rows[0].donate_id)) {
      throw new Error(`Source room ${id} belongs to another post`);
    }
    const sourceParticipants = (snapshot.data().participantIds || []).map(Number).sort((a, b) => a - b);
    if (JSON.stringify(sourceParticipants) !== JSON.stringify(canonicalParticipants)) {
      throw new Error(`Source room ${id} has different participants`);
    }
    return { id, ref, snapshot, messages: await ref.collection('messages').get() };
  }));
  const canonicalMessages = await canonicalRef.collection('messages').get();
  const occupied = new Set(canonicalMessages.docs.map(doc => doc.id));
  const copies = [];
  for (const source of sources) {
    for (const message of source.messages.docs) {
      let id = message.id;
      if (occupied.has(id)) {
        if (id.startsWith('request_')) continue;
        id = `${source.id}_${id}`;
        if (occupied.has(id)) continue; // Already copied on an earlier run.
      }
      occupied.add(id);
      copies.push({ id, data: { ...message.data(), messageId: id, roomId: canonicalId } });
    }
  }
  console.log(JSON.stringify({ canonicalId, sourceIds, messageCopies: copies.length,
    pickupIds: rows.map(row => row.pickup_id) }));
  if (!apply) return;

  for (let index = 0; index < copies.length; index += 400) {
    const batch = firestore.batch();
    for (const copy of copies.slice(index, index + 400)) {
      batch.set(canonicalRef.collection('messages').doc(copy.id), copy.data);
    }
    await batch.commit();
  }
  const latestRequest = rows[rows.length - 1];
  const latestRoom = [canonical, ...sources.map(source => source.snapshot)]
    .map(snapshot => snapshot.data())
    .sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0))[0];
  const batch = firestore.batch();
  batch.set(canonicalRef, {
    tradeRequestId: String(latestRequest.pickup_id),
    lastMessage: latestRoom.lastMessage ?? null,
    lastMessageAt: latestRoom.lastMessageAt ?? null,
    updatedAt: latestRoom.updatedAt ?? latestRoom.lastMessageAt ?? null,
  }, { merge: true });
  for (const source of sources) batch.set(source.ref, { mergedInto: canonicalId }, { merge: true });
  await batch.commit();

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const row of rows) {
      if (row.chat_room_id !== canonicalId) {
        await connection.query('UPDATE PICKUP_REQUEST SET chat_room_id = ? WHERE pickup_id = ? AND chat_room_id = ?',
          [canonicalId, row.pickup_id, row.chat_room_id]);
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  const [duplicates] = await db.query(`SELECT donate_id, requester_id FROM PICKUP_REQUEST
    WHERE chat_room_id IS NOT NULL GROUP BY donate_id, requester_id
    HAVING COUNT(DISTINCT chat_room_id) > 1`);
  for (const pair of duplicates) {
    const [rows] = await db.query(`SELECT pickup_id, donate_id, requester_id, chat_room_id
      FROM PICKUP_REQUEST WHERE donate_id = ? AND requester_id = ? AND chat_room_id IS NOT NULL
      ORDER BY pickup_id ASC`, [pair.donate_id, pair.requester_id]);
    await mergeGroup(rows);
  }
  console.log(`Duplicate groups: ${duplicates.length}; mode: ${apply ? 'applied' : 'dry run'}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => db.end());
