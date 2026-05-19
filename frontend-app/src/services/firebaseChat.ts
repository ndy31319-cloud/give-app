import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  DocumentData,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

import { ChatMessage } from '@/src/types/app';
import { formatTimeAgo } from '@/src/utils/time';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseChatEnabled() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

function getFirebaseDb() {
  if (!isFirebaseChatEnabled()) {
    return null;
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function dateFromFirestoreValue(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function mapFirestoreMessage(id: string, raw: DocumentData, viewerId: string): ChatMessage {
  const senderId = String(raw.sender?.member_id ?? raw.sender?.memberId ?? raw.sender?.id ?? raw.senderId ?? raw.sender_id ?? '');
  const createdAt = dateFromFirestoreValue(raw.createdAt ?? raw.timestamp);

  return {
    id,
    sender: senderId === String(viewerId) ? 'me' : 'other',
    senderId,
    text: raw.text ?? raw.content ?? '',
    messageType: raw.messageType ?? raw.message_type ?? 'TEXT',
    timeLabel: formatTimeAgo(createdAt.toISOString()),
    isRead: Boolean(raw.isRead),
  };
}

export function subscribeToChatMessages(
  roomId: string,
  viewerId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
) {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  const messagesQuery = query(
    collection(db, 'chatRooms', String(roomId), 'messages'),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onMessages(snapshot.docs.map((doc) => mapFirestoreMessage(doc.id, doc.data(), viewerId)));
    },
    (error) => {
      onError?.(error);
    },
  );
}
