import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

import {
  ChatMessage,
  ChatRoom,
  CreatePostInput,
  DeviceSimulationState,
  DynamicQrPurpose,
  DynamicQrSession,
  NeighborhoodLocation,
  NotificationItem,
  Post,
  SignupDraft,
  User,
} from '@/src/types/app';
import {
  createMockUser,
  mockChatRooms,
  mockMessagesByChat,
  mockNotifications,
  mockPosts,
} from '@/src/data/mockData';
import { authAPI, chatAPI, dynamicQrAPI, memberAPI, notificationAPI, postAPI } from '@/src/services/api';

const initialDeviceSimulationState: DeviceSimulationState = {
  step: 'idle',
  sessionId: null,
  token: null,
  message: '디바이스가 대기 중입니다.',
  lockerOpen: false,
  itemDetected: false,
  lastUpdatedAt: new Date().toISOString(),
};

interface AppContextValue {
  user: User | null;
  authToken: string | null;
  isAuthenticated: boolean;
  signupDraft: SignupDraft;
  posts: Post[];
  notifications: NotificationItem[];
  chatRooms: ChatRoom[];
  messagesByChat: Record<string, ChatMessage[]>;
  activeQrSession: DynamicQrSession | null;
  deviceSimulation: DeviceSimulationState;
  setSignupDraft: (draft: SignupDraft) => void;
  mergeSignupDraft: (draft: Partial<SignupDraft>) => void;
  login: (identifier: string, password: string) => Promise<{ error: string | null }>;
  completeSignup: (location: NeighborhoodLocation) => Promise<{ error: string | null }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<{ error: string | null }>;
  updateLocation: (location: NeighborhoodLocation) => Promise<{ error: string | null }>;
  addPost: (payload: CreatePostInput) => Promise<{ error: string | null }>;
  startChatWithPost: (post: Post) => Promise<{ roomId: string | null; error: string | null }>;
  sendMessage: (chatId: string, text: string) => Promise<{ error: string | null }>;
  markNotificationRead: (id: string) => void;
  issueDynamicQr: (
    purpose?: DynamicQrPurpose,
    ttlSeconds?: number,
  ) => Promise<{ error: string | null }>;
  startDeviceAuthentication: (token: string) => Promise<{ error: string | null }>;
  confirmDeviceItemInserted: () => Promise<{ error: string | null }>;
  resetDeviceSimulation: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [signupDraft, setSignupDraft] = useState<SignupDraft>({});
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>(mockChatRooms);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(mockMessagesByChat);
  const [activeQrSession, setActiveQrSession] = useState<DynamicQrSession | null>(null);
  const [deviceSimulation, setDeviceSimulation] = useState<DeviceSimulationState>(initialDeviceSimulationState);
  const deviceTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      deviceTimerRefs.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrateAppData() {
      const postsResult = await postAPI.listAll(authToken ?? undefined);
      if (mounted && postsResult.data?.length) {
        setPosts(postsResult.data);
      }

      if (!user) {
        if (!mounted) {
          return;
        }
        setChatRooms(mockChatRooms);
        setMessagesByChat(mockMessagesByChat);
        setNotifications(mockNotifications);
        return;
      }

      const [roomsResult, notificationsResult] = await Promise.all([
        chatAPI.listRooms(user.id, authToken ?? undefined),
        notificationAPI.list(user.id, authToken ?? undefined),
      ]);

      if (mounted && roomsResult.data?.length) {
        setChatRooms(roomsResult.data);
      }

      if (mounted && notificationsResult.data?.length) {
        setNotifications(notificationsResult.data);
      }

      const rooms = roomsResult.data ?? [];
      if (!rooms.length) {
        return;
      }

      const messageEntries = await Promise.all(
        rooms.map(async (room) => {
          const messagesResult = await chatAPI.listMessages(room.id, authToken ?? undefined, user.id);
          return [room.id, messagesResult.data ?? []] as const;
        }),
      );

      if (!mounted) {
        return;
      }

      setMessagesByChat((prev) => ({
        ...prev,
        ...Object.fromEntries(messageEntries),
      }));
    }

