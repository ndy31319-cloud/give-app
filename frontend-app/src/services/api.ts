import {
  categoryOptions,
  findLocationByDongName,
  mapMemberToUser,
  mockCertificationCodes,
  mockCommunityComments,
  mockCommunityLikes,
  mockCommunityPosts,
  mockDonateImages,
  mockDonateLikes,
  mockDonatePosts,
  mockMembers,
  mockNotificationRecords,
  mockNotices,
  mockPickupRequests,
  mockProducts,
  mockReports,
  mockRequestImages,
  mockRequestLikes,
  mockRequestPosts,
  mockReviews,
  mockRoles,
  mockSearchHistory,
} from "@/src/data/mockData";
import {
  CertificationCodeRecord,
  ChatMessage,
  ChatMessageRecord,
  ChatRoom,
  ChatRoomRecord,
  CommunityCommentRecord,
  CommunityLikeRecord,
  CommunityPostRecord,
  CreatePostInput,
  DonateImageRecord,
  DonateLikeRecord,
  DonatePostRecord,
  DynamicQrPurpose,
  DynamicQrSession,
  ImageAnalysisResult,
  MemberRecord,
  NeighborhoodLocation,
  NotificationItem,
  NotificationRecord,
  PickupRequestRecord,
  Policy,
  Post,
  ProductRecord,
  ReportRecord,
  RequestImageRecord,
  RequestLikeRecord,
  RequestPostRecord,
  ReviewRecord,
  RoleCode,
  SearchHistoryRecord,
  ShareHistoryItem,
  SignupDraft,
  UploadableImage,
  User,
} from "@/src/types/app";
import {
  backendConfig,
  buildAuthHeaders,
  mapBackendChatMessage,
  mapBackendChatRoom,
  mapBackendDynamicQrSession,
  mapBackendPolicy,
  mapBackendPost,
  mapBackendUser,
  mergeCreatedPost,
  pingBackend,
  requestEnvelope,
  toBackendFilePart,
  toLocationString,
} from "@/src/services/backendClient";
import { formatDate } from "@/src/utils/time";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type ApiResult<T> = Promise<{ data: T; error: string | null }>;

export interface MypageSummary {
  user: User;
  counts: {
    shares: number;
    requests: number;
  };
  activeQr: DynamicQrSession | null;
}

export interface MypageStats {
  period: "3months" | "6months" | "year";
  myAverage: number;
  allAverage: number;
  difference: number;
  monthlyStats: {
    label: string;
    mine: number;
    avg: number;
  }[];
}

function withJsonHeaders(headers?: Record<string, string>) {
  return {
    Accept: "application/json",
    ...headers,
  };
}

function buildFilePart(image: UploadableImage) {
  return {
    uri: image.uri,
    name: image.name || `image-${Date.now()}.jpg`,
    type: image.type || "image/jpeg",
  } as any;
}

function normalizeAiCategory(category?: string | null) {
  const value = String(category || "").trim();
  const lowerValue = value.toLowerCase();

  if (!value) return undefined;
  if (categoryOptions.some((option) => option.id === value)) return value;
  if (
    value.includes("생활") ||
    value.includes("주방") ||
    lowerValue.includes("household")
  )
    return "household";
  if (
    value.includes("전자") ||
    value.includes("디지털") ||
    lowerValue.includes("electronic")
  )
    return "electronics";
  if (
    value.includes("가구") ||
    value.includes("책장") ||
    lowerValue.includes("furniture")
  )
    return "furniture";
  if (
    value.includes("도서") ||
    value.includes("책") ||
    lowerValue.includes("book")
  )
    return "books";
  if (
    value.includes("의류") ||
    value.includes("옷") ||
    lowerValue.includes("cloth")
  )
    return "clothing";
  if (
    value.includes("유아") ||
    value.includes("아기") ||
    lowerValue.includes("baby")
  )
    return "baby";
  if (lowerValue.includes("kitchen")) return "kitchen";

  return value;
}

function inferFromFilename(image: UploadableImage): ImageAnalysisResult {
  const name = `${image.name} ${image.uri}`.toLowerCase();

  const harmfulPatterns = [
    "gun",
    "knife",
    "drug",
    "medicine",
    "pill",
    "vape",
    "cigarette",
    "alcohol",
    "총",
    "칼",
    "약",
    "담배",
    "술",
  ];

  if (harmfulPatterns.some((pattern) => name.includes(pattern))) {
    return {
      isHarmful: true,
      reason: "의약품, 무기류, 주류·담배류는 나눔이 제한됩니다.",
      confidence: 0.94,
      detectedItem: "유해 가능 물품",
    };
  }

  const categories = [
    {
      keywords: ["coat", "jacket", "outer", "shirt", "clothes", "옷", "외투"],
      item: "의류",
      category: "clothing",
      title: "상태 좋은 의류 나눔합니다",
      description:
        "깨끗하게 보관한 의류입니다. 사이즈와 상태는 채팅으로 자세히 안내드릴게요.",
    },
    {
      keywords: ["book", "books", "novel", "책", "도서"],
      item: "도서",
      category: "books",
      title: "읽기 좋은 도서 나눔합니다",
      description:
        "정리 중인 도서입니다. 필요한 분께 편하게 나눔드리고 싶어요.",
    },
    {
      keywords: ["laptop", "tablet", "phone", "monitor", "전자", "노트북"],
      item: "전자제품",
      category: "electronics",
      title: "사용 가능한 전자제품 나눔합니다",
      description:
        "작동 상태를 확인한 전자제품입니다. 사용감은 있지만 실사용 가능합니다.",
    },
  ];

  const matched = categories.find((candidate) =>
    candidate.keywords.some((keyword) => name.includes(keyword)),
  );

  if (matched) {
    return {
      isHarmful: false,
      confidence: 0.86,
      detectedItem: matched.item,
      recommendedCategory: matched.category,
      suggestedTitle: matched.title,
      suggestedDescription: matched.description,
    };
  }

  return {
    isHarmful: false,
    confidence: 0.72,
    detectedItem: "생활용품",
    recommendedCategory: "household",
    suggestedTitle: "상태 좋은 생활용품 나눔합니다",
    suggestedDescription:
      "사진 속 물품을 나눔하려고 합니다. 상태와 사용감은 채팅으로 자세히 설명드릴게요.",
  };
}

