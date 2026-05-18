import { findLocationByDongName } from '@/src/data/mockData';
import {
  ChatMessage,
  ChatRoom,
  DynamicQrPurpose,
  DynamicQrSession,
  ImageAnalysisResult,
  NeighborhoodLocation,
  NotificationItem,
  Policy,
  Post,
  RoleCode,
  UrgencyLevel,
  UploadableImage,
  User,
} from '@/src/types/app';
import { formatTimeAgo } from '@/src/utils/time';

export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export const backendConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '',
  useMockOnly: process.env.EXPO_PUBLIC_USE_MOCK_API === 'true',
  endpoints: {
    authLogin: process.env.EXPO_PUBLIC_AUTH_LOGIN_PATH ?? '/api/auth/login',
    authSignup: process.env.EXPO_PUBLIC_AUTH_SIGNUP_PATH ?? '/api/members/signup',
    authLogout: process.env.EXPO_PUBLIC_AUTH_LOGOUT_PATH ?? '/api/auth/logout',
    posts: process.env.EXPO_PUBLIC_POSTS_PATH ?? '/api/posts',
    harmfulCheck: process.env.EXPO_PUBLIC_HARMFUL_CHECK_PATH ?? '/api/posts/analyze',
    searchText: process.env.EXPO_PUBLIC_SEARCH_PATH ?? '/api/search',
    searchImage: process.env.EXPO_PUBLIC_SEARCH_IMAGE_PATH ?? '/api/search/image',
    policies: process.env.EXPO_PUBLIC_POLICIES_PATH ?? '/api/policy',
    policiesRecommended:
      process.env.EXPO_PUBLIC_POLICIES_RECOMMENDED_PATH ?? '/api/policies/recommended',
    policiesChatbot: process.env.EXPO_PUBLIC_POLICIES_CHATBOT_PATH ?? '/api/policies/chatbot',
    chats: process.env.EXPO_PUBLIC_CHATS_PATH ?? '/api/chats',
    dynamicQrIssue: process.env.EXPO_PUBLIC_DYNAMIC_QR_ISSUE_PATH ?? '/api/device/qr/issue',
    dynamicQrValidate: process.env.EXPO_PUBLIC_DYNAMIC_QR_VALIDATE_PATH ?? '/api/device/qr/validate',
    dynamicQrConsume: process.env.EXPO_PUBLIC_DYNAMIC_QR_CONSUME_PATH ?? '/api/device/qr/consume',
    relayState: process.env.EXPO_PUBLIC_DEVICE_RELAY_PATH ?? '/api/device/relay',
    sensorState: process.env.EXPO_PUBLIC_DEVICE_SENSOR_PATH ?? '/api/device/sensor',
    mypageSummary: process.env.EXPO_PUBLIC_MYPAGE_SUMMARY_PATH ?? '/api/mypage/summary',
    mypageHistories: process.env.EXPO_PUBLIC_MYPAGE_HISTORIES_PATH ?? '/api/mypage/histories',
    mypageStats: process.env.EXPO_PUBLIC_MYPAGE_STATS_PATH ?? '/api/mypage/stats',
    mypageContact: process.env.EXPO_PUBLIC_MYPAGE_CONTACT_PATH ?? '/api/mypage/contact',
    memberMe: process.env.EXPO_PUBLIC_MEMBER_ME_PATH ?? '/api/members/me',
    memberLocation: process.env.EXPO_PUBLIC_MEMBER_LOCATION_PATH ?? '/api/members/me/location',
  },
};

export function isBackendEnabled() {
  return Boolean(backendConfig.baseUrl) && !backendConfig.useMockOnly;
}

export function buildAuthHeaders(token?: string, headers?: Record<string, string>) {
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
}

export async function requestEnvelope<T>(path: string, init?: RequestInit) {
  if (!isBackendEnabled()) {
    return { data: null as T | null, error: null as string | null };
  }

  try {
    const response = await fetch(`${backendConfig.baseUrl}${path}`, init);
    const raw = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

    if (!response.ok) {
      return {
        data: null as T | null,
        error: raw?.message ?? raw?.error ?? `HTTP ${response.status}`,
      };
    }

    if (raw?.success === false) {
      return {
        data: null as T | null,
        error: raw.message ?? raw.error ?? '요청 처리에 실패했습니다.',
      };
    }

    return {
      data: (raw && 'data' in raw ? raw.data : raw) as T | null,
      error: null,
    };
  } catch {
    return {
      data: null as T | null,
      error: '백엔드 서버에 연결할 수 없습니다. 서버 실행 상태와 API 주소를 확인해주세요.',
    };
  }
}

