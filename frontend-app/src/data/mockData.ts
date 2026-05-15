import {
  CertificationCodeRecord,
  ChatMessage,
  ChatMessageRecord,
  ChatRoom,
  ChatRoomRecord,
  CommunityCommentRecord,
  CommunityLikeRecord,
  CommunityPostRecord,
  DonateImageRecord,
  DonateLikeRecord,
  DonatePostRecord,
  ItemRecord,
  MemberRecord,
  NeighborhoodLocation,
  NoticeRecord,
  NotificationItem,
  NotificationRecord,
  PickupRequestRecord,
  Policy,
  Post,
  ProductCategoryRecord,
  ProductRecord,
  ReportRecord,
  RequestImageRecord,
  RequestLikeRecord,
  RequestPostRecord,
  ReviewRecord,
  RoleRecord,
  RoleCode,
  SearchHistoryRecord,
  ShareHistoryItem,
  SignupPreset,
  User,
} from '@/src/types/app';

const defaultRadiusKm = 5;
const currentMemberId = 'member_1';

function withRadius(location: Omit<NeighborhoodLocation, 'radiusKm' | 'dongName'>): NeighborhoodLocation {
  return { ...location, dongName: location.neighborhood, radiusKm: defaultRadiusKm };
}

export const neighborhoodOptions: NeighborhoodLocation[] = [
  withRadius({
    id: 'yeoksam',
    city: '서울시',
    district: '강남구',
    neighborhood: '역삼동',
    fullAddress: '서울시 강남구 역삼동',
    latitude: 37.5007,
    longitude: 127.0365,
  }),
  withRadius({
    id: 'samsung',
    city: '서울시',
    district: '강남구',
    neighborhood: '삼성동',
    fullAddress: '서울시 강남구 삼성동',
    latitude: 37.5146,
    longitude: 127.0567,
  }),
  withRadius({
    id: 'nonhyeon',
    city: '서울시',
    district: '강남구',
    neighborhood: '논현동',
    fullAddress: '서울시 강남구 논현동',
    latitude: 37.5115,
    longitude: 127.0286,
  }),
  withRadius({
    id: 'seocho',
    city: '서울시',
    district: '서초구',
    neighborhood: '서초동',
    fullAddress: '서울시 서초구 서초동',
    latitude: 37.4905,
    longitude: 127.0194,
  }),
  withRadius({
    id: 'banpo',
    city: '서울시',
    district: '서초구',
    neighborhood: '반포동',
    fullAddress: '서울시 서초구 반포동',
    latitude: 37.5049,
    longitude: 127.0112,
  }),
  withRadius({
    id: 'jamsil',
    city: '서울시',
    district: '송파구',
    neighborhood: '잠실동',
    fullAddress: '서울시 송파구 잠실동',
    latitude: 37.5119,
    longitude: 127.0859,
  }),
  withRadius({
    id: 'munjeong',
    city: '서울시',
    district: '송파구',
    neighborhood: '문정동',
    fullAddress: '서울시 송파구 문정동',
    latitude: 37.4865,
    longitude: 127.1227,
  }),
  withRadius({
    id: 'bangbae',
    city: '서울시',
    district: '서초구',
    neighborhood: '방배동',
    fullAddress: '서울시 서초구 방배동',
    latitude: 37.4819,
    longitude: 126.9973,
  }),
];

export const mockRoles: RoleRecord[] = [
  { roleId: 'role_user', roleName: 'USER', description: '일반 회원' },
  { roleId: 'role_beneficiary', roleName: 'BENEFICIARY', description: '취약계층 인증 회원' },
  { roleId: 'role_admin', roleName: 'ADMIN', description: '관리자' },
];

export function locationById(id: string) {
  return neighborhoodOptions.find((location) => location.id === id) ?? neighborhoodOptions[0];
}

