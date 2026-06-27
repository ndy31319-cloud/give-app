export type PostType = 'share' | 'need';
export type DonateStatus =
  | 'open'
  | 'reserved'
  | 'storage_requested'
  | 'stored'
  | 'completed'
  | 'canceled';
export type RequestStatus = 'open' | 'completed' | 'canceled' | 'hidden' | 'pickup_pending';
export type PostStatus = DonateStatus | RequestStatus;
export type RoleCode = 'USER' | 'BENEFICIARY' | 'ADMIN';
export type CertificationCodeStatus = 'unused' | 'used' | 'expired';
export type DynamicQrPurpose = 'donation_access' | 'donation_storage' | 'pickup_access' | 'pickup_auth';
export type DynamicQrStatus = 'active' | 'used' | 'expired';
export type NotificationType = 'share' | 'chat' | 'system';
export type NotificationRelatedType =
  | 'donate'
  | 'request'
  | 'chat_room'
  | 'chat_message'
  | 'pickup_request'
  | 'review'
  | 'policy'
  | 'notice'
  | 'report'
  | 'system';
export type NotificationTypeCode =
  | 'chat_message'
  | 'donate_reserved'
  | 'donate_completed'
  | 'request_matched'
  | 'pickup_request'
  | 'review_created'
  | 'notice'
  | 'system';
export type ChatMessageType = 'TEXT' | 'IMAGE' | 'SYSTEM';
export type ChatRoomStatus = 'open' | 'closed';
export type ReportTargetType = 'post' | 'comment' | 'member';
export type ReportStatus = 'received' | 'processing' | 'resolved' | 'rejected';
export type PickupRequestStatus = 'pending' | 'approved' | 'rejected' | 'picked_up';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';
export type DeviceSimulationStep =
  | 'idle'
  | 'qr_scanned'
  | 'server_validating'
  | 'locker_open'
  | 'awaiting_item'
  | 'item_detected'
  | 'server_updating'
  | 'completed'
  | 'error';