export function toLocationString(location: NeighborhoodLocation) {
  return location.fullAddress || `${location.city} ${location.district} ${location.neighborhood}`.trim();
}

export function toBackendFilePart(image: UploadableImage) {
  return {
    uri: image.uri,
    name: image.name || `image-${Date.now()}.jpg`,
    type: image.type || 'image/jpeg',
  } as any;
}

function locationFromUnknown(
  source?: string | Partial<NeighborhoodLocation> | null,
  fallbackDongName?: string,
) {
  if (source && typeof source === 'object') {
    const fullAddress =
      source.fullAddress ||
      `${source.city ?? ''} ${source.district ?? ''} ${source.neighborhood ?? source.dongName ?? ''}`.trim();
    const dongName = source.dongName ?? source.neighborhood ?? fallbackDongName ?? '역삼동';
    const resolved = findLocationByDongName(dongName);

    return {
      ...resolved,
      ...source,
      dongName,
      neighborhood: source.neighborhood ?? resolved.neighborhood,
      fullAddress: fullAddress || resolved.fullAddress,
      radiusKm: source.radiusKm ?? resolved.radiusKm,
      latitude: source.latitude ?? resolved.latitude,
      longitude: source.longitude ?? resolved.longitude,
    };
  }

  if (typeof source === 'string' && source.trim()) {
    return findLocationByDongName(source.trim().split(' ').at(-1) ?? source.trim());
  }

  return findLocationByDongName(fallbackDongName ?? '역삼동');
}

function mapBackendRole(role?: string | number | null): RoleCode {
  if (role === 2 || role === '2' || role === 'ADMIN' || role === 'admin') return 'ADMIN';
  if (role === 3 || role === '3' || role === 'BENEFICIARY' || role === 'beneficiary') return 'BENEFICIARY';
  if (role === 1 || role === '1' || role === 'USER' || role === 'user') return 'USER';
  return 'USER';
}

export function mapBackendUser(raw: any): User {
  const roleCode = mapBackendRole(raw?.roleCode ?? raw?.roleName ?? raw?.roleId ?? raw?.role_id);
  const location = locationFromUnknown(raw?.location, raw?.dongName ?? raw?.dong_name);
  const vulnerableTypes = Array.isArray(raw?.vulnerableTypes) ? raw.vulnerableTypes : [];

  return {
    id: String(raw?.id ?? raw?.memberId ?? raw?.member_id ?? raw?.userId ?? `user_${Date.now()}`),
    roleId: String(raw?.roleId ?? raw?.role_id ?? `role_${roleCode.toLowerCase()}`),
    roleCode,
    name: raw?.name ?? '사용자',
    nickname: raw?.nickname ?? raw?.name ?? '사용자',
    email: raw?.email ?? '',
    phone: raw?.phone ?? '',
    dongName: raw?.dongName ?? raw?.dong_name ?? location.dongName,
    isVulnerable: Boolean(raw?.isVulnerable ?? roleCode === 'BENEFICIARY'),
    vulnerableTypes,
    location,
    neighborhoods: [location],
    profileImage: raw?.profileImage,
    birthdate: raw?.birthdate,
    bio: raw?.bio,
    createdAt: raw?.createdAt,
  };
}

function mapBackendPostStatus(status?: string) {
  if (status === 'available') return 'open';
  if (status === 'reserved') return 'reserved';
  if (status === 'completed') return 'completed';
  if (status === 'pickup_pending') return 'pickup_pending';
  if (status === 'storage_request') return 'storage_request';
  if (status === 'stored') return 'stored';
  if (status === 'canceled') return 'canceled';
  return 'open';
}

function mapBackendUrgency(value?: string): UrgencyLevel | undefined {
  if (value === 'low' || value === 'normal' || value === 'high' || value === 'urgent') {
    return value;
  }
  return undefined;
}