async function safeFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T | null> {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${input}`, init);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const dynamicQrSessionStore: DynamicQrSession[] = [];
const defaultDynamicQrTtlSeconds = 30;

function isoNow() {
  return new Date().toISOString();
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function buildDynamicQrDisplayCode(
  memberId: string,
  purpose: DynamicQrPurpose,
  issuedAtMs: number,
) {
  const seed = hashString(`${memberId}:${purpose}:${issuedAtMs}`).slice(0, 12);
  return `GIVE-${seed.slice(0, 4)}-${seed.slice(4, 8)}-${seed.slice(8, 12)}`;
}

function buildDynamicQrToken(
  memberId: string,
  purpose: DynamicQrPurpose,
  issuedAtMs: number,
  expiresAtMs: number,
) {
  const seed = hashString(
    `${memberId}:${purpose}:${issuedAtMs}:${expiresAtMs}:${Math.random()}`,
  );
  return `give|${purpose}|${memberId}|${issuedAtMs}|${expiresAtMs}|${seed}`;
}

function cloneDynamicQrSession(session: DynamicQrSession) {
  return { ...session };
}

function expireStaleDynamicQrSessions() {
  const nowMs = Date.now();

  dynamicQrSessionStore.forEach((session, index) => {
    if (
      session.status === "active" &&
      new Date(session.expiresAt).getTime() <= nowMs
    ) {
      dynamicQrSessionStore[index] = {
        ...session,
        status: "expired",
      };
    }
  });
}

function createMemberToken(member: MemberRecord) {
  return `mock_token_${member.memberId}_${Date.now()}`;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function getIdentifierMismatchMessage(identifier: string) {
  if (identifier.includes("@")) {
    return "등록되지 않은 이메일입니다.";
  }

  if (normalizePhone(identifier).length >= 9) {
    return "등록되지 않은 전화번호입니다.";
  }

  return "등록되지 않은 이메일 또는 전화번호입니다.";
}

function findMockMemberByIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const normalizedPhone = normalizePhone(identifier);

  return mockMembers.find((member) => {
    const memberEmail = member.email.toLowerCase();
    const memberPhone = normalizePhone(member.phone);

    return (
      memberEmail === normalizedIdentifier || memberPhone === normalizedPhone
    );
  });
}

function resolveRoleName(roleId: string): RoleCode {
  return mockRoles.find((role) => role.roleId === roleId)?.roleName ?? "USER";
}

function toBackendPostType(type: CreatePostInput["type"]) {
  return type === "share" ? "donate" : "request";
}

const backendProductIdByCategory: Record<string, string> = {
  clothing: "1",
  electronics: "2",
  digital: "2",
  household: "51",
  kitchen: "51",
  baby: "51",
  furniture: "91",
  books: "106",
};

function toProductId(category: string) {
  return (
    backendProductIdByCategory[category] ?? category.match(/\d+/)?.[0] ?? "51"
  );
}

function buildUserFromDraft(
  draft: SignupDraft,
  location: NeighborhoodLocation,
): User {
  const roleCode: RoleCode = draft.isVulnerable ? "BENEFICIARY" : "USER";
  const member: MemberRecord = {
    memberId: `member_generated_${Date.now()}`,
    roleId: draft.isVulnerable ? "role_beneficiary" : "role_user",
    roleName: roleCode,
    memberPw: draft.password ?? "Give1234",
    name: draft.name ?? "사용자",
    nickname: draft.nickname ?? draft.name ?? "사용자",
    email: draft.email ?? "",
    phone: draft.phone ?? "",
    dongName: location.dongName,
    birthdate: draft.birthdate,
    createdAt: new Date().toISOString(),
  };

  return mapMemberToUser(member, {
    certificateImage: draft.certificateImage ?? null,
    vulnerableTypes: draft.vulnerableTypes ?? [],
    isVulnerable: draft.isVulnerable ?? false,
    neighborhoods: [location],
  });
}

function createPostViewFromPayload(payload: CreatePostInput, user: User): Post {
  return {
    id: `${payload.type}_${Date.now()}`,
    recordId: `${payload.type}_${Date.now()}`,
    type: payload.type,
    title: payload.title,
    description: payload.description,
    createdFrom: payload.type === 'need' ? 'app' : undefined,
    category: payload.category,
    productId: payload.productId,
    itemName: payload.itemName,
    itemCondition: payload.itemCondition,
    location: payload.location,
    status: "open",
    urgency:
      payload.type === "need" ? (payload.urgency ?? "normal") : undefined,
    images: payload.images.map((image) => image.uri),
    imageFiles: payload.images,
    author: {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      temperature: 36.8,
      profileImage: user.profileImage,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    favoriteCount: 0,
    views: 0,
    aiDetectedItem: payload.aiAnalysis?.detectedItem,
  };
}

export const memberAPI = {
  async login(payload: {
    identifier: string;
    password: string;
  }): ApiResult<{ user: User; token: string }> {
    const response = await safeFetch<{ data?: { user: User; token: string } }>(
      "/api/auth/login",
      {
        method: "POST",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          identifier: payload.identifier,
          password: payload.password,
        }),
      },
    );

    if (response?.data) {
      return { data: response.data, error: null };
    }

    await sleep(400);
    const member = findMockMemberByIdentifier(payload.identifier);
    if (!member) {
      return {
        data: null as never,
        error: getIdentifierMismatchMessage(payload.identifier),
      };
    }

    if (member.memberPw !== payload.password) {
      return { data: null as never, error: "비밀번호가 올바르지 않습니다." };
    }

    return {
      data: {
        user: mapMemberToUser(member),
        token: createMemberToken(member),
      },
      error: null,
    };
  },

  async signup(
    draft: SignupDraft,
    location: NeighborhoodLocation,
  ): ApiResult<{ user: User; token: string }> {
    const requestPayload = {
      role: draft.isVulnerable ? "BENEFICIARY" : "USER",
      role_name: draft.isVulnerable ? "BENEFICIARY" : "USER",
      role_id: draft.isVulnerable ? "role_beneficiary" : "role_user",
      roleId: draft.isVulnerable ? "role_beneficiary" : "role_user",
      password: draft.password ?? "Give1234",
      member_pw: draft.password ?? "Give1234",
      memberPw: draft.password ?? "Give1234",
      name: draft.name ?? "사용자",
      nickname: draft.nickname ?? draft.name ?? "사용자",
      email: draft.email ?? "",
      phone: draft.phone ?? "",
      certificate_number: "",
      qr_code: "",
      dong_name: location.dongName,
      dongName: location.dongName,
      latitude: location.latitude,
      longitude: location.longitude,
      birth_date: draft.birthdate ?? "",
      birthdate: draft.birthdate ?? "",
    };

    const response = await safeFetch<{ data?: { user: User; token: string } }>(
      "/api/members/signup",
      {
        method: "POST",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(requestPayload),
      },
    );

    if (response?.data) {
      return { data: response.data, error: null };
    }

    await sleep(700);
    const user = buildUserFromDraft(draft, location);
    return {
      data: {
        user,
        token: createMemberToken({
          memberId: user.id,
          roleId: user.roleId,
          roleName: user.roleCode,
          memberPw: draft.password ?? "Give1234",
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          phone: user.phone ?? "",
          dongName: user.dongName,
          birthdate: user.birthdate,
          createdAt: user.createdAt ?? new Date().toISOString(),
        }),
      },
      error: null,
    };
  },

  async getMe(memberId: string): ApiResult<User> {
    const response = await safeFetch<{ data?: User }>(`/members/${memberId}`);
    if (response?.data) {
      return { data: response.data, error: null };
    }

    const member =
      mockMembers.find((item) => item.memberId === memberId) ?? mockMembers[0];
    return { data: mapMemberToUser(member), error: null };
  },

  async updateMe(
    memberId: string,
    payload: Pick<User, "name" | "nickname" | "phone" | "dongName"> &
      Partial<Pick<User, "email" | "bio" | "profileImage">>,
    authToken?: string,
  ): ApiResult<User> {
    const backendResult = await requestEnvelope<any>(
      backendConfig.endpoints.memberMe,
      {
        method: "PATCH",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      },
    );

    if (backendResult.error) {
      return { data: null as never, error: backendResult.error };
    }

    if (backendResult.data) {
      return { data: mapBackendUser(backendResult.data), error: null };
    }

    const member =
      mockMembers.find((item) => item.memberId === memberId) ?? mockMembers[0];
    return {
      data: mapMemberToUser({
        ...member,
        name: payload.name,
        nickname: payload.nickname,
        phone: payload.phone ?? member.phone,
        dongName: payload.dongName,
      }),
      error: null,
    };
  },

  async updateLocation(
    memberId: string,
    location: NeighborhoodLocation,
    authToken?: string,
  ): ApiResult<User> {
    const backendResult = await requestEnvelope<any>(
      backendConfig.endpoints.memberLocation,
      {
        method: "PATCH",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          dongName: location.dongName,
          dong_name: location.dongName,
          location: toLocationString(location),
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      },
    );

    if (backendResult.error) {
      return { data: null as never, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: {
          ...mapMemberToUser(
            mockMembers.find((item) => item.memberId === memberId) ??
              mockMembers[0],
          ),
          dongName:
            backendResult.data.dongName ??
            backendResult.data.dong_name ??
            location.dongName,
          location,
        },
        error: null,
      };
    }

    const member =
      mockMembers.find((item) => item.memberId === memberId) ?? mockMembers[0];
    return {
      data: {
        ...mapMemberToUser(member),
        dongName: location.dongName,
        location,
      },
      error: null,
    };
  },

  async changePassword(
    memberId: string,
    nextPassword: string,
  ): ApiResult<{ success: boolean }> {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/members/${memberId}/password`,
      {
        method: "PATCH",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberPw: nextPassword }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: { success: true }, error: null };
  },

  async deleteMe(memberId: string): ApiResult<{ success: boolean }> {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/members/${memberId}`,
      {
        method: "DELETE",
      },
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: { success: true }, error: null };
  },

  async getRole(memberId: string): ApiResult<{ roleName: RoleCode }> {
    const response = await safeFetch<{ data?: { roleName: RoleCode } }>(
      `/members/${memberId}/role`,
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }

    const member =
      mockMembers.find((item) => item.memberId === memberId) ?? mockMembers[0];
    return { data: { roleName: resolveRoleName(member.roleId) }, error: null };
  },

  async promoteToBeneficiary(
    memberId: string,
  ): ApiResult<{ success: boolean; roleName: RoleCode }> {
    const response = await safeFetch<{
      data?: { success: boolean; roleName: RoleCode };
    }>(`/members/${memberId}/role`, {
      method: "PATCH",
      headers: withJsonHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ roleName: "BENEFICIARY" }),
    });
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: { success: true, roleName: "BENEFICIARY" }, error: null };
  },
};

export const certificationAPI = {
  async listAll(): ApiResult<CertificationCodeRecord[]> {
    const response = await safeFetch<{ data?: CertificationCodeRecord[] }>(
      "/certification-codes",
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: mockCertificationCodes, error: null };
  },

  async getAvailable(): ApiResult<CertificationCodeRecord[]> {
    return {
      data: mockCertificationCodes.filter(
        (code) => !code.isUsed && code.status === "unused",
      ),
      error: null,
    };
  },

  async useCode(
    code: string,
    memberId: string,
  ): ApiResult<{ success: boolean }> {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/certification-codes/use`,
      {
        method: "PATCH",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ code, memberId }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }

    const matched = mockCertificationCodes.find(
      (item) => item.code === code && !item.isUsed,
    );
    if (!matched) {
      return {
        data: { success: false },
        error: "사용 가능한 인증코드를 찾을 수 없습니다.",
      };
    }
    return { data: { success: true }, error: null };
  },

  async listByMember(memberId: string): ApiResult<CertificationCodeRecord[]> {
    return {
      data: mockCertificationCodes.filter((code) => code.memberId === memberId),
      error: null,
    };
  },
};