export function findLocationByDongName(dongName: string) {
  return (
    neighborhoodOptions.find((location) => location.dongName === dongName) ??
    neighborhoodOptions.find((location) => location.neighborhood === dongName) ??
    neighborhoodOptions[0]
  );
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function toTimeLabel(isoString: string) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function getRoleId(isVulnerable: boolean) {
  return isVulnerable ? 'role_beneficiary' : 'role_user';
}

function getRoleName(isVulnerable: boolean): RoleCode {
  return isVulnerable ? 'BENEFICIARY' : 'USER';
}

export const mockSignupPresets: SignupPreset[] = [
  { id: 'preset_01', name: '김하린', nickname: '하린맘', phone: '010-1234-1001', birthdate: '1991-03-12', email: 'harin01@example.com', password: 'Give1234', locationId: 'yeoksam', isVulnerable: true, vulnerableTypes: ['single_parent'], description: '한부모가정 예시' },
  { id: 'preset_02', name: '박준서', nickname: '준서책방', phone: '010-1234-1002', birthdate: '1988-07-21', email: 'junseo02@example.com', password: 'Give1234', locationId: 'samsung', isVulnerable: false, vulnerableTypes: [], description: '일반 회원 예시' },
  { id: 'preset_03', name: '이도윤', nickname: '도윤아빠', phone: '010-1234-1003', birthdate: '1994-01-09', email: 'doyoon03@example.com', password: 'Give1234', locationId: 'nonhyeon', isVulnerable: true, vulnerableTypes: ['near_poverty'], description: '차상위계층 예시' },
  { id: 'preset_04', name: '최수아', nickname: '수아나눔', phone: '010-1234-1004', birthdate: '1997-09-15', email: 'sua04@example.com', password: 'Give1234', locationId: 'seocho', isVulnerable: false, vulnerableTypes: [], description: '일반 회원 예시' },
  { id: 'preset_05', name: '정민재', nickname: '민재러너', phone: '010-1234-1005', birthdate: '1985-05-03', email: 'minjae05@example.com', password: 'Give1234', locationId: 'banpo', isVulnerable: true, vulnerableTypes: ['disabled'], description: '장애인 회원 예시' },
  { id: 'preset_06', name: '윤지안', nickname: '지안살림', phone: '010-1234-1006', birthdate: '1990-11-28', email: 'jian06@example.com', password: 'Give1234', locationId: 'jamsil', isVulnerable: false, vulnerableTypes: [], description: '일반 회원 예시' },
  { id: 'preset_07', name: '강서진', nickname: '서진스마일', phone: '010-1234-1007', birthdate: '1999-06-17', email: 'seojin07@example.com', password: 'Give1234', locationId: 'munjeong', isVulnerable: true, vulnerableTypes: ['youth'], description: '청소년/청년 예시' },
  { id: 'preset_08', name: '한예나', nickname: '예나홈', phone: '010-1234-1008', birthdate: '1993-02-06', email: 'yena08@example.com', password: 'Give1234', locationId: 'bangbae', isVulnerable: false, vulnerableTypes: [], description: '일반 회원 예시' },
  { id: 'preset_09', name: '오지훈', nickname: '지훈테크', phone: '010-1234-1009', birthdate: '1987-08-30', email: 'jihun09@example.com', password: 'Give1234', locationId: 'yeoksam', isVulnerable: false, vulnerableTypes: [], description: '전자제품 나눔 예시' },
  { id: 'preset_10', name: '배유진', nickname: '유진쉼표', phone: '010-1234-1010', birthdate: '1995-12-25', email: 'yujin10@example.com', password: 'Give1234', locationId: 'samsung', isVulnerable: true, vulnerableTypes: ['basic_livelihood'], description: '기초생활수급자 예시' },
  { id: 'preset_11', name: '송시우', nickname: '시우키친', phone: '010-1234-1011', birthdate: '1992-04-11', email: 'siwoo11@example.com', password: 'Give1234', locationId: 'nonhyeon', isVulnerable: false, vulnerableTypes: [], description: '생활용품 나눔 예시' },
  { id: 'preset_12', name: '임유리', nickname: '유리아이', phone: '010-1234-1012', birthdate: '1989-10-01', email: 'yuri12@example.com', password: 'Give1234', locationId: 'seocho', isVulnerable: true, vulnerableTypes: ['single_parent'], description: '육아 지원 예시' },
  { id: 'preset_13', name: '서도현', nickname: '도현스터디', phone: '010-1234-1013', birthdate: '2000-01-14', email: 'dohyun13@example.com', password: 'Give1234', locationId: 'banpo', isVulnerable: true, vulnerableTypes: ['youth'], description: '교육 지원 예시' },
  { id: 'preset_14', name: '문채린', nickname: '채린옷장', phone: '010-1234-1014', birthdate: '1996-07-08', email: 'chaerin14@example.com', password: 'Give1234', locationId: 'jamsil', isVulnerable: false, vulnerableTypes: [], description: '의류 나눔 예시' },
  { id: 'preset_15', name: '조태양', nickname: '태양북스', phone: '010-1234-1015', birthdate: '1986-03-18', email: 'taeyang15@example.com', password: 'Give1234', locationId: 'munjeong', isVulnerable: true, vulnerableTypes: ['elderly'], description: '노인 지원 예시' },
  { id: 'preset_16', name: '신다은', nickname: '다은마켓', phone: '010-1234-1016', birthdate: '1998-05-27', email: 'daeun16@example.com', password: 'Give1234', locationId: 'bangbae', isVulnerable: false, vulnerableTypes: [], description: '일반 회원 예시' },
  { id: 'preset_17', name: '권현우', nickname: '현우맘', phone: '010-1234-1017', birthdate: '1990-09-02', email: 'hyunwoo17@example.com', password: 'Give1234', locationId: 'yeoksam', isVulnerable: true, vulnerableTypes: ['near_poverty'], description: '주거 지원 예시' },
  { id: 'preset_18', name: '류소민', nickname: '소민온기', phone: '010-1234-1018', birthdate: '1994-06-04', email: 'somin18@example.com', password: 'Give1234', locationId: 'samsung', isVulnerable: false, vulnerableTypes: [], description: '일반 회원 예시' },
  { id: 'preset_19', name: '백이안', nickname: '이안희망', phone: '010-1234-1019', birthdate: '1991-01-22', email: 'ian19@example.com', password: 'Give1234', locationId: 'nonhyeon', isVulnerable: true, vulnerableTypes: ['disabled'], description: '복지 지원 예시' },
  { id: 'preset_20', name: '노가온', nickname: '가온이웃', phone: '010-1234-1020', birthdate: '1997-08-19', email: 'gaon20@example.com', password: 'Give1234', locationId: 'seocho', isVulnerable: false, vulnerableTypes: [], description: '일반 회원 예시' },
];

export const mockMembers: MemberRecord[] = [
  ...mockSignupPresets.map((preset, index) => ({
    memberId: `member_${index + 1}`,
    roleId: getRoleId(preset.isVulnerable),
    roleName: getRoleName(preset.isVulnerable),
    memberPw: preset.password,
    name: preset.name,
    nickname: preset.nickname,
    email: preset.email,
    phone: preset.phone,
    dongName: locationById(preset.locationId).dongName,
    birthdate: preset.birthdate,
    bio: `${preset.description} 기반 테스트용 회원입니다.`,
    createdAt: isoDaysAgo(index + 1),
  })),
  {
    memberId: 'member_admin',
    roleId: 'role_admin',
    roleName: 'ADMIN',
    memberPw: 'Admin1234',
    name: '관리자',
    nickname: '운영팀',
    email: 'admin@give.local',
    phone: '010-9999-0000',
    dongName: '역삼동',
    createdAt: isoDaysAgo(120),
  },
];

const memberVulnerabilityMap = new Map(
  mockSignupPresets.map((preset, index) => [
    `member_${index + 1}`,
    { isVulnerable: preset.isVulnerable, vulnerableTypes: preset.vulnerableTypes, locationId: preset.locationId },
  ]),
);

const mannerTemperatureMap: Record<string, number> = {
  member_1: 37.8,
  member_2: 38.5,
  member_3: 36.9,
  member_4: 39.1,
  member_5: 37.4,
  member_6: 36.8,
  member_7: 39.4,
  member_8: 37.1,
  member_9: 38.2,
  member_10: 37.9,
};

export function mapMemberToUser(member: MemberRecord, overrides?: Partial<User>): User {
  const vulnerability = memberVulnerabilityMap.get(member.memberId);
  const location = vulnerability ? locationById(vulnerability.locationId) : findLocationByDongName(member.dongName);

  return {
    id: member.memberId,
    roleId: member.roleId,
    roleCode: member.roleName,
    name: member.name,
    nickname: member.nickname,
    email: member.email,
    phone: member.phone,
    dongName: member.dongName,
    isVulnerable: vulnerability?.isVulnerable ?? member.roleName === 'BENEFICIARY',
    vulnerableTypes: vulnerability?.vulnerableTypes ?? [],
    location,
    bio: member.bio,
    birthdate: member.birthdate,
    createdAt: member.createdAt,
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<User>): User {
  return mapMemberToUser(mockMembers[0], overrides);
}

export function findMockMemberByPhone(phone: string) {
  const normalized = phone.replace(/-/g, '');
  return mockMembers.find((member) => member.phone.replace(/-/g, '') === normalized);
}

export const mockCertificationCodes: CertificationCodeRecord[] = [
  { certificationCodeId: 'cert_1', code: 'BENE-2026-0001', issuedFor: '기초생활수급자', memberId: 'member_10', isUsed: true, status: 'used', createdAt: isoDaysAgo(20), usedAt: isoDaysAgo(18) },
  { certificationCodeId: 'cert_2', code: 'BENE-2026-0002', issuedFor: '차상위계층', memberId: null, isUsed: false, status: 'unused', createdAt: isoDaysAgo(15), usedAt: null },
  { certificationCodeId: 'cert_3', code: 'BENE-2026-0003', issuedFor: '한부모가정', memberId: 'member_1', isUsed: true, status: 'used', createdAt: isoDaysAgo(14), usedAt: isoDaysAgo(10) },
  { certificationCodeId: 'cert_4', code: 'BENE-2026-0004', issuedFor: '장애인', memberId: null, isUsed: false, status: 'unused', createdAt: isoDaysAgo(7), usedAt: null },
];

export const mockProductCategories: ProductCategoryRecord[] = [
  { id: 'clothing', label: '의류' },
  { id: 'electronics', label: '전자제품' },
  { id: 'furniture', label: '가구' },
  { id: 'books', label: '도서' },
  { id: 'household', label: '생활용품' },
  { id: 'baby', label: '육아용품' },
  { id: 'kitchen', label: '주방용품' },
  { id: 'digital', label: '디지털기기' },
];

export const mockProducts: ProductRecord[] = [
  { productId: 'product_1', category: 'clothing', productName: '겨울 외투' },
  { productId: 'product_2', category: 'baby', productName: '아기 옷' },
  { productId: 'product_3', category: 'household', productName: '생활용품 세트' },
  { productId: 'product_4', category: 'books', productName: '도서 세트' },
  { productId: 'product_5', category: 'electronics', productName: '노트북' },
  { productId: 'product_6', category: 'furniture', productName: '책상' },
  { productId: 'product_7', category: 'kitchen', productName: '조리도구 세트' },
  { productId: 'product_8', category: 'digital', productName: '태블릿' },
];

export const mockDonatePosts: DonatePostRecord[] = [
  { donateId: 'donate_1', memberId: 'member_2', title: '겨울 외투 나눔', content: '겨울 옷 정리하다가 새 외투가 나와서 나눔합니다. 사이즈는 100(L)이고 상태 좋습니다.', status: 'open', createdAt: isoHoursAgo(2), updatedAt: isoHoursAgo(2) },
  { donateId: 'donate_2', memberId: 'member_4', title: '생활용품 나눔', content: '이사하면서 정리한 생활용품 세트예요. 컵, 접시, 수저 등이 들어 있습니다.', status: 'reserved', createdAt: isoHoursAgo(6), updatedAt: isoHoursAgo(4) },
  { donateId: 'donate_3', memberId: 'member_5', title: '도서 나눔합니다', content: '소설, 에세이, 자기계발서를 정리해서 필요한 분께 드립니다.', status: 'completed', createdAt: isoDaysAgo(1), updatedAt: isoHoursAgo(12) },
  { donateId: 'donate_4', memberId: 'member_9', title: '공부용 노트북 나눔', content: '문서 작업과 인터넷 사용이 가능한 노트북입니다. 충전기 포함입니다.', status: 'storage_request', createdAt: isoDaysAgo(2), updatedAt: isoDaysAgo(1) },
  { donateId: 'donate_5', memberId: 'member_14', title: '접이식 책상 나눔', content: '좁은 공간에서도 쓰기 좋은 접이식 책상입니다.', status: 'stored', createdAt: isoDaysAgo(3), updatedAt: isoDaysAgo(2) },
];

export const mockDonateImages: DonateImageRecord[] = [
  { donateImageId: 'donate_img_1', donateId: 'donate_1', imageUrl: 'https://images.unsplash.com/photo-1740442535747-6c292f995539?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoHoursAgo(2) },
  { donateImageId: 'donate_img_2', donateId: 'donate_2', imageUrl: 'https://images.unsplash.com/photo-1654064756910-974764816931?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoHoursAgo(6) },
  { donateImageId: 'donate_img_3', donateId: 'donate_3', imageUrl: 'https://images.unsplash.com/photo-1542725752-e9f7259b3881?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoDaysAgo(1) },
  { donateImageId: 'donate_img_4', donateId: 'donate_4', imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoDaysAgo(2) },
  { donateImageId: 'donate_img_5', donateId: 'donate_5', imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoDaysAgo(3) },
];

export const mockDonateLikes: DonateLikeRecord[] = [
  { donateId: 'donate_1', memberId: 'member_1' },
  { donateId: 'donate_1', memberId: 'member_3' },
  { donateId: 'donate_2', memberId: 'member_1' },
  { donateId: 'donate_3', memberId: 'member_6' },
  { donateId: 'donate_4', memberId: 'member_7' },
];

export const mockRequestPosts: RequestPostRecord[] = [
  { requestId: 'request_1', memberId: 'member_1', title: '아기 옷 필요해요', content: '돌 지난 아기 옷이 필요합니다. 겨울옷이면 더 좋고 깨끗하게 입을게요.', urgency: 'high', status: 'open', createdAt: isoHoursAgo(4), updatedAt: isoHoursAgo(4) },
  { requestId: 'request_2', memberId: 'member_3', title: '노트북 구합니다', content: '문서 작업과 인터넷이 가능한 공부용 노트북이 필요합니다.', urgency: 'urgent', status: 'pickup_pending', createdAt: isoHoursAgo(12), updatedAt: isoHoursAgo(10) },
  { requestId: 'request_3', memberId: 'member_10', title: '생활용 가전 필요', content: '이사 후 소형 가전이 부족해서 상태 괜찮은 물품을 찾고 있습니다.', urgency: 'normal', status: 'completed', createdAt: isoDaysAgo(2), updatedAt: isoDaysAgo(1) },
  { requestId: 'request_4', memberId: 'member_12', title: '아이 책상 요청', content: '초등학생 공부용 책상이 필요합니다.', urgency: 'high', status: 'canceled', createdAt: isoDaysAgo(4), updatedAt: isoDaysAgo(3) },
];

export const mockRequestImages: RequestImageRecord[] = [
  { requestImageId: 'request_img_1', requestId: 'request_1', imageUrl: 'https://images.unsplash.com/photo-1622290291165-d341f1938b8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoHoursAgo(4) },
  { requestImageId: 'request_img_2', requestId: 'request_2', imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoHoursAgo(12) },
  { requestImageId: 'request_img_3', requestId: 'request_3', imageUrl: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoDaysAgo(2) },
  { requestImageId: 'request_img_4', requestId: 'request_4', imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', createdAt: isoDaysAgo(4) },
];

export const mockRequestLikes: RequestLikeRecord[] = [
  { requestId: 'request_1', memberId: 'member_2' },
  { requestId: 'request_1', memberId: 'member_4' },
  { requestId: 'request_2', memberId: 'member_5' },
  { requestId: 'request_3', memberId: 'member_1' },
];

export const mockItems: ItemRecord[] = [
  { itemId: 'item_1', productId: 'product_1', itemName: '패딩 외투', itemCondition: '거의 새것', donateId: 'donate_1' },
  { itemId: 'item_2', productId: 'product_3', itemName: '식기 세트', itemCondition: '사용감 적음', donateId: 'donate_2' },
  { itemId: 'item_3', productId: 'product_4', itemName: '도서 묶음', itemCondition: '깨끗함', donateId: 'donate_3' },
  { itemId: 'item_4', productId: 'product_5', itemName: '공부용 노트북', itemCondition: '충전기 포함', donateId: 'donate_4' },
  { itemId: 'item_5', productId: 'product_6', itemName: '접이식 책상', itemCondition: '생활기스 있음', donateId: 'donate_5' },
  { itemId: 'item_6', productId: 'product_2', itemName: '유아 겨울옷', itemCondition: '깨끗함', requestId: 'request_1' },
  { itemId: 'item_7', productId: 'product_5', itemName: '노트북', itemCondition: '문서 작업 가능', requestId: 'request_2' },
  { itemId: 'item_8', productId: 'product_7', itemName: '소형 가전', itemCondition: '작동 가능', requestId: 'request_3' },
  { itemId: 'item_9', productId: 'product_6', itemName: '학생용 책상', itemCondition: '사용 가능', requestId: 'request_4' },
];

export const mockCommunityPosts: CommunityPostRecord[] = [
  { postId: 'community_1', memberId: 'member_4', title: '역삼동 무료 나눔 행사 정보', content: '이번 주말 주민센터 앞에서 무료 나눔 행사가 열린다고 합니다.', createdAt: isoDaysAgo(2), updatedAt: isoDaysAgo(2) },
  { postId: 'community_2', memberId: 'member_7', title: '육아용품 교환 모임 찾습니다', content: '근처에서 육아용품 교환 모임 하실 분 계실까요?', createdAt: isoDaysAgo(1), updatedAt: isoDaysAgo(1) },
];

export const mockCommunityLikes: CommunityLikeRecord[] = [
  { postId: 'community_1', memberId: 'member_1' },
  { postId: 'community_1', memberId: 'member_2' },
  { postId: 'community_2', memberId: 'member_3' },
];

export const mockCommunityComments: CommunityCommentRecord[] = [
  { commentId: 'comment_1', postId: 'community_1', memberId: 'member_1', content: '좋은 정보 감사합니다!', createdAt: isoDaysAgo(2), updatedAt: isoDaysAgo(2) },
  { commentId: 'comment_2', postId: 'community_2', memberId: 'member_5', content: '저도 같이 참여하고 싶어요.', createdAt: isoDaysAgo(1), updatedAt: isoDaysAgo(1) },
];

export const mockChatRoomRecords: ChatRoomRecord[] = [
  { chatRoomId: 'chat_room_1', donorId: 'member_2', requesterId: 'member_1', donateId: 'donate_1', requestId: null, roomStatus: 'open', createdAt: isoHoursAgo(3) },
  { chatRoomId: 'chat_room_2', donorId: 'member_9', requesterId: 'member_3', donateId: 'donate_4', requestId: null, roomStatus: 'open', createdAt: isoHoursAgo(18) },
  { chatRoomId: 'chat_room_3', donorId: 'member_4', requesterId: 'member_1', donateId: null, requestId: 'request_1', roomStatus: 'closed', createdAt: isoDaysAgo(3) },
];

export const mockChatMessageRecords: ChatMessageRecord[] = [
  { messageId: 'message_1', chatRoomId: 'chat_room_1', senderId: 'member_2', content: '안녕하세요! 외투 아직 가능할까요?', messageType: 'TEXT', isRead: false, createdAt: isoHoursAgo(2.5) },
  { messageId: 'message_2', chatRoomId: 'chat_room_1', senderId: 'member_1', content: '네 가능해요. 오늘 오후에 전달 가능합니다.', messageType: 'TEXT', isRead: true, createdAt: isoHoursAgo(2.3) },
  { messageId: 'message_3', chatRoomId: 'chat_room_1', senderId: 'member_2', content: '좋아요! 3시에 역삼역 근처 괜찮으세요?', messageType: 'TEXT', isRead: false, createdAt: isoHoursAgo(2) },
  { messageId: 'message_4', chatRoomId: 'chat_room_2', senderId: 'member_3', content: '노트북 상태가 어떤가요?', messageType: 'TEXT', isRead: false, createdAt: isoHoursAgo(16) },
  { messageId: 'message_5', chatRoomId: 'chat_room_3', senderId: 'member_4', content: '아기 옷 몇 벌 챙겨둘게요.', messageType: 'TEXT', isRead: true, createdAt: isoDaysAgo(2) },
  { messageId: 'message_6', chatRoomId: 'chat_room_3', senderId: 'member_1', content: '정말 감사합니다!', messageType: 'TEXT', isRead: true, createdAt: isoDaysAgo(2) },
];

export const mockPolicies: Policy[] = [
  { id: 'policy_1', title: '긴급복지 생계지원', category: '생활비', agency: '보건복지부', content: '갑작스러운 위기상황으로 생계유지가 어려운 저소득 가구를 지원합니다.', targetCriteria: '기초생활수급자, 긴급 위기가구', description: '갑작스러운 위기상황으로 생계유지가 어려운 저소득 가구를 지원합니다.', target: '기초생활수급자, 긴급 위기가구', support: '월 최대 62만원', targetTypes: ['basic_livelihood', 'near_poverty'] },
  { id: 'policy_2', title: '주거급여 지원', category: '주거', agency: '국토교통부', content: '저소득층의 주거비 부담을 줄이기 위한 임차료 지원 제도입니다.', targetCriteria: '중위소득 47% 이하', description: '저소득층의 주거비 부담을 줄이기 위한 임차료 지원 제도입니다.', target: '중위소득 47% 이하', support: '월 최대 31만원', targetTypes: ['basic_livelihood', 'near_poverty', 'single_parent'] },
  { id: 'policy_3', title: '의료비 긴급지원', category: '의료', agency: '국민건강보험공단', content: '갑작스러운 질병, 부상으로 인한 본인 부담 의료비를 지원합니다.', targetCriteria: '저소득 가구, 중증질환자', description: '갑작스러운 질병, 부상으로 인한 본인 부담 의료비를 지원합니다.', target: '저소득 가구, 중증질환자', support: '최대 300만원', targetTypes: ['basic_livelihood', 'disabled', 'elderly'] },
  { id: 'policy_4', title: '한부모가정 아동양육비', category: '양육', agency: '여성가족부', content: '한부모가정의 아동 양육을 지원하는 정책입니다.', targetCriteria: '한부모가정, 청소년 한부모', description: '한부모가정의 아동 양육을 지원하는 정책입니다.', target: '한부모가정, 청소년 한부모', support: '자녀 1인당 월 20만원', targetTypes: ['single_parent'] },
  { id: 'policy_5', title: '노인 일자리 지원사업', category: '일자리', agency: '보건복지부', content: '노인의 사회참여와 소득 보충을 위한 일자리를 제공합니다.', targetCriteria: '만 65세 이상 기초연금 수급자', description: '노인의 사회참여와 소득 보충을 위한 일자리를 제공합니다.', target: '만 65세 이상 기초연금 수급자', support: '월 27만원', targetTypes: ['elderly'] },
  { id: 'policy_6', title: '청소년 교육비 지원', category: '교육', agency: '교육부', content: '저소득층 청소년의 교육비를 지원합니다.', targetCriteria: '기초생활수급자, 차상위계층 자녀', description: '저소득층 청소년의 교육비를 지원합니다.', target: '기초생활수급자, 차상위계층 자녀', support: '학기당 최대 80만원', targetTypes: ['youth', 'basic_livelihood', 'near_poverty'] },
  { id: 'policy_7', title: '장애인 활동지원 서비스', category: '복지', agency: '보건복지부', content: '장애인의 자립생활과 사회참여를 지원합니다.', targetCriteria: '만 6세~64세 장애인', description: '장애인의 자립생활과 사회참여를 지원합니다.', target: '만 6세~64세 장애인', support: '월 최대 120시간', targetTypes: ['disabled'] },
];

export const mockSearchHistory: SearchHistoryRecord[] = [
  { searchHistoryId: 'search_1', memberId: 'member_1', queryText: '긴급복지', recommendPolicyId: 'policy_1', policyId: 'policy_1', createdAt: isoDaysAgo(1) },
  { searchHistoryId: 'search_2', memberId: 'member_1', queryText: '주거 지원', recommendPolicyId: 'policy_2', policyId: 'policy_2', createdAt: isoHoursAgo(10) },
  { searchHistoryId: 'search_3', memberId: 'member_10', queryText: '교육비', recommendPolicyId: 'policy_6', policyId: 'policy_6', createdAt: isoHoursAgo(5) },
];

export const mockReports: ReportRecord[] = [
  { reportId: 'report_1', reporterId: 'member_1', targetType: 'post', targetId: 'donate_5', reason: '허위 정보 의심', status: 'received', createdAt: isoDaysAgo(2) },
  { reportId: 'report_2', reporterId: 'member_3', targetType: 'member', targetId: 'member_9', reason: '연락 두절', status: 'processing', createdAt: isoDaysAgo(1) },
];

export const mockNotices: NoticeRecord[] = [
  { noticeId: 'notice_1', adminId: 'member_admin', title: '서비스 점검 안내', content: '이번 주 토요일 새벽 2시부터 4시까지 점검이 진행됩니다.', createdAt: isoDaysAgo(3), updatedAt: isoDaysAgo(3) },
  { noticeId: 'notice_2', adminId: 'member_admin', title: '유해물품 등록 제한 안내', content: '의약품, 무기류, 주류, 담배는 등록이 제한됩니다.', createdAt: isoDaysAgo(1), updatedAt: isoDaysAgo(1) },
];

export const mockPickupRequests: PickupRequestRecord[] = [
  { pickupRequestId: 'pickup_1', memberId: 'member_1', donateId: 'donate_2', status: 'pending', createdAt: isoHoursAgo(14), updatedAt: isoHoursAgo(14) },
  { pickupRequestId: 'pickup_2', memberId: 'member_3', donateId: 'donate_3', status: 'picked_up', createdAt: isoDaysAgo(5), updatedAt: isoDaysAgo(4) },
];

export const mockNotificationRecords: NotificationRecord[] = [
  { notificationId: 'notification_1', memberId: 'member_1', relatedType: 'chat_message', relatedId: 'chat_room_1', notificationType: 'chat_message', message: '하린맘님과의 채팅방에 새 메시지가 도착했습니다.', isRead: false, createdAt: isoHoursAgo(1) },
  { notificationId: 'notification_2', memberId: 'member_1', relatedType: 'donate', relatedId: 'donate_2', notificationType: 'donate_reserved', message: '생활용품 나눔글이 예약 상태로 변경되었습니다.', isRead: false, createdAt: isoHoursAgo(5) },
  { notificationId: 'notification_3', memberId: 'member_1', relatedType: 'review', relatedId: 'review_1', notificationType: 'review_created', message: '나눔 후기가 도착했습니다.', isRead: true, createdAt: isoDaysAgo(1) },
];

export const mockReviews: ReviewRecord[] = [
  { reviewId: 'review_1', donateId: 'donate_3', writerId: 'member_3', targetMemberId: 'member_5', rating: 5, content: '책 상태가 정말 좋았고 약속 시간도 잘 맞춰주셨어요.', createdAt: isoDaysAgo(1) },
  { reviewId: 'review_2', donateId: 'donate_2', writerId: 'member_1', targetMemberId: 'member_4', rating: 5, content: '생활용품이 깨끗해서 큰 도움이 됐어요.', createdAt: isoDaysAgo(2) },
];

function getProductById(productId?: string) {
  return mockProducts.find((product) => product.productId === productId);
}

function getMember(memberId: string) {
  return mockMembers.find((member) => member.memberId === memberId) ?? mockMembers[0];
}

function getItemByDonateId(donateId: string) {
  return mockItems.find((item) => item.donateId === donateId);
}

function getItemByRequestId(requestId: string) {
  return mockItems.find((item) => item.requestId === requestId);
}

function getDonateImages(donateId: string) {
  return mockDonateImages.filter((image) => image.donateId === donateId).map((image) => image.imageUrl);
}

function getRequestImages(requestId: string) {
  return mockRequestImages.filter((image) => image.requestId === requestId).map((image) => image.imageUrl);
}

function getFavoriteCountForDonate(donateId: string) {
  return mockDonateLikes.filter((like) => like.donateId === donateId).length;
}

function getFavoriteCountForRequest(requestId: string) {
  return mockRequestLikes.filter((like) => like.requestId === requestId).length;
}

function mapDonateStatusToViewStatus(status: DonatePostRecord['status']) {
  return status;
}

function mapRequestStatusToViewStatus(status: RequestPostRecord['status']) {
  return status;
}

function mapDonateToPost(record: DonatePostRecord): Post {
  const authorMember = getMember(record.memberId);
  const authorUser = mapMemberToUser(authorMember);
  const item = getItemByDonateId(record.donateId);
  const product = getProductById(item?.productId);

  return {
    id: record.donateId,
    recordId: record.donateId,
    type: 'share',
    title: record.title,
    description: record.content,
    category: product?.category ?? 'household',
    productId: product?.productId,
    location: authorUser.location,
    status: mapDonateStatusToViewStatus(record.status),
    images: getDonateImages(record.donateId),
    author: {
      id: authorUser.id,
      name: authorUser.name,
      nickname: authorUser.nickname,
      temperature: mannerTemperatureMap[authorUser.id] ?? 36.5,
      profileImage: authorUser.profileImage,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    favoriteCount: getFavoriteCountForDonate(record.donateId),
    views: 50 + getFavoriteCountForDonate(record.donateId) * 11,
    aiDetectedItem: item?.itemName,
  };
}

function mapRequestToPost(record: RequestPostRecord): Post {
  const authorMember = getMember(record.memberId);
  const authorUser = mapMemberToUser(authorMember);
  const item = getItemByRequestId(record.requestId);
  const product = getProductById(item?.productId);

  return {
    id: record.requestId,
    recordId: record.requestId,
    type: 'need',
    title: record.title,
    description: record.content,
    category: product?.category ?? 'household',
    productId: product?.productId,
    location: authorUser.location,
    status: mapRequestStatusToViewStatus(record.status),
    urgency: record.urgency,
    images: getRequestImages(record.requestId),
    author: {
      id: authorUser.id,
      name: authorUser.name,
      nickname: authorUser.nickname,
      temperature: mannerTemperatureMap[authorUser.id] ?? 36.5,
      profileImage: authorUser.profileImage,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    favoriteCount: getFavoriteCountForRequest(record.requestId),
    views: 40 + getFavoriteCountForRequest(record.requestId) * 9,
    aiDetectedItem: item?.itemName,
  };
}

export const mockPosts: Post[] = [...mockDonatePosts.map(mapDonateToPost), ...mockRequestPosts.map(mapRequestToPost)].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
);

function notificationTitleFor(record: NotificationRecord) {
  switch (record.notificationType) {
    case 'chat_message':
      return '새로운 채팅 메시지';
    case 'donate_reserved':
      return '나눔 예약 알림';
    case 'donate_completed':
      return '나눔 완료 알림';
    case 'pickup_request':
      return '수령 요청 알림';
    case 'review_created':
      return '후기 도착';
    case 'notice':
      return '공지사항';
    default:
      return '시스템 알림';
  }
}

function notificationUiType(record: NotificationRecord): NotificationItem['type'] {
  if (record.notificationType === 'chat_message') return 'chat';
  if (record.notificationType === 'donate_reserved' || record.notificationType === 'donate_completed') {
    return 'share';
  }
  return 'system';
}

export const mockNotifications: NotificationItem[] = mockNotificationRecords.map((record) => ({
  id: record.notificationId,
  type: notificationUiType(record),
  relatedType: record.relatedType,
  relatedId: record.relatedId,
  notificationTypeCode: record.notificationType,
  title: notificationTitleFor(record),
  message: record.message,
  timeLabel: toTimeLabel(record.createdAt),
  isRead: record.isRead,
}));

function mapChatRoomRecord(record: ChatRoomRecord): ChatRoom {
  const otherMemberId = record.requesterId === currentMemberId ? record.donorId : record.requesterId;
  const otherUser = mapMemberToUser(getMember(otherMemberId));
  const relatedMessages = mockChatMessageRecords
    .filter((message) => message.chatRoomId === record.chatRoomId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const lastMessage = relatedMessages.at(-1);
  const unreadCount = relatedMessages.filter(
    (message) => !message.isRead && message.senderId !== currentMemberId,
  ).length;

  return {
    id: record.chatRoomId,
    roomStatus: record.roomStatus,
    donorId: record.donorId,
    requesterId: record.requesterId,
    userId: otherUser.id,
    userName: otherUser.name,
    userNickname: otherUser.nickname,
    userLocation: otherUser.location.neighborhood,
    postId: record.donateId ?? record.requestId ?? undefined,
    postType: record.donateId ? 'share' : 'need',
    lastMessage: lastMessage?.content ?? '아직 메시지가 없습니다.',
    timeLabel: lastMessage ? toTimeLabel(lastMessage.createdAt) : toTimeLabel(record.createdAt),
    unreadCount,
    mannerTemperature: mannerTemperatureMap[otherUser.id] ?? 36.5,
  };
}

export const mockChatRooms: ChatRoom[] = mockChatRoomRecords.map(mapChatRoomRecord);

export const mockMessagesByChat: Record<string, ChatMessage[]> = mockChatRoomRecords.reduce(
  (accumulator, room) => {
    accumulator[room.chatRoomId] = mockChatMessageRecords
      .filter((message) => message.chatRoomId === room.chatRoomId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((message) => ({
        id: message.messageId,
        sender: message.senderId === currentMemberId ? 'me' : 'other',
        senderId: message.senderId,
        text: message.content,
        messageType: message.messageType,
        timeLabel: toTimeLabel(message.createdAt),
        isRead: message.isRead,
      }));
    return accumulator;
  },
  {} as Record<string, ChatMessage[]>,
);

export const mockShareHistory: ShareHistoryItem[] = [
  {
    id: 'share_history_1',
    title: '도서 나눔합니다',
    date: '2026.04.19',
    status: 'completed',
    image: getDonateImages('donate_3')[0],
    review: {
      message: mockReviews[0].content,
      rating: mockReviews[0].rating,
      from: mapMemberToUser(getMember(mockReviews[0].writerId)).name,
    },
  },
  {
    id: 'share_history_2',
    title: '생활용품 나눔',
    date: '2026.04.18',
    status: 'completed',
    image: getDonateImages('donate_2')[0],
    review: {
      message: mockReviews[1].content,
      rating: mockReviews[1].rating,
      from: mapMemberToUser(getMember(mockReviews[1].writerId)).name,
    },
  },
  {
    id: 'share_history_3',
    title: '공부용 노트북 나눔',
    date: '2026.04.17',
    status: 'inProgress',
    image: getDonateImages('donate_4')[0],
  },
];

export const categoryOptions = [
  { id: 'all', label: '전체' },
  ...mockProductCategories.map((category) => ({ id: category.id, label: category.label })),
];
