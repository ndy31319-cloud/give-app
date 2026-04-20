import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import type { Message } from "@/app/services/api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseClientConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0,
);

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

if (hasFirebaseClientConfig) {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
}

type FirestoreMessage = {
  text?: string;
  sender?: { member_id?: number };
  createdAt?: Timestamp | { toDate?: () => Date } | string | null;
};

const formatRelativeTime = (input?: string) => {
  if (!input) {
    return "";
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return input;
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
};

const formatMessageTime = (value?: FirestoreMessage["createdAt"]) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return formatRelativeTime(value);
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return formatRelativeTime(value.toDate().toISOString());
  }

  return "";
};

const mapSnapshotMessage = (
  messageId: string,
  data: FirestoreMessage,
  currentUserId: string | null,
): Message => ({
  id: messageId,
  text: data.text || "",
  sender: String(data.sender?.member_id || "") === currentUserId ? "me" : "other",
  time: formatMessageTime(data.createdAt),
  type: "text",
});

export const canUseRealtimeChat = () => Boolean(firestoreDb);

export const subscribeToRoomMessages = (
  roomId: string,
  onMessages: (messages: Message[]) => void,
  onError: (error: Error) => void,
) => {
  if (!firestoreDb) {
    return null;
  }

  const currentUserId = localStorage.getItem("give-app-user-id");
  const messagesQuery = query(
    collection(firestoreDb, "chatRooms", roomId, "messages"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const nextMessages = snapshot.docs.map((doc) =>
        mapSnapshotMessage(doc.id, doc.data() as FirestoreMessage, currentUserId),
      );
      onMessages(nextMessages);
    },
    (error) => {
      onError(error);
    },
  );
};