export const dynamicQrAPI = {
  async issue(
    memberId: string,
    purpose: DynamicQrPurpose = "donation_access",
    ttlSeconds = defaultDynamicQrTtlSeconds,
    authToken?: string,
  ): ApiResult<DynamicQrSession | null> {
    const backendResult = await requestEnvelope<any>(
      backendConfig.endpoints.dynamicQrIssue,
      {
        method: "POST",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ memberId, purpose, ttlSeconds }),
      },
    );

    if (backendResult.error) {
      return { data: null, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: mapBackendDynamicQrSession(backendResult.data, {
          memberId,
          purpose,
          ttlSeconds,
        }),
        error: null,
      };
    }

    expireStaleDynamicQrSessions();

    dynamicQrSessionStore.forEach((session, index) => {
      if (
        session.memberId === memberId &&
        session.purpose === purpose &&
        session.status === "active"
      ) {
        dynamicQrSessionStore[index] = {
          ...session,
          status: "expired",
        };
      }
    });

    const issuedAtMs = Date.now();
    const expiresAtMs = issuedAtMs + ttlSeconds * 1000;
    const createdSession: DynamicQrSession = {
      id: `dynamic_qr_${issuedAtMs}`,
      memberId,
      purpose,
      token: buildDynamicQrToken(memberId, purpose, issuedAtMs, expiresAtMs),
      displayCode: buildDynamicQrDisplayCode(memberId, purpose, issuedAtMs),
      issuedAt: new Date(issuedAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      status: "active",
      ttlSeconds,
      usedAt: null,
    };

    dynamicQrSessionStore.unshift(createdSession);
    return { data: cloneDynamicQrSession(createdSession), error: null };
  },

  async validate(
    token: string,
    authToken?: string,
  ): ApiResult<DynamicQrSession | null> {
    const backendResult = await requestEnvelope<any>(
      backendConfig.endpoints.dynamicQrValidate,
      {
        method: "POST",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ token: token.trim() }),
      },
    );

    if (backendResult.error) {
      return { data: null, error: backendResult.error };
    }

    if (backendResult.data) {
      const session = mapBackendDynamicQrSession(backendResult.data, {
        memberId: String(backendResult.data.memberId ?? ""),
        purpose: backendResult.data.purpose ?? "donation_access",
        ttlSeconds: Number(
          backendResult.data.ttlSeconds ?? defaultDynamicQrTtlSeconds,
        ),
      });

      if (session.status === "used") {
        return { data: session, error: "이미 사용된 QR입니다." };
      }
      if (session.status === "expired") {
        return {
          data: session,
          error: "QR이 만료되었습니다. 다시 발급해주세요.",
        };
      }

      return { data: session, error: null };
    }

    expireStaleDynamicQrSessions();

    const session = dynamicQrSessionStore.find(
      (item) => item.token === token.trim(),
    );
    if (!session) {
      return { data: null, error: "유효한 QR 세션을 찾을 수 없습니다." };
    }

    if (session.status === "used") {
      return {
        data: cloneDynamicQrSession(session),
        error: "이미 사용된 QR입니다.",
      };
    }

    if (session.status === "expired") {
      return {
        data: cloneDynamicQrSession(session),
        error: "QR이 만료되었습니다. 다시 발급해주세요.",
      };
    }

    return { data: cloneDynamicQrSession(session), error: null };
  },

  async consume(
    token: string,
    authToken?: string,
  ): ApiResult<DynamicQrSession | null> {
    const backendResult = await requestEnvelope<any>(
      backendConfig.endpoints.dynamicQrConsume,
      {
        method: "POST",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ token: token.trim() }),
      },
    );

    if (backendResult.error) {
      return { data: null, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: mapBackendDynamicQrSession(backendResult.data, {
          memberId: String(backendResult.data.memberId ?? ""),
          purpose: backendResult.data.purpose ?? "donation_access",
          ttlSeconds: Number(
            backendResult.data.ttlSeconds ?? defaultDynamicQrTtlSeconds,
          ),
        }),
        error: null,
      };
    }

    expireStaleDynamicQrSessions();

    const sessionIndex = dynamicQrSessionStore.findIndex(
      (item) => item.token === token.trim(),
    );
    if (sessionIndex < 0) {
      return { data: null, error: "사용할 QR 세션을 찾을 수 없습니다." };
    }

    const session = dynamicQrSessionStore[sessionIndex];
    if (session.status === "used") {
      return {
        data: cloneDynamicQrSession(session),
        error: "이미 사용 완료된 QR입니다.",
      };
    }

    if (session.status === "expired") {
      return {
        data: cloneDynamicQrSession(session),
        error: "만료된 QR은 사용할 수 없습니다.",
      };
    }

    const consumedSession: DynamicQrSession = {
      ...session,
      status: "used",
      usedAt: isoNow(),
    };
    dynamicQrSessionStore[sessionIndex] = consumedSession;

    return { data: cloneDynamicQrSession(consumedSession), error: null };
  },

  async listByMember(memberId: string): ApiResult<DynamicQrSession[]> {
    expireStaleDynamicQrSessions();
    return {
      data: dynamicQrSessionStore
        .filter((session) => session.memberId === memberId)
        .map((session) => cloneDynamicQrSession(session)),
      error: null,
    };
  },
};