export interface NeighborhoodLocation {
  id: string;
  city: string;
  district: string;
  neighborhood: string;
  dongName: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface UploadableImage {
  uri: string;
  name: string;
  type: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface User {
  id: string;
  roleId: string;
  roleCode: RoleCode;
  name: string;
  nickname: string;
  email: string;
  phone?: string;
  dongName: string;
  isVulnerable: boolean;
  vulnerableTypes?: string[];
  location: NeighborhoodLocation;
  neighborhoods?: NeighborhoodLocation[];
  profileImage?: string;
  birthdate?: string;
  bio?: string;
  certificateImage?: UploadableImage | null;
  createdAt?: string;
}

export interface SignupDraft {
  name?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  password?: string;
  birthdate?: string;
  isVulnerable?: boolean;
  vulnerableTypes?: string[];
  certificateImage?: UploadableImage | null;
}

export interface SignupPreset {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  birthdate: string;
  email: string;
  password: string;
  locationId: string;
  isVulnerable: boolean;
  vulnerableTypes: string[];
  description: string;
}

export interface MemberRecord {
  memberId: string;
  roleId: string;
  roleName: RoleCode;
  memberPw: string;
  name: string;
  nickname: string;
  email: string;
  phone: string;
  dongName: string;
  birthdate?: string;
  profileImage?: string;
  bio?: string;
  createdAt: string;
}

export interface RoleRecord {
  roleId: string;
  roleName: RoleCode;
  description: string;
}

export interface CertificationCodeRecord {
  certificationCodeId: string;
  code: string;
  issuedFor: string;
  memberId?: string | null;
  isUsed: boolean;
  status: CertificationCodeStatus;
  createdAt: string;
  usedAt?: string | null;
}

export interface DynamicQrSession {
  id: string;
  memberId: string;
  donateId?: string | null;
  purpose: DynamicQrPurpose;
  token: string;
  displayCode: string;
  issuedAt: string;
  expiresAt: string;
  status: DynamicQrStatus;
  ttlSeconds: number;
  usedAt?: string | null;
}

export interface DeviceSimulationState {
  step: DeviceSimulationStep;
  sessionId?: string | null;
  token?: string | null;
  message: string;
  lockerOpen: boolean;
  itemDetected: boolean;
  lastUpdatedAt?: string;
}

export interface ProductCategoryRecord {
  id: string;
  label: string;
}

export interface ProductRecord {
  productId: string;
  category: string;
  productName: string;
  categoryLabel?: string;
}

export interface ItemRecord {
  itemId: string;
  productId: string;
  itemName: string;
  itemCondition: string;
  donateId?: string;
  requestId?: string;
}

export interface DonatePostRecord {
  donateId: string;
  memberId: string;
  title: string;
  content: string;
  status: DonateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DonateImageRecord {
  donateImageId: string;
  donateId: string;
  imageUrl: string;
  createdAt: string;
}

export interface DonateLikeRecord {
  donateId: string;
  memberId: string;
}

export interface RequestPostRecord {
  requestId: string;
  memberId: string;
  title: string;
  content: string | null;
  createdFrom?: 'app' | 'web';
  urgency: UrgencyLevel;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RequestImageRecord {
  requestImageId: string;
  requestId: string;
  imageUrl: string;
  createdAt: string;
}

export interface RequestLikeRecord {
  requestId: string;
  memberId: string;
}

export interface CommunityPostRecord {
  postId: string;
  memberId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityLikeRecord {
  postId: string;
  memberId: string;
}

export interface CommunityCommentRecord {
  commentId: string;
  postId: string;
  memberId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoomRecord {
  chatRoomId: string;
  donorId: string;
  requesterId: string;
  donateId?: string | null;
  requestId?: string | null;
  roomStatus: ChatRoomStatus;
  createdAt: string;
}

export interface ChatMessageRecord {
  messageId: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  messageType: ChatMessageType;
  isRead: boolean;
  createdAt: string;
}

export interface Policy {
  id: string;
  title: string;
  category: string;
  agency: string;
  content: string;
  targetCriteria: string;
  description: string;
  target: string;
  support: string;
  targetTypes?: string[];
}

export interface SearchHistoryRecord {
  searchHistoryId: string;
  memberId: string;
  queryText: string;
  recommendPolicyId?: string | null;
  policyId?: string | null;
  createdAt: string;
}

export interface ReportRecord {
  reportId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export interface NoticeRecord {
  noticeId: string;
  adminId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PickupRequestRecord {
  pickupRequestId: string;
  memberId: string;
  donateId: string;
  status: PickupRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  notificationId: string;
  memberId: string;
  relatedType: NotificationRelatedType;
  relatedId: string;
  notificationType: NotificationTypeCode;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ReviewRecord {
  reviewId: string;
  donateId: string;
  writerId: string;
  targetMemberId: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface PostAuthor {
  id: string;
  name: string;
  nickname?: string;
  temperature: number;
  profileImage?: string;
}

export interface Post {
  id: string;
  recordId: string;
  type: PostType;
  title: string;
  description: string;
  createdFrom?: 'app' | 'web';
  category: string;
  productId?: string;
  itemName?: string;
  itemCondition?: string;
  location: NeighborhoodLocation;
  status: PostStatus;
  urgency?: UrgencyLevel;
  images: string[];
  imageFiles?: UploadableImage[];
  author: PostAuthor;
  createdAt: string;
  updatedAt?: string;
  views?: number;
  favoriteCount?: number;
  aiDetectedItem?: string;
}

export interface ChatRoom {
  id: string;
  roomStatus: ChatRoomStatus;
  donorId: string;
  requesterId: string;
  userId: string;
  userName: string;
  userNickname?: string;
  userLocation: string;
  postId?: string;
  postType?: PostType;
  lastMessage: string;
  timeLabel: string;
  unreadCount: number;
  mannerTemperature: number;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'other';
  senderId?: string;
  text: string;
  messageType?: ChatMessageType;
  timeLabel: string;
  isRead?: boolean;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  relatedType?: NotificationRelatedType;
  relatedId?: string;
  notificationTypeCode?: NotificationTypeCode;
  title: string;
  message: string;
  timeLabel: string;
  isRead: boolean;
}

export interface ShareHistoryItem {
  id: string;
  title: string;
  date: string;
  status: 'completed' | 'inProgress';
  image: string;
  review?: {
    message: string;
    rating: number;
    from: string;
  };
}

export interface SearchFilters {
  type: 'all' | PostType;
  status: 'all' | PostStatus;
  distanceKm: number;
}

export interface ImageAnalysisResult {
  isHarmful: boolean;
  reason?: string;
  confidence: number;
  detectedItem: string;
  recommendedCategory?: string;
  recommendedCategoryLabel?: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  isSameItem?: boolean;
  extractedFeatures?: string[];
  aiGeneratedPost?: string;
  rawAiResult?: unknown;
}

export interface CreatePostInput {
  type: PostType;
  title: string;
  description: string;
  category: string;
  productId?: string;
  itemName: string;
  itemCondition: string;
  location: NeighborhoodLocation;
  images: UploadableImage[];
  aiAnalysis?: ImageAnalysisResult | null;
  urgency?: UrgencyLevel;
}

export interface UpdatePostInput {
  postId: string;
  type: PostType;
  title: string;
  description: string;
  category: string;
  productId?: string;
  itemName: string;
  itemCondition: string;
  urgency?: UrgencyLevel;
}