export function mapBackendPost(raw: any, fallbackLocation?: NeighborhoodLocation): Post {
  const backendType = raw?.type ?? raw?.postType ?? raw?.post_type;
  const type = backendType === 'need' || backendType === 'request' ? 'need' : 'share';
  const authorRaw = raw?.author ?? {};
  const location = locationFromUnknown(raw?.location ?? raw?.dongName ?? raw?.dong_name, fallbackLocation?.dongName);
  const postId = raw?.id ?? raw?.postId ?? raw?.post_id ?? raw?.recordId ?? raw?.donate_id ?? raw?.request_id;
  const rawImages = raw?.images ?? raw?.imageUrls ?? raw?.image_urls;
  const images = Array.isArray(rawImages)
    ? rawImages
    : [raw?.image ?? raw?.imageUrl ?? raw?.image_url].filter(Boolean);

  return {
    id: String(postId ?? `post_${Date.now()}`),
    recordId: String(postId ?? `post_${Date.now()}`),
    type,
    title: raw?.title ?? '',
    description: raw?.description ?? raw?.content ?? '',
    category: raw?.category ?? 'household',
    productId: raw?.productId ?? raw?.product_id ?? raw?.category_id,
    itemName: raw?.itemName ?? raw?.item_name,
    itemCondition: raw?.itemCondition ?? raw?.item_condition,
    location,
    status: mapBackendPostStatus(raw?.status),
    urgency: mapBackendUrgency(raw?.urgency),
    images,
    author: {
      id: String(authorRaw?.id ?? authorRaw?.userId ?? raw?.memberId ?? raw?.member_id ?? 'user_unknown'),
      name: authorRaw?.name ?? '사용자',
      nickname: authorRaw?.nickname ?? raw?.nickname,
      temperature: Number(authorRaw?.temperature ?? 36.5),
      profileImage: authorRaw?.profileImage,
    },
    createdAt: raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? raw?.createdAt ?? raw?.created_at,
    views: Number(raw?.views ?? 0),
    favoriteCount: Number(raw?.favoriteCount ?? 0),
    aiDetectedItem: raw?.aiDetectedItem,
  };
}

export function mergeCreatedPost(
  payload: {
    type: 'share' | 'need';
    title: string;
    description: string;
    category: string;
    productId?: string;
    itemName: string;
    itemCondition: string;
    location: NeighborhoodLocation;
    images: UploadableImage[];
    urgency?: UrgencyLevel;
    aiAnalysis?: ImageAnalysisResult | null;
  },
  currentUser: User,
  raw: any,
): Post {
  const mapped = mapBackendPost(raw, payload.location);

  return {
    ...mapped,
    type: mapped.type ?? payload.type,
    title: mapped.title || payload.title,
    description: mapped.description || payload.description,
    category: mapped.category || payload.category,
    productId: mapped.productId ?? payload.productId,
    itemName: mapped.itemName ?? payload.itemName,
    itemCondition: mapped.itemCondition ?? payload.itemCondition,
    location: mapped.location ?? payload.location,
    urgency: mapped.urgency ?? payload.urgency,
    images: mapped.images.length ? mapped.images : payload.images.map((image) => image.uri),
    author: mapped.author?.id !== 'user_unknown'
      ? mapped.author
      : {
          id: currentUser.id,
          name: currentUser.name,
          nickname: currentUser.nickname,
          temperature: 36.8,
          profileImage: currentUser.profileImage,
        },
    aiDetectedItem: mapped.aiDetectedItem ?? payload.aiAnalysis?.detectedItem,
  };
}