export const catalogAPI = {
  async listCategories(): ApiResult<typeof categoryOptions> {
    return { data: categoryOptions, error: null };
  },

  async listProducts(): ApiResult<ProductRecord[]> {
    const response = await safeFetch<{ data?: ProductRecord[] }>("/products");
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: mockProducts, error: null };
  },
};

export const donateAPI = {
  async list(): ApiResult<DonatePostRecord[]> {
    const response = await safeFetch<{ data?: DonatePostRecord[] }>("/donates");
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: mockDonatePosts, error: null };
  },

  async getById(donateId: string): ApiResult<DonatePostRecord | null> {
    const response = await safeFetch<{ data?: DonatePostRecord | null }>(
      `/donates/${donateId}`,
    );
    if (response?.data !== undefined) {
      return { data: response.data, error: null };
    }
    return {
      data: mockDonatePosts.find((item) => item.donateId === donateId) ?? null,
      error: null,
    };
  },

  async getMine(memberId: string): ApiResult<DonatePostRecord[]> {
    return {
      data: mockDonatePosts.filter((item) => item.memberId === memberId),
      error: null,
    };
  },

  async create(payload: {
    memberId: string;
    title: string;
    content: string;
    images?: UploadableImage[];
  }): ApiResult<DonatePostRecord> {
    const formData = new FormData();
    formData.append("memberId", payload.memberId);
    formData.append("title", payload.title);
    formData.append("content", payload.content);
    payload.images?.forEach((image, index) => {
      formData.append(`images[${index}]`, buildFilePart(image));
    });

    const response = await safeFetch<{ data?: DonatePostRecord }>("/donates", {
      method: "POST",
      body: formData,
    });
    if (response?.data) {
      return { data: response.data, error: null };
    }

    return {
      data: {
        donateId: `donate_${Date.now()}`,
        memberId: payload.memberId,
        title: payload.title,
        content: payload.content,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      error: null,
    };
  },

  async update(
    donateId: string,
    memberId: string,
    payload: { title: string; content: string },
  ) {
    const response = await safeFetch<{ data?: DonatePostRecord }>(
      `/donates/${donateId}`,
      {
        method: "PUT",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...payload, memberId }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null as string | null };
    }
    const current = mockDonatePosts.find((item) => item.donateId === donateId);
    if (!current) {
      return {
        data: null as DonatePostRecord | null,
        error: "기부글을 찾을 수 없습니다.",
      };
    }
    return {
      data: {
        ...current,
        title: payload.title,
        content: payload.content,
        updatedAt: new Date().toISOString(),
      },
      error: null,
    };
  },

  async updateStatus(
    donateId: string,
    memberId: string,
    status: DonatePostRecord["status"],
  ) {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/donates/${donateId}/status`,
      {
        method: "PATCH",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberId, status }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null as string | null };
    }
    return { data: { success: true }, error: null };
  },

  async remove(donateId: string, memberId: string) {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/donates/${donateId}`,
      {
        method: "DELETE",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberId }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null as string | null };
    }
    return { data: { success: true }, error: null };
  },

  async listImages(donateId: string): ApiResult<DonateImageRecord[]> {
    return {
      data: mockDonateImages.filter((item) => item.donateId === donateId),
      error: null,
    };
  },

  async listLikes(donateId: string): ApiResult<DonateLikeRecord[]> {
    return {
      data: mockDonateLikes.filter((item) => item.donateId === donateId),
      error: null,
    };
  },
};

export const requestAPI = {
  async list(): ApiResult<RequestPostRecord[]> {
    const response = await safeFetch<{ data?: RequestPostRecord[] }>(
      "/requests",
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: mockRequestPosts, error: null };
  },

  async getById(requestId: string): ApiResult<RequestPostRecord | null> {
    const response = await safeFetch<{ data?: RequestPostRecord | null }>(
      `/requests/${requestId}`,
    );
    if (response?.data !== undefined) {
      return { data: response.data, error: null };
    }
    return {
      data:
        mockRequestPosts.find((item) => item.requestId === requestId) ?? null,
      error: null,
    };
  },

  async getMine(memberId: string): ApiResult<RequestPostRecord[]> {
    return {
      data: mockRequestPosts.filter((item) => item.memberId === memberId),
      error: null,
    };
  },

  async create(payload: {
    memberId: string;
    title: string;
    content: string;
    createdFrom?: 'app' | 'web';
    urgency: RequestPostRecord["urgency"];
    images?: UploadableImage[];
  }): ApiResult<RequestPostRecord> {
    const formData = new FormData();
    formData.append("memberId", payload.memberId);
    formData.append("title", payload.title);
    formData.append("content", payload.content);
    formData.append("createdFrom", payload.createdFrom ?? 'app');
    formData.append("urgency", payload.urgency);
    payload.images?.forEach((image, index) => {
      formData.append(`images[${index}]`, buildFilePart(image));
    });

    const response = await safeFetch<{ data?: RequestPostRecord }>(
      "/requests",
      {
        method: "POST",
        body: formData,
      },
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }

    return {
      data: {
        requestId: `request_${Date.now()}`,
        memberId: payload.memberId,
        title: payload.title,
        content: payload.content,
        createdFrom: payload.createdFrom ?? 'app',
        urgency: payload.urgency,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      error: null,
    };
  },

  async update(
    requestId: string,
    memberId: string,
    payload: {
      title: string;
      content: string;
      urgency: RequestPostRecord["urgency"];
    },
  ) {
    const response = await safeFetch<{ data?: RequestPostRecord }>(
      `/requests/${requestId}`,
      {
        method: "PUT",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...payload, memberId }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null as string | null };
    }
    const current = mockRequestPosts.find(
      (item) => item.requestId === requestId,
    );
    if (!current) {
      return {
        data: null as RequestPostRecord | null,
        error: "요청글을 찾을 수 없습니다.",
      };
    }
    return {
      data: {
        ...current,
        title: payload.title,
        content: payload.content,
        urgency: payload.urgency,
        updatedAt: new Date().toISOString(),
      },
      error: null,
    };
  },

  async updateStatus(
    requestId: string,
    memberId: string,
    status: RequestPostRecord["status"],
  ) {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/requests/${requestId}/status`,
      {
        method: "PATCH",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberId, status }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null as string | null };
    }
    return { data: { success: true }, error: null };
  },

  async remove(requestId: string, memberId: string) {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/requests/${requestId}`,
      {
        method: "DELETE",
        headers: withJsonHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberId }),
      },
    );
    if (response?.data) {
      return { data: response.data, error: null as string | null };
    }
    return { data: { success: true }, error: null };
  },

  async listImages(requestId: string): ApiResult<RequestImageRecord[]> {
    return {
      data: mockRequestImages.filter((item) => item.requestId === requestId),
      error: null,
    };
  },

  async listLikes(requestId: string): ApiResult<RequestLikeRecord[]> {
    return {
      data: mockRequestLikes.filter((item) => item.requestId === requestId),
      error: null,
    };
  },
};