    hydrateAppData();

    return () => {
      mounted = false;
    };
  }, [authToken, user]);

  function clearDeviceTimers() {
    deviceTimerRefs.current.forEach((timer) => clearTimeout(timer));
    deviceTimerRefs.current = [];
  }

  function queueDeviceStep(delayMs: number, callback: () => void) {
    const timer = setTimeout(callback, delayMs);
    deviceTimerRefs.current.push(timer);
  }

  async function login(identifier: string, password: string) {
    const result = await authAPI.login({ identifier, password });
    if (result.error || !result.data) {
      return { error: result.error ?? '로그인에 실패했습니다.' };
    }

    setUser(result.data.user ?? createMockUser());
    setAuthToken(result.data.token);
    return { error: null };
  }

  async function completeSignup(location: NeighborhoodLocation) {
    const result = await authAPI.signup(signupDraft, location);
    if (result.error || !result.data) {
      return { error: result.error ?? '회원가입에 실패했습니다.' };
    }

    setUser(result.data.user);
    setAuthToken(result.data.token);
    setSignupDraft({});
    return { error: null };
  }

  function logout() {
    clearDeviceTimers();
    setUser(null);
    setAuthToken(null);
    setActiveQrSession(null);
    setDeviceSimulation(initialDeviceSimulationState);
  }

  function mergeSignupDraftPart(draft: Partial<SignupDraft>) {
    setSignupDraft((prev) => ({ ...prev, ...draft }));
  }

  async function updateProfile(data: Partial<User>) {
    if (!user) {
      return { error: '로그인이 필요합니다.' };
    }

    const result = await memberAPI.updateMe(
      user.id,
      {
        name: data.name ?? user.name,
        nickname: data.nickname ?? user.nickname,
        phone: data.phone ?? user.phone ?? '',
        dongName: data.dongName ?? user.dongName,
      },
      authToken ?? undefined,
    );

    if (result.error) {
      return { error: result.error };
    }

    setUser((prev) => (prev ? { ...prev, ...data } : prev));
    return { error: null };
  }

  async function updateLocation(location: NeighborhoodLocation) {
    if (!user) {
      return { error: '로그인이 필요합니다.' };
    }

    const result = await memberAPI.updateLocation(user.id, location, authToken ?? undefined);
    if (result.error) {
      return { error: result.error };
    }

    setUser((prev) => (prev ? { ...prev, location, dongName: location.dongName } : prev));
    return { error: null };
  }

  async function addPost(payload: CreatePostInput) {
    const result = await postAPI.createPost(payload, {
      authToken,
      user,
    });
    if (result.error) {
      return { error: result.error };
    }

    const newPost: Post = result.data ?? {
      id: `post_${Date.now()}`,
      recordId: `post_${Date.now()}`,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      location: payload.location,
      status: 'open',
      urgency: payload.type === 'need' ? payload.urgency ?? 'normal' : undefined,
      images: payload.images.map((image) => image.uri),
      imageFiles: payload.images,
      author: {
        id: user?.id ?? 'user_1',
        name: user?.name ?? '홍길동',
        nickname: user?.nickname,
        temperature: 36.8,
        profileImage: user?.profileImage,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favoriteCount: 0,
      views: 0,
      aiDetectedItem: payload.aiAnalysis?.detectedItem,
    };

    setPosts((prev) => [newPost, ...prev]);
    return { error: null };
  }

  async function startChatWithPost(post: Post) {
    if (!user) {
      return { roomId: null, error: '로그인이 필요합니다.' };
    }

    if (!post.author.id) {
      return { roomId: null, error: '게시글 작성자 정보를 찾을 수 없습니다.' };
    }

    if (String(post.author.id) === String(user.id)) {
      return { roomId: null, error: '본인 게시글에는 채팅을 시작할 수 없습니다.' };
    }

    const existingRoom = chatRooms.find(
      (room) =>
        String(room.postId) === String(post.id) &&
        String(room.userId) === String(post.author.id),
    );

    if (existingRoom) {
      return { roomId: existingRoom.id, error: null };
    }

    const result = await chatAPI.createRoom({
      participantIds: [post.author.id],
      relatedPostId: post.id,
      relatedPostType: post.type,
      currentUserId: user.id,
      relatedPost: post,
      authToken: authToken ?? undefined,
    });

    if (result.error || !result.data) {
      return { roomId: null, error: result.error ?? '채팅방을 만들 수 없습니다.' };
    }

    const room = result.data;
    setChatRooms((prev) => {
      const exists = prev.some((item) => item.id === room.id);
      return exists ? prev.map((item) => (item.id === room.id ? room : item)) : [room, ...prev];
    });

    return { roomId: room.id, error: null };
  }

  async function sendMessage(chatId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return { error: null };
    }

    const result = user
      ? await chatAPI.sendMessage({
          chatRoomId: chatId,
          senderId: user.id,
          content: trimmed,
          messageType: 'TEXT',
          authToken: authToken ?? undefined,
        })
      : {
          data: {
            id: `message_${Date.now()}`,
            sender: 'me' as const,
            text: trimmed,
            timeLabel: '방금',
          },
          error: null,
        };

    if (result.error) {
      return { error: result.error };
    }

    const newMessage: ChatMessage = result.data ?? {
      id: `message_${Date.now()}`,
      sender: 'me',
      text: trimmed,
      timeLabel: '방금',
    };

    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] ?? []), newMessage],
    }));

    setChatRooms((prev) =>
      prev.map((room) =>
        room.id === chatId
          ? {
              ...room,
              lastMessage: trimmed,
              timeLabel: '방금',
            }
          : room,
      ),
    );

    return { error: null };
  }
  function markNotificationRead(id: string) {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
  }

  async function issueDynamicQr(
    purpose: DynamicQrPurpose = 'donation_access',
    ttlSeconds = 30,
  ) {
    if (!user) {
      return { error: '로그인 후 동적 QR을 발급할 수 있습니다.' };
    }

    const result = await dynamicQrAPI.issue(user.id, purpose, ttlSeconds, authToken ?? undefined);
    if (result.error || !result.data) {
      return { error: result.error ?? '동적 QR 발급에 실패했습니다.' };
    }

    setActiveQrSession(result.data);
    return { error: null };
  }

  async function startDeviceAuthentication(token: string) {
    const trimmed = token.trim();
    if (!trimmed) {
      setDeviceSimulation({
        ...initialDeviceSimulationState,
        step: 'error',
        message: 'QR 토큰을 입력하거나 활성 QR을 사용해주세요.',
        lastUpdatedAt: new Date().toISOString(),
      });
      return { error: 'QR 토큰을 입력해주세요.' };
    }

    clearDeviceTimers();

    const validation = await dynamicQrAPI.validate(trimmed, authToken ?? undefined);
    if (validation.data?.memberId === user?.id) {
      setActiveQrSession(validation.data);
    }

    if (validation.error || !validation.data) {
      setDeviceSimulation({
        ...initialDeviceSimulationState,
        step: 'error',
        token: trimmed,
        message: validation.error ?? 'QR 인증에 실패했습니다.',
        lastUpdatedAt: new Date().toISOString(),
      });
      return { error: validation.error ?? 'QR 인증에 실패했습니다.' };
    }

    const session = validation.data;
    setDeviceSimulation({
      step: 'qr_scanned',
      sessionId: session.id,
      token: session.token,
      message: 'QR 인식이 완료되었습니다. 서버에서 인증 정보를 확인합니다.',
      lockerOpen: false,
      itemDetected: false,
      lastUpdatedAt: new Date().toISOString(),
    });

    queueDeviceStep(700, () => {
      setDeviceSimulation((prev) => ({
        ...prev,
        step: 'server_validating',
        message: '예약 정보와 시간 제한을 검증하고 있습니다.',
        lastUpdatedAt: new Date().toISOString(),
      }));
    });

    queueDeviceStep(1500, () => {
      setDeviceSimulation((prev) => ({
        ...prev,
        step: 'locker_open',
        lockerOpen: true,
        message: '인증이 완료되어 기부함 잠금이 해제되었습니다.',
        lastUpdatedAt: new Date().toISOString(),
      }));
    });

    queueDeviceStep(2400, () => {
      setDeviceSimulation((prev) => ({
        ...prev,
        step: 'awaiting_item',
        lockerOpen: true,
        message: '물품 투입을 기다리고 있습니다. 투입 후 감지 버튼을 눌러주세요.',
        lastUpdatedAt: new Date().toISOString(),
      }));
    });

    return { error: null };
  }

  async function confirmDeviceItemInserted() {
    if (deviceSimulation.step !== 'awaiting_item' || !deviceSimulation.token) {
      return { error: '현재는 물품 투입을 처리할 수 있는 단계가 아닙니다.' };
    }

    clearDeviceTimers();
    const targetToken = deviceSimulation.token;

    setDeviceSimulation((prev) => ({
      ...prev,
      step: 'item_detected',
      itemDetected: true,
      message: '센서가 물품 투입을 감지했습니다. 완료 처리를 시작합니다.',
      lastUpdatedAt: new Date().toISOString(),
    }));

    queueDeviceStep(800, () => {
      setDeviceSimulation((prev) => ({
        ...prev,
        step: 'server_updating',
        message: '서버와 Firebase에 완료 데이터를 반영하고 있습니다.',
        lastUpdatedAt: new Date().toISOString(),
      }));
    });

    queueDeviceStep(1700, async () => {
      const result = await dynamicQrAPI.consume(targetToken, authToken ?? undefined);

      if (result.data?.memberId === user?.id) {
        setActiveQrSession(result.data);
      }

      if (result.error || !result.data) {
        setDeviceSimulation((prev) => ({
          ...prev,
          step: 'error',
          message: result.error ?? '완료 처리 중 문제가 발생했습니다.',
          lastUpdatedAt: new Date().toISOString(),
        }));
        return;
      }

      const consumedSession = result.data;

      setDeviceSimulation({
        step: 'completed',
        sessionId: consumedSession.id,
        token: consumedSession.token,
        lockerOpen: false,
        itemDetected: true,
        message: '기부 물품 등록이 완료되었습니다. 앱 알림도 함께 전송되었습니다.',
        lastUpdatedAt: new Date().toISOString(),
      });

      setNotifications((prev) => [
        {
          id: `notification_qr_${Date.now()}`,
          type: 'system',
          relatedType: 'system',
          relatedId: consumedSession.id,
          notificationTypeCode: 'system',
          title: '기부함 인증 완료',
          message: '동적 QR 인증과 물품 투입이 정상적으로 완료되었습니다.',
          timeLabel: '방금',
          isRead: false,
        },
        ...prev,
      ]);
    });

    return { error: null };
  }

  function resetDeviceSimulation() {
    clearDeviceTimers();
    setDeviceSimulation({
      ...initialDeviceSimulationState,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  return (
    <AppContext.Provider
      value={{
        user,
        authToken,
        isAuthenticated: Boolean(user),
        signupDraft,
        posts,
        notifications,
        chatRooms,
        messagesByChat,
        activeQrSession,
        deviceSimulation,
        setSignupDraft,
        mergeSignupDraft: mergeSignupDraftPart,
        login,
        completeSignup,
        logout,
        updateProfile,
        updateLocation,
        addPost,
        startChatWithPost,
        sendMessage,
        markNotificationRead,
        issueDynamicQr,
        startDeviceAuthentication,
        confirmDeviceItemInserted,
        resetDeviceSimulation,
      }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return context;
}