export function mapBackendChatRoom(raw: any, viewerId: string): ChatRoom {
  const participant =
    raw?.participant ??
    (Array.isArray(raw?.participants)
      ? raw.participants.find((item: any) => String(item?.member_id ?? item?.memberId ?? item?.id) !== String(viewerId))
      : {}) ??
    {};

  return {
    id: String(raw?.id ?? raw?.roomId ?? raw?.chatId ?? raw?.chatRoomId ?? `chat_${Date.now()}`),
    roomStatus: raw?.roomStatus === 'closed' ? 'closed' : 'open',
    donorId: String(raw?.donorId ?? raw?.donor_id ?? ''),
    requesterId: String(raw?.requesterId ?? raw?.requester_id ?? viewerId),
    userId: String(participant?.id ?? participant?.member_id ?? participant?.memberId ?? raw?.userId ?? ''),
    userName: participant?.name ?? raw?.userName ?? '상대방',
    userNickname: participant?.nickname ?? raw?.userNickname,
    userLocation: participant?.location ?? raw?.userLocation ?? '동네 정보 없음',
    postId: raw?.postId ?? raw?.relatedPostId,
    postType:
      raw?.postType === 'need' || raw?.relatedPostType === 'request'
        ? 'need'
        : raw?.postType === 'share' || raw?.relatedPostType === 'donate'
          ? 'share'
          : undefined,
    lastMessage: raw?.lastMessage?.text ?? raw?.lastMessage ?? '',
    timeLabel: formatTimeAgo(raw?.updatedAt ?? raw?.lastMessage?.timestamp ?? new Date().toISOString()),
    unreadCount: Number(raw?.unreadCount ?? 0),
    mannerTemperature: Number(participant?.temperature ?? raw?.mannerTemperature ?? 36.5),
  };
}

export function mapBackendChatMessage(raw: any, viewerId: string): ChatMessage {
  const senderId = String(raw?.sender?.id ?? raw?.sender?.member_id ?? raw?.senderId ?? raw?.sender_id ?? '');

  return {
    id: String(raw?.id ?? raw?.messageId ?? `message_${Date.now()}`),
    sender: senderId === viewerId ? 'me' : 'other',
    senderId,
    text: raw?.text ?? raw?.content ?? '',
    messageType: raw?.type?.toUpperCase?.() ?? raw?.messageType ?? 'TEXT',
    timeLabel: formatTimeAgo(raw?.timestamp ?? raw?.createdAt ?? new Date().toISOString()),
    isRead: Boolean(raw?.isRead),
  };
}

export function mapBackendPolicy(raw: any): Policy {
  return {
    id: String(raw?.id ?? `policy_${Date.now()}`),
    title: raw?.title ?? '',
    category: raw?.category ?? '',
    agency: raw?.agency ?? '정책기관',
    content: raw?.content ?? raw?.description ?? '',
    targetCriteria: Array.isArray(raw?.eligibility) ? raw.eligibility.join(', ') : raw?.target ?? '',
    description: raw?.description ?? raw?.content ?? '',
    target: raw?.target ?? raw?.targetCriteria ?? '',
    support: raw?.support ?? raw?.howToApply ?? '',
    targetTypes: Array.isArray(raw?.targetTypes) ? raw.targetTypes : undefined,
  };
}

export function mapBackendNotification(raw: any): NotificationItem {
  return {
    id: String(raw?.id ?? raw?.notificationId ?? `notification_${Date.now()}`),
    type: raw?.type === 'chat' ? 'chat' : raw?.type === 'share' ? 'share' : 'system',
    relatedType: raw?.relatedType,
    relatedId: raw?.relatedId,
    notificationTypeCode: raw?.notificationTypeCode ?? raw?.notificationType,
    title: raw?.title ?? '알림',
    message: raw?.message ?? '',
    timeLabel: formatTimeAgo(raw?.createdAt ?? new Date().toISOString()),
    isRead: Boolean(raw?.isRead),
  };
}

export function mapBackendDynamicQrSession(
  raw: any,
  fallback: { memberId: string; purpose: DynamicQrPurpose; ttlSeconds: number },
): DynamicQrSession {
  const issuedAt = raw?.issuedAt ?? new Date().toISOString();
  const expiresAt =
    raw?.expiresAt ??
    new Date(new Date(issuedAt).getTime() + (raw?.ttlSeconds ?? fallback.ttlSeconds) * 1000).toISOString();

  return {
    id: String(raw?.id ?? `dynamic_qr_${Date.now()}`),
    memberId: String(raw?.memberId ?? fallback.memberId),
    purpose: raw?.purpose ?? fallback.purpose,
    token: raw?.token ?? '',
    displayCode: raw?.displayCode ?? raw?.code ?? '',
    issuedAt,
    expiresAt,
    status: raw?.status ?? 'active',
    ttlSeconds: Number(raw?.ttlSeconds ?? fallback.ttlSeconds),
    usedAt: raw?.usedAt ?? null,
  };
}