export const communityAPI = {
  async listPosts(): ApiResult<CommunityPostRecord[]> {
    return { data: mockCommunityPosts, error: null };
  },
  async listComments(postId: string): ApiResult<CommunityCommentRecord[]> {
    return {
      data: mockCommunityComments.filter((item) => item.postId === postId),
      error: null,
    };
  },
  async listLikes(postId: string): ApiResult<CommunityLikeRecord[]> {
    return {
      data: mockCommunityLikes.filter((item) => item.postId === postId),
      error: null,
    };
  },
};

export const chatAPI = {
  async createRoom(payload: {
    participantIds: string[];
    relatedPostId: string;
    relatedPostType: Post["type"];
    currentUserId: string;
    relatedPost?: Post;
    authToken?: string;
  }): ApiResult<ChatRoom> {
    const response = await requestEnvelope<any>(
      `${backendConfig.endpoints.chats}/rooms`,
      {
        method: "POST",
        headers: buildAuthHeaders(payload.authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          participantIds: payload.participantIds,
          relatedPostId: payload.relatedPostId,
          relatedPostType: payload.relatedPostType,
        }),
      },
    );

    if (response.error) {
      return { data: null as never, error: response.error };
    }

    if (response.data) {
      return {
        data: mapBackendChatRoom(response.data, payload.currentUserId),
        error: null,
      };
    }

    return {
      data: null as never,
      error: "채팅방을 만들 수 없습니다. 백엔드 채팅 API를 확인해주세요.",
    };
  },

  async listRooms(memberId: string, authToken?: string): ApiResult<ChatRoom[]> {
    const response = await requestEnvelope<{ chats?: any[] } | any[]>(
      `${backendConfig.endpoints.chats}/rooms`,
      {
        headers: buildAuthHeaders(authToken),
      },
    );
    if (response.error) {
      return { data: [], error: response.error };
    }
    const rooms = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.chats)
        ? response.data.chats
        : null;
    if (rooms) {
      return {
        data: rooms.map((room) => mapBackendChatRoom(room, memberId)),
        error: null,
      };
    }
    return { data: [], error: null };
  },

  async getRoom(chatRoomId: string): ApiResult<ChatRoom | null> {
    const response = await safeFetch<{ data?: ChatRoom | null }>(
      `/chat-rooms/${chatRoomId}`,
    );
    if (response?.data !== undefined) {
      return { data: response.data, error: null };
    }
    return { data: null, error: null };
  },

  async getRoomRecord(chatRoomId: string): ApiResult<ChatRoomRecord | null> {
    return { data: null, error: null };
  },

  async listMessages(
    chatRoomId: string,
    authToken?: string,
    viewerId = "",
  ): ApiResult<ChatMessage[]> {
    const response = await requestEnvelope<{ messages?: any[] } | any[]>(
      `${backendConfig.endpoints.chats}/rooms/${chatRoomId}/messages`,
      {
        headers: buildAuthHeaders(authToken),
      },
    );
    if (response.error) {
      return { data: [], error: response.error };
    }
    const messages = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.messages)
        ? response.data.messages
        : null;
    if (messages) {
      return {
        data: messages.map((message) =>
          mapBackendChatMessage(message, viewerId),
        ),
        error: null,
      };
    }
    return { data: [], error: null };
  },

  async listUnread(
    chatRoomId: string,
    memberId: string,
  ): ApiResult<ChatMessageRecord[]> {
    return { data: [], error: null };
  },

  async sendMessage(payload: {
    chatRoomId: string;
    senderId: string;
    content: string;
    messageType?: ChatMessageRecord["messageType"];
    authToken?: string;
  }): ApiResult<ChatMessage> {
    const backendResult = await requestEnvelope<any>(
      `${backendConfig.endpoints.chats}/rooms/${payload.chatRoomId}/messages`,
      {
        method: "POST",
        headers: buildAuthHeaders(payload.authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          content: payload.content,
          message_type: payload.messageType ?? "TEXT",
          text: payload.content,
          messageType: payload.messageType ?? "TEXT",
        }),
      },
    );

    if (backendResult.error) {
      return { data: null as never, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: mapBackendChatMessage(backendResult.data, payload.senderId),
        error: null,
      };
    }

    return {
      data: null as never,
      error: "메시지를 보낼 수 없습니다. 백엔드 채팅 API를 확인해주세요.",
    };
  },

  async markAsRead(
    chatRoomId: string,
    memberId: string,
    authToken?: string,
  ): ApiResult<{ success: boolean }> {
    const response = await requestEnvelope<{ success?: boolean }>(
      `${backendConfig.endpoints.chats}/rooms/${chatRoomId}/read`,
      {
        method: "PATCH",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ memberId }),
      },
    );
    if (response.error) {
      return { data: null as never, error: response.error };
    }
    if (response.data) {
      return { data: { success: response.data.success ?? true }, error: null };
    }
    return { data: { success: true }, error: null };
  },
};

