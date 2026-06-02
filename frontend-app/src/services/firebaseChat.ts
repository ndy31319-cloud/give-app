import { initializeApp, getApps } from 'firebase/app';
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { mapBackendChatMessage } from '@/src/services/backendClient';
import { ChatMessage } from '@/src/types/app';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseChatConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

function getFirebaseDb() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function mapMessageDoc(doc: QueryDocumentSnapshot<DocumentData>, viewerId: string): ChatMessage {
  return mapBackendChatMessage(
    {
      id: doc.id,
      ...doc.data(),
    },
    viewerId,
  );
}

export function subscribeToChatMessages(
  chatRoomId: string,
  viewerId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
) {
  const messagesQuery = query(
    collection(getFirebaseDb(), 'chatRooms', chatRoomId, 'messages'),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onMessages(snapshot.docs.map((doc) => mapMessageDoc(doc, viewerId)));
    },
    (error) => {
      onError?.(error);
    },
  );
}