export const policyAPI = {
  async listPolicies(authToken?: string): ApiResult<Policy[]> {
    const response = await requestEnvelope<{ policies?: any[] } | any[]>(
      backendConfig.endpoints.policies,
      {
        headers: buildAuthHeaders(authToken),
      },
    );
    if (response.error) {
      return { data: [], error: response.error };
    }
    const policies = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.policies)
        ? response.data.policies
        : null;
    if (policies) {
      return {
        data: policies.map((policy) => mapBackendPolicy(policy)),
        error: null,
      };
    }
    return { data: [], error: null };
  },

  async listRecommended(authToken?: string): ApiResult<Policy[]> {
    const response = await requestEnvelope<{ policies?: any[] } | any[]>(
      backendConfig.endpoints.policiesRecommended,
      {
        headers: buildAuthHeaders(authToken),
      },
    );
    if (response.error) {
      return { data: [], error: response.error };
    }
    const policies = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.policies)
        ? response.data.policies
        : null;
    if (policies) {
      return {
        data: policies.map((policy) => mapBackendPolicy(policy)),
        error: null,
      };
    }
    return { data: [], error: null };
  },

  async askChatbot(
    message: string,
    conversationHistory: { role: "user" | "bot"; message: string }[],
    authToken?: string,
  ): ApiResult<{ response: string; suggestedPolicies: Policy[] }> {
    const response = await requestEnvelope<any>(
      backendConfig.endpoints.policiesChatbot,
      {
        method: "POST",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ message, conversationHistory }),
      },
    );
    if (response.error) {
      return { data: null as never, error: response.error };
    }
    if (response.data) {
      return {
        data: {
          response: response.data.response ?? "",
          suggestedPolicies: Array.isArray(response.data.suggestedPolicies)
            ? response.data.suggestedPolicies.map((policy: any) =>
                mapBackendPolicy(policy),
              )
            : [],
        },
        error: null,
      };
    }
    return {
      data: {
        response: "정책 서버 응답이 아직 연결되지 않았습니다.",
        suggestedPolicies: [],
      },
      error: null,
    };
  },

  async listSearchHistory(memberId: string): ApiResult<SearchHistoryRecord[]> {
    return {
      data: mockSearchHistory.filter(
        (history) => history.memberId === memberId,
      ),
      error: null,
    };
  },

  async createSearchHistory(payload: {
    memberId: string;
    queryText?: string;
    recommendPolicyId?: string;
    policyId?: string;
    authToken?: string;
  }): ApiResult<SearchHistoryRecord> {
    const requestBody: Record<string, unknown> = {};

    if (payload.queryText) {
      requestBody.query_text = payload.queryText;
    }
    if (payload.recommendPolicyId) {
      requestBody.recommend_policy_id = payload.recommendPolicyId;
    }
    if (payload.policyId) {
      requestBody.policy_id = payload.policyId;
    }

    const response = await requestEnvelope<any>(backendConfig.endpoints.policiesHistory, {
      method: 'POST',
      headers: buildAuthHeaders(payload.authToken, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(requestBody),
    });

    if (response.data) {
      return {
        data: {
          searchHistoryId: String(response.data.searchHistoryId ?? response.data.search_history_id ?? `search_${Date.now()}`),
          memberId: String(response.data.memberId ?? response.data.member_id ?? payload.memberId),
          queryText: String(response.data.queryText ?? response.data.query_text ?? payload.queryText ?? ''),
          recommendPolicyId: response.data.recommendPolicyId ?? response.data.recommend_policy_id ?? payload.recommendPolicyId ?? null,
          policyId: response.data.policyId ?? response.data.policy_id ?? payload.policyId ?? null,
          createdAt: response.data.createdAt ?? response.data.created_at ?? new Date().toISOString(),
        },
        error: null,
      };
    }

    return {
      data: {
        searchHistoryId: `search_${Date.now()}`,
        memberId: payload.memberId,
        queryText: payload.queryText ?? '',
        recommendPolicyId: payload.recommendPolicyId ?? null,
        policyId: payload.policyId ?? null,
        createdAt: new Date().toISOString(),
      },
      error: response.error,
    };
  },
};

export const reportAPI = {
  async listMine(reporterId: string): ApiResult<ReportRecord[]> {
    return {
      data: mockReports.filter((report) => report.reporterId === reporterId),
      error: null,
    };
  },

  async create(
    report: Omit<ReportRecord, "reportId" | "createdAt" | "status">,
  ): ApiResult<ReportRecord> {
    return {
      data: {
        ...report,
        reportId: `report_${Date.now()}`,
        status: "received",
        createdAt: new Date().toISOString(),
      },
      error: null,
    };
  },
};

export const noticeAPI = {
  async list(): ApiResult<typeof mockNotices> {
    return { data: mockNotices, error: null };
  },

  async getById(noticeId: string) {
    return {
      data: mockNotices.find((notice) => notice.noticeId === noticeId) ?? null,
      error: null,
    };
  },
};

export const pickupRequestAPI = {
  async listMine(memberId: string): ApiResult<PickupRequestRecord[]> {
    return {
      data: mockPickupRequests.filter((item) => item.memberId === memberId),
      error: null,
    };
  },

  async create(
    payload: Pick<PickupRequestRecord, "memberId" | "donateId">,
  ): ApiResult<PickupRequestRecord> {
    return {
      data: {
        pickupRequestId: `pickup_${Date.now()}`,
        memberId: payload.memberId,
        donateId: payload.donateId,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      error: null,
    };
  },
};

export const notificationAPI = {
  async list(
    memberId: string,
    authToken?: string,
  ): ApiResult<NotificationItem[]> {
    const backendResult = await requestEnvelope<NotificationItem[]>(
      `/notifications?memberId=${memberId}`,
      {
        headers: buildAuthHeaders(authToken),
      },
    );

    if (backendResult.error) {
      return { data: [], error: backendResult.error };
    }

    if (backendResult.data) {
      return { data: backendResult.data, error: null };
    }

    const response = await safeFetch<{ data?: NotificationItem[] }>(
      `/notifications?memberId=${memberId}`,
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: [], error: null };
  },

  async listRaw(memberId: string): ApiResult<NotificationRecord[]> {
    return {
      data: mockNotificationRecords.filter(
        (item) => item.memberId === memberId,
      ),
      error: null,
    };
  },

  async markRead(notificationId: string): ApiResult<{ success: boolean }> {
    const response = await safeFetch<{ data?: { success: boolean } }>(
      `/notifications/${notificationId}/read`,
      { method: "PATCH" },
    );
    if (response?.data) {
      return { data: response.data, error: null };
    }
    return { data: { success: true }, error: null };
  },
};

function mapMypageHistory(raw: any): ShareHistoryItem {
  const rawStatus = raw?.displayStatus ?? raw?.display_status ?? raw?.status;
  const status: ShareHistoryItem["status"] =
    rawStatus === "completed" ? "completed" : "inProgress";

  return {
    id: String(
      raw?.id ?? raw?.postId ?? raw?.post_id ?? `history_${Date.now()}`,
    ),
    title: raw?.title ?? "나눔 내역",
    date:
      (raw?.createdAt ?? raw?.created_at)
        ? formatDate(raw.createdAt ?? raw.created_at)
        : "",
    status,
    image:
      raw?.image ??
      raw?.image_url ??
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400",
  };
}

function mapMypageStats(raw: any, period: MypageStats["period"]): MypageStats {
  const monthlyStats = raw?.monthlyStats ?? raw?.monthly_stats ?? [];

  return {
    period: raw?.period ?? period,
    myAverage: Number(raw?.myAverage ?? raw?.my_average ?? 0),
    allAverage: Number(raw?.allAverage ?? raw?.all_average ?? 0),
    difference: Number(raw?.difference ?? 0),
    monthlyStats: monthlyStats.map((item: any) => ({
      label: item.label ?? item.month ?? item.monthKey ?? item.month_key ?? "",
      mine: Number(item.mine ?? 0),
      avg: Number(item.avg ?? item.average ?? 0),
    })),
  };
}

export const mypageAPI = {
  async summary(authToken?: string): ApiResult<MypageSummary | null> {
    const response = await requestEnvelope<any>(
      backendConfig.endpoints.mypageSummary,
      {
        headers: buildAuthHeaders(authToken),
      },
    );

    if (response.error) {
      return { data: null, error: response.error };
    }

    if (!response.data) {
      return { data: null, error: null };
    }

    return {
      data: {
        user: mapBackendUser(response.data.user),
        counts: {
          shares: Number(response.data.counts?.shares ?? 0),
          requests: Number(response.data.counts?.requests ?? 0),
        },
        activeQr: response.data.activeQr
          ? mapBackendDynamicQrSession(response.data.activeQr, {
              memberId: String(
                response.data.user?.memberId ??
                  response.data.user?.member_id ??
                  "",
              ),
              purpose: response.data.activeQr.purpose ?? "donation_access",
              ttlSeconds: Number(
                response.data.activeQr.ttlSeconds ??
                  response.data.activeQr.ttl_seconds ??
                  30,
              ),
            })
          : null,
      },
      error: null,
    };
  },

  async histories(authToken?: string): ApiResult<ShareHistoryItem[]> {
    const response = await requestEnvelope<{ histories?: any[] }>(
      backendConfig.endpoints.mypageHistories,
      {
        headers: buildAuthHeaders(authToken),
      },
    );

    if (response.error) {
      return { data: [], error: response.error };
    }

    if (response.data?.histories) {
      return {
        data: response.data.histories.map(mapMypageHistory),
        error: null,
      };
    }

    return { data: [], error: null };
  },

  async stats(
    period: MypageStats["period"],
    authToken?: string,
  ): ApiResult<MypageStats> {
    const response = await requestEnvelope<any>(
      `${backendConfig.endpoints.mypageStats}?period=${period}`,
      {
        headers: buildAuthHeaders(authToken),
      },
    );

    if (response.error) {
      return { data: null as never, error: response.error };
    }

    if (response.data) {
      return { data: mapMypageStats(response.data, period), error: null };
    }

    return {
      data: {
        period,
        myAverage: 0,
        allAverage: 0,
        difference: 0,
        monthlyStats: [],
      },
      error: null,
    };
  },

  async contact(
    payload: { subject: string; email: string; message: string },
    authToken?: string,
  ): ApiResult<{ success: boolean }> {
    const response = await requestEnvelope<any>(
      backendConfig.endpoints.mypageContact,
      {
        method: "POST",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      },
    );

    if (response.error) {
      return { data: { success: false }, error: response.error };
    }

    return { data: { success: true }, error: null };
  },
};

export const reviewAPI = {
  async listByDonate(donateId: string): ApiResult<ReviewRecord[]> {
    return {
      data: mockReviews.filter((review) => review.donateId === donateId),
      error: null,
    };
  },

  async create(
    payload: Omit<ReviewRecord, "reviewId" | "createdAt"> & {
      roomId?: string;
      authToken?: string;
    },
  ): ApiResult<ReviewRecord> {
    if (payload.roomId) {
      const response = await requestEnvelope<any>(
        `${backendConfig.endpoints.chats}/rooms/${payload.roomId}/review`,
        {
          method: "POST",
          headers: buildAuthHeaders(payload.authToken, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            rating: payload.rating,
            content: payload.content,
          }),
        },
      );

      if (response.error) {
        return { data: null as never, error: response.error };
      }

      if (response.data) {
        return {
          data: {
            reviewId: String(
              response.data.reviewId ??
                response.data.review_id ??
                `review_${Date.now()}`,
            ),
            donateId: String(
              response.data.donateId ??
                response.data.donate_id ??
                payload.donateId,
            ),
            writerId: String(
              response.data.writerId ??
                response.data.writer_id ??
                payload.writerId,
            ),
            targetMemberId: String(
              response.data.targetMemberId ??
                response.data.target_member_id ??
                payload.targetMemberId,
            ),
            rating: Number(response.data.rating ?? payload.rating),
            content: response.data.content ?? payload.content,
            createdAt:
              response.data.createdAt ??
              response.data.created_at ??
              new Date().toISOString(),
          },
          error: null,
        };
      }
    }

    return {
      data: {
        ...payload,
        reviewId: `review_${Date.now()}`,
        createdAt: new Date().toISOString(),
      },
      error: null,
    };
  },
};

export const authAPI = {
  async login(payload: { identifier: string; password: string }) {
    const identifier = payload.identifier.trim();
    const backendPayload = {
      identifier,
      member_pw: payload.password,
    };

    const backendResult = await requestEnvelope<{ user: any; token: string }>(
      backendConfig.endpoints.authLogin,
      {
        method: "POST",
        headers: buildAuthHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(backendPayload),
      },
    );

    if (backendResult.error) {
      return { data: null as never, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: {
          user: mapBackendUser(backendResult.data.user),
          token: backendResult.data.token,
        },
        error: null,
      };
    }

    return memberAPI.login({ identifier, password: payload.password });
  },

  async signup(draft: SignupDraft, location: NeighborhoodLocation) {
    const backendPayload = {
      name: draft.name ?? "사용자",
      nickname: draft.nickname ?? draft.name ?? "사용자",
      email: draft.email ?? "",
      password: draft.password ?? "Give1234",
      member_pw: draft.password ?? "Give1234",
      phone: draft.phone ?? "",
      role: draft.isVulnerable ? "BENEFICIARY" : "USER",
      role_name: draft.isVulnerable ? "BENEFICIARY" : "USER",
      role_id: draft.isVulnerable ? "role_beneficiary" : "role_user",
      certificate_number: "",
      qr_code: "",
      birth_date: draft.birthdate ?? "",
      birthdate: draft.birthdate ?? "",
      isVulnerable: draft.isVulnerable ?? false,
      vulnerableTypes: draft.vulnerableTypes ?? [],
      location: toLocationString(location),
      dong_name: location.dongName,
      dongName: location.dongName,
      latitude: location.latitude,
      longitude: location.longitude,
    };

    const backendResult = await requestEnvelope<{ user: any; token: string }>(
      backendConfig.endpoints.authSignup,
      {
        method: "POST",
        headers: buildAuthHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(backendPayload),
      },
    );

    if (backendResult.error) {
      return { data: null as never, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: {
          user: mapBackendUser(backendResult.data.user),
          token: backendResult.data.token,
        },
        error: null,
      };
    }

    return memberAPI.signup(draft, location);
  },
};

export const postAPI = {
  async checkBackendReady() {
    return pingBackend();
  },

  async createPost(
    payload: CreatePostInput,
    context?: { authToken?: string | null; user?: User | null },
  ) {
    const user = context?.user ?? mapMemberToUser(mockMembers[0]);
    const authToken = context?.authToken ?? undefined;

    const formData = new FormData();
    const backendPostType = toBackendPostType(payload.type);
    const productId = toProductId(payload.category);

    formData.append("post_type", backendPostType);
    formData.append("type", payload.type);
    formData.append("frontend_type", payload.type);
    formData.append("title", payload.title);
    formData.append("content", payload.description);
    formData.append("description", payload.description);
    formData.append("category_id", productId);
    formData.append("product_id", productId);
    formData.append("category", payload.category);
    formData.append("item_name", payload.itemName);
    formData.append("item_condition", payload.itemCondition);
    formData.append("status", "open");
    formData.append("dong_name", payload.location.dongName);
    formData.append("latitude", String(payload.location.latitude));
    formData.append("longitude", String(payload.location.longitude));
    formData.append("location", toLocationString(payload.location));
    if (payload.urgency) {
      formData.append("urgency", payload.urgency);
    }
    if (payload.type === 'need') {
      formData.append('createdFrom', 'app');
    }
    payload.images.forEach((image) => {
      formData.append("images", toBackendFilePart(image));
    });

    const backendResult = await requestEnvelope<any>(
      backendConfig.endpoints.posts,
      {
        method: "POST",
        headers: buildAuthHeaders(authToken),
        body: formData,
      },
    );

    if (backendResult.error) {
      return { data: null as Post | null, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: mergeCreatedPost(payload, user, backendResult.data),
        error: null as string | null,
      };
    }

    if (payload.type === "share") {
      const result = await donateAPI.create({
        memberId: user.id,
        title: payload.title,
        content: payload.description,
        images: payload.images,
      });

      if (result.error) {
        return { data: null as Post | null, error: result.error };
      }
    } else {
      const result = await requestAPI.create({
        memberId: user.id,
        title: payload.title,
        content: payload.description,
        createdFrom: 'app',
        urgency: payload.urgency ?? "normal",
        images: payload.images,
      });

      if (result.error) {
        return { data: null as Post | null, error: result.error };
      }
    }

    await sleep(500);
    return {
      data: createPostViewFromPayload(payload, user),
      error: null as string | null,
    };
  },

  async updatePost(
    postId: string,
    payload: {
      type: Post["type"];
      title: string;
      description: string;
      category: string;
      productId?: string;
      itemName: string;
      itemCondition: string;
      urgency?: RequestPostRecord["urgency"];
    },
    context?: { authToken?: string | null; user?: User | null },
  ) {
    const authToken = context?.authToken ?? undefined;
    const memberId = context?.user?.id ?? "";
    const backendPostType = toBackendPostType(payload.type);
    const productId = payload.productId ?? toProductId(payload.category);

    const backendResult = await requestEnvelope<any>(
      `${backendConfig.endpoints.posts}/${postId}?type=${backendPostType}`,
      {
        method: "PATCH",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          post_type: backendPostType,
          type: payload.type,
          title: payload.title,
          content: payload.description,
          description: payload.description,
          category_id: productId,
          product_id: productId,
          category: payload.category,
          item_name: payload.itemName,
          item_condition: payload.itemCondition,
          urgency: payload.urgency,
        }),
      },
    );

    if (backendResult.error) {
      return { data: null as Post | null, error: backendResult.error };
    }

    if (backendResult.data) {
      return {
        data: mapBackendPost(backendResult.data),
        error: null as string | null,
      };
    }

    const legacyResult =
      payload.type === "share"
        ? await donateAPI.update(postId, memberId, {
            title: payload.title,
            content: payload.description,
          })
        : await requestAPI.update(postId, memberId, {
            title: payload.title,
            content: payload.description,
            urgency: payload.urgency ?? "normal",
          });

    if (legacyResult.error) {
      return { data: null as Post | null, error: legacyResult.error };
    }

    return { data: null as Post | null, error: null as string | null };
  },

  async checkHarmfulItem(
    image: UploadableImage,
    extras?: { title?: string; description?: string },
    token?: string,
  ) {
    const formData = new FormData();
    formData.append("image", toBackendFilePart(image));
    formData.append("title", extras?.title ?? "");
    formData.append("description", extras?.description ?? "");

    const response = await fetch(
      `${backendConfig.baseUrl}${backendConfig.endpoints.harmfulCheck}`,
      {
        method: "POST",
        headers: token ? buildAuthHeaders(token) : undefined,
        body: formData,
      },
    )
      .then(async (fetchResponse) => {
        const raw = await fetchResponse.json().catch(() => null);
        return {
          data: raw,
          error: fetchResponse.ok
            ? null
            : (raw?.message ?? raw?.error ?? `HTTP ${fetchResponse.status}`),
        };
      })
      .catch(() => ({
        data: null,
        error:
          "백엔드 서버에 연결할 수 없습니다. 서버 실행 상태와 API 주소를 확인해주세요.",
      }));

    const hasHarmfulResult =
      Array.isArray(response.data?.problematic_images) &&
      response.data.problematic_images.length > 0;

    if (response.error && !hasHarmfulResult) {
      return {
        data: null as ImageAnalysisResult | null,
        error: response.error,
      };
    }

    if (response.data) {
      const firstAnalysis = Array.isArray(response.data.analyzed_images)
        ? response.data.analyzed_images[0]
        : response.data;
      const firstProblem = Array.isArray(response.data.problematic_images)
        ? response.data.problematic_images[0]
        : null;
      const rawAiResult = firstAnalysis?.raw_ai_result ?? firstAnalysis;
      const suggestedTitle =
        firstAnalysis?.suggested_title ??
        firstAnalysis?.suggestedTitle ??
        rawAiResult?.suggested_title ??
        rawAiResult?.suggestedTitle ??
        response.data.suggested_title ??
        response.data.suggestedTitle;
      const aiGeneratedPost =
        firstAnalysis?.ai_generated_post ??
        firstAnalysis?.aiGeneratedPost ??
        firstAnalysis?.suggested_description ??
        firstAnalysis?.suggestedDescription ??
        rawAiResult?.ai_generated_post ??
        rawAiResult?.aiGeneratedPost ??
        rawAiResult?.suggested_description ??
        rawAiResult?.suggestedDescription ??
        response.data.ai_generated_post ??
        response.data.aiGeneratedPost ??
        response.data.suggested_description ??
        response.data.suggestedDescription;
      const extractedFeatures =
        firstAnalysis?.extracted_features ??
        firstAnalysis?.extractedFeatures ??
        rawAiResult?.extracted_features ??
        rawAiResult?.extractedFeatures ??
        response.data.extracted_features ??
        response.data.extractedFeatures ??
        [];
      const category =
        firstAnalysis?.category ??
        firstAnalysis?.recommended_category ??
        firstAnalysis?.recommendedCategory ??
        rawAiResult?.category ??
        rawAiResult?.recommended_category ??
        rawAiResult?.recommendedCategory ??
        response.data.category ??
        response.data.recommended_category ??
        response.data.recommendedCategory;
      const normalizedCategory = normalizeAiCategory(category);

      return {
        data: {
          isHarmful: Boolean(
            response.data.isHarmful ??
            response.data.is_dangerous ??
            firstProblem,
          ),
          reason:
            response.data.reason ??
            response.data.message ??
            firstProblem?.ai_reason,
          confidence: Number(
            firstAnalysis?.confidence ??
              rawAiResult?.confidence ??
              response.data.confidence ??
              1,
          ),
          detectedItem:
            suggestedTitle ??
            category ??
            response.data.detectedItem ??
            response.data.ai_guess ??
            firstAnalysis?.ai_guess ??
            rawAiResult?.ai_guess ??
            firstProblem?.ai_guess ??
            "분석 완료",
          recommendedCategory: normalizedCategory,
          recommendedCategoryLabel: category,
          suggestedTitle,
          suggestedDescription: aiGeneratedPost,
          isSameItem:
            firstAnalysis?.is_same_item ??
            firstAnalysis?.isSameItem ??
            rawAiResult?.is_same_item ??
            rawAiResult?.isSameItem ??
            response.data.is_same_item ??
            response.data.isSameItem,
          extractedFeatures,
          aiGeneratedPost,
          rawAiResult: rawAiResult ?? response.data,
        },
        error: null as string | null,
      };
    }

    await sleep(1000);
    return { data: inferFromFilename(image), error: null as string | null };
  },

  async listAll(authToken?: string) {
    const response = await requestEnvelope<{ posts?: any[] } | any[]>(
      backendConfig.endpoints.posts,
      {
        headers: buildAuthHeaders(authToken),
      },
    );

    if (response.error) {
      return { data: [], error: response.error as string | null };
    }

    const posts = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.posts)
        ? response.data.posts
        : null;

    if (posts) {
      return {
        data: posts.map((post) =>
          mapBackendPost(post, findLocationByDongName("역삼동")),
        ),
        error: null as string | null,
      };
    }

    return { data: [], error: null as string | null };
  },

  async deletePost(post: Post, authToken?: string) {
    const backendType = post.type === "need" ? "request" : "donate";
    const recordId = post.recordId || post.id.replace(/^(donate|request)_/, "");

    const response = await requestEnvelope<{ message?: string }>(
      `${backendConfig.endpoints.posts}/${recordId}?type=${backendType}`,
      {
        method: "DELETE",
        headers: buildAuthHeaders(authToken),
      },
    );

    if (response.error) {
      return {
        data: null as { success: boolean } | null,
        error: response.error,
      };
    }

    return { data: { success: true }, error: null as string | null };
  },
};
