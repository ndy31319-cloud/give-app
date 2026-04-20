const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

const TOKEN_STORAGE_KEY = "give-app-token";

type ApiResult<T> = { data: T | null; error: string | null };

const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);
const setStoredToken = (token: string) =>
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
const clearStoredToken = () => localStorage.removeItem(TOKEN_STORAGE_KEY);

const buildUrl = (endpoint: string) =>
  `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

const buildHeaders = (
  headers?: HeadersInit,
  withJson = true,
  withAuth = false,
): HeadersInit => {
  const nextHeaders: Record<string, string> = {};

  if (withJson) {
    nextHeaders["Content-Type"] = "application/json";
  }

  if (withAuth) {
    const token = getStoredToken();

    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }
  }

  if (!headers) {
    return nextHeaders;
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      nextHeaders[key] = value;
    });
    return nextHeaders;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      nextHeaders[key] = value;
    });
    return nextHeaders;
  }

  return {
    ...nextHeaders,
    ...headers,
  };
};

async function parseResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return null;
}

async function requestJSON<T>(
  endpoint: string,
  options?: RequestInit & { withAuth?: boolean },
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(buildUrl(endpoint), {
      ...options,
      headers: buildHeaders(options?.headers, true, options?.withAuth),
    });

    const payload = await parseResponse<any>(response);

    if (!response.ok) {
      return {
        data: null,
        error: payload?.message || payload?.error || `HTTP ${response.status}`,
      };
    }

    return { data: payload as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

async function requestForm<T>(
  endpoint: string,
  formData: FormData,
  options?: RequestInit & { withAuth?: boolean },
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(buildUrl(endpoint), {
      ...options,
      body: formData,
      headers: buildHeaders(options?.headers, false, options?.withAuth),
    });

    const payload = await parseResponse<any>(response);

    if (!response.ok) {
      return {
        data: null,
        error: payload?.message || payload?.error || `HTTP ${response.status}`,
      };
    }

    return { data: payload as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

const mapRoleToVulnerable = (roleId?: number) => roleId === 3;

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

const mapPostStatus = (
  status?: string,
): "available" | "reserved" | "completed" => {
  if (status === "reserved") {
    return "reserved";
  }

  if (status === "completed" || status === "closed") {
    return "completed";
  }

  return "available";
};

const mapPostType = (type?: string): "share" | "need" =>
  type === "request" ? "need" : "share";

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  birthdate: string;
  isVulnerable: boolean;
  vulnerableTypes?: string[];
  location: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isVulnerable: boolean;
  vulnerableTypes?: string[];
  location: string;
  profileImage?: string;
  birthdate?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

interface LoginApiPayload {
  success: boolean;
  message: string;
  data: {
    token: string;
    member_id: number;
    email: string;
    role_id: number;
  };
}

interface MeApiPayload {
  member_id: number;
  name: string;
  email: string;
  phone?: string;
  role_id: number;
  dong_name?: string;
}

const loadCurrentUser = async (
  token: string,
): Promise<ApiResult<AuthResponse>> => {
  setStoredToken(token);

  const meResult = await requestJSON<MeApiPayload>("/members/me", {
    method: "GET",
    withAuth: true,
  });

  if (meResult.error || !meResult.data) {
    clearStoredToken();
    return { data: null, error: meResult.error || "Failed to load profile." };
  }

  saveUserId(String(meResult.data.member_id));

  return {
    data: {
      token,
      user: {
        id: String(meResult.data.member_id),
        name: meResult.data.name,
        email: meResult.data.email,
        phone: meResult.data.phone,
        isVulnerable: mapRoleToVulnerable(meResult.data.role_id),
        location: meResult.data.dong_name || "",
      },
    },
    error: null,
  };
};

export const authAPI = {
  signup: async (data: SignupRequest): Promise<ApiResult<AuthResponse>> => {
    const signupResult = await requestJSON<{
      success: boolean;
      message: string;
      data: { member_id: number };
    }>("/members/signup", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone,
        member_pw: data.password,
        nickname: data.name,
        dong_name: data.location,
        isVulnerable: data.isVulnerable,
      }),
    });

    if (signupResult.error) {
      return { data: null, error: signupResult.error };
    }

    return authAPI.login({
      email: data.email,
      password: data.password,
    });
  },

  login: async (data: LoginRequest): Promise<ApiResult<AuthResponse>> => {
    const loginResult = await requestJSON<LoginApiPayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        member_pw: data.password,
      }),
    });

    if (loginResult.error || !loginResult.data?.data?.token) {
      return {
        data: null,
        error: loginResult.error || "Failed to log in.",
      };
    }

    return loadCurrentUser(loginResult.data.data.token);
  },

  logout: async (): Promise<ApiResult<boolean>> => {
    clearStoredToken();
    return { data: true, error: null };
  },
};

export interface Post {
  id: string;
  type: "share" | "need";
  title: string;
  description: string;
  location: string;
  time: string;
  status: "available" | "reserved" | "completed";
  category: string;
  author: {
    id: string;
    name: string;
    temperature: number;
  };
  images: string[];
  distance?: number;
}

interface PostsApiItem {
  post_id: number;
  member_id: number;
  title: string;
  status: string;
  created_at: string;
  post_type: "donate" | "request";
}

interface PostDetailApiItem {
  donate_id?: number;
  request_id?: number;
  member_id: number;
  name?: string;
  nickname?: string;
  title: string;
  content?: string;
  dong_name?: string;
  created_at?: string;
  status?: string;
  item_name?: string;
}

const mapListPost = (post: PostsApiItem): Post => ({
  id: String(post.post_id),
  type: mapPostType(post.post_type),
  title: post.title,
  description: "",
  location: "",
  time: formatRelativeTime(post.created_at),
  status: mapPostStatus(post.status),
  category: "",
  author: {
    id: String(post.member_id),
    name: post.nickname || post.name || "사용자",
    temperature: 36.5,
  },
  images: [],
});

const mapDetailPost = (
  post: PostDetailApiItem,
  postType: "share" | "need",
): Post => ({
  id: String(post.donate_id || post.request_id || ""),
  type: postType,
  title: post.title,
  description: post.content || "",
  location: post.dong_name || "",
  time: formatRelativeTime(post.created_at),
  status: mapPostStatus(post.status),
  category: post.item_name || "",
  author: {
    id: String(post.member_id),
    name: "",
    temperature: 36.5,
  },
  images: [],
});

export const postAPI = {
  getPosts: async (filters?: {
    type?: "share" | "need";
    category?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResult<Post[]>> => {
    const result = await requestJSON<PostsApiItem[]>("/posts", {
      method: "GET",
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    let posts = result.data.map(mapListPost);

    if (filters?.type) {
      posts = posts.filter((post) => post.type === filters.type);
    }

    if (filters?.search) {
      const keyword = filters.search.toLowerCase();
      posts = posts.filter((post) =>
        post.title.toLowerCase().includes(keyword),
      );
    }

    return { data: posts, error: null };
  },

  getPost: async (
    id: string,
    type: "share" | "need" = "share",
  ): Promise<ApiResult<Post>> => {
    const backendType = type === "need" ? "request" : "donate";
    const result = await requestJSON<PostDetailApiItem>(
      `/posts/${id}?type=${backendType}`,
      {
        method: "GET",
      },
    );

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    return {
      data: mapDetailPost(result.data, type),
      error: null,
    };
  },

  createPost: async (data: {
    title: string;
    description: string;
    category: string;
    postType: "share" | "need";
    imageFile?: File | null;
  }): Promise<ApiResult<{ post_id: number; post_type: string }>> => {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("content", data.description);
    formData.append("item_name", data.category || data.title);
    formData.append("item_condition", "상태 무관");
    formData.append("product_id", "1");

    if (data.imageFile) {
      formData.append("image", data.imageFile);
    }

    return requestForm<{ post_id: number; post_type: string }>(
      "/posts",
      formData,
      {
        method: "POST",
        withAuth: true,
      },
    );
  },

  checkHarmfulItem: async (
    imageFile: File,
  ): Promise<ApiResult<{ isHarmful: boolean; reason?: string }>> => {
    const formData = new FormData();
    formData.append("image", imageFile);

    const result = await requestForm<{
      ai_reason?: string;
      message?: string;
    }>("/posts/analyze", formData, {
      method: "POST",
      withAuth: true,
    });

    if (result.error) {
      return {
        data: {
          isHarmful: true,
          reason: result.error,
        },
        error: null,
      };
    }

    return {
      data: {
        isHarmful: false,
        reason: result.data?.message,
      },
      error: null,
    };
  },
};

export interface Policy {
  id: string;
  title: string;
  category: string;
  description: string;
  target: string;
  support: string;
  eligibility?: string[];
  howToApply?: string;
}

const notImplemented = <T>(message: string): ApiResult<T> => ({
  data: null,
  error: message,
});

export const policyAPI = {
  getRecommendedPolicies: async (): Promise<ApiResult<Policy[]>> =>
    notImplemented("정책 추천 API는 아직 백엔드와 연결되지 않았습니다."),

  getPoliciesByCategory: async (): Promise<ApiResult<Policy[]>> =>
    notImplemented("정책 카테고리 API는 아직 백엔드와 연결되지 않았습니다."),

  chatbotQuery: async (): Promise<
    ApiResult<{ response: string; suggestedPolicies?: Policy[] }>
  > => notImplemented("정책 챗봇 API는 아직 백엔드와 연결되지 않았습니다."),
};

export interface Chat {
  id: string;
  participant: {
    id: string;
    name: string;
    profileImage?: string;
  };
  lastMessage: string;
  time: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  text: string;
  sender: "me" | "other";
  time: string;
  type?: "text" | "image" | "location";
  imageUrl?: string;
  location?: { lat: number; lng: number; address: string };
}

interface CreateChatRoomRequest {
  name?: string;
  participantIds: number[];
  relatedPostId?: string | number | null;
  relatedPostType?: "donate" | "request" | null;
}

interface ChatRoomApiItem {
  id: string;
  name?: string;
  participants?: Array<{ member_id: number; name?: string; nickname?: string }>;
  lastMessage?: string | null;
  lastMessageAt?: { _seconds?: number; _nanoseconds?: number } | string | null;
}

interface MessageApiItem {
  id: string;
  text: string;
  sender?: { member_id?: number };
  createdAt?: { _seconds?: number; _nanoseconds?: number } | string | null;
}

const firestoreTimeToString = (value: MessageApiItem["createdAt"]) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return formatRelativeTime(value);
  }

  if (typeof value === "object" && "_seconds" in value && value._seconds) {
    return formatRelativeTime(new Date(value._seconds * 1000).toISOString());
  }

  return "";
};

export const chatAPI = {
  createRoom: async (
    payload: CreateChatRoomRequest,
  ): Promise<ApiResult<{ id: string }>> => {
    const result = await requestJSON<{ data: { id: string } }>("/chats/rooms", {
      method: "POST",
      withAuth: true,
      body: JSON.stringify(payload),
    });

    if (result.error || !result.data?.data) {
      return { data: null, error: result.error };
    }

    return {
      data: {
        id: result.data.data.id,
      },
      error: null,
    };
  },

  getChats: async (): Promise<ApiResult<Chat[]>> => {
    const result = await requestJSON<{ data: ChatRoomApiItem[] }>(
      "/chats/rooms",
      {
        method: "GET",
        withAuth: true,
      },
    );

    if (result.error || !result.data?.data) {
      return { data: null, error: result.error };
    }

    return {
      data: result.data.data.map((room) => ({
        id: room.id,
        participant: {
          id: String(room.participants?.[0]?.member_id || room.id),
          name:
            room.name ||
            room.participants?.[0]?.nickname ||
            room.participants?.[0]?.name ||
            "채팅방",
        },
        lastMessage: room.lastMessage || "",
        time: firestoreTimeToString(
          room.lastMessageAt as MessageApiItem["createdAt"],
        ),
        unreadCount: 0,
      })),
      error: null,
    };
  },

  getMessages: async (chatId: string): Promise<ApiResult<Message[]>> => {
    const result = await requestJSON<{ data: MessageApiItem[] }>(
      `/chats/rooms/${chatId}/messages`,
      {
        method: "GET",
        withAuth: true,
      },
    );

    if (result.error || !result.data?.data) {
      return { data: null, error: result.error };
    }

    const myId = localStorage.getItem("give-app-user-id");

    return {
      data: result.data.data.map((message) => ({
        id: message.id,
        text: message.text,
        sender:
          String(message.sender?.member_id || "") === myId ? "me" : "other",
        time: firestoreTimeToString(message.createdAt),
        type: "text",
      })),
      error: null,
    };
  },

  sendMessage: async (
    chatId: string,
    message: Omit<Message, "id" | "time">,
  ): Promise<ApiResult<Message>> => {
    const result = await requestJSON<{ data: MessageApiItem }>(
      `/chats/rooms/${chatId}/messages`,
      {
        method: "POST",
        withAuth: true,
        body: JSON.stringify({ text: message.text }),
      },
    );

    if (result.error || !result.data?.data) {
      return { data: null, error: result.error };
    }

    return {
      data: {
        id: result.data.data.id,
        text: result.data.data.text,
        sender: "me",
        time: firestoreTimeToString(result.data.data.createdAt),
        type: "text",
      },
      error: null,
    };
  },
};

export const userAPI = {
  updateProfile: async (
    data: Partial<{
      email: string;
      phone: string;
      nickname: string;
      password: string;
    }>,
  ) =>
    requestJSON<{ message: string }>("/members/me", {
      method: "PATCH",
      withAuth: true,
      body: JSON.stringify({
        email: data.email,
        phone: data.phone,
        nickname: data.nickname,
        member_pw: data.password,
      }),
    }),

  updateLocation: async (payload: {
    dong_name: string;
    latitude: number;
    longitude: number;
  }) =>
    requestJSON<{ message: string }>("/members/me/location", {
      method: "PATCH",
      withAuth: true,
      body: JSON.stringify(payload),
    }),

  getStats: async () =>
    requestJSON<any>("/mypage/histories", { method: "GET", withAuth: true }),
};

export const searchAPI = {
  searchPosts: async (query: string): Promise<ApiResult<Post[]>> =>
    postAPI.getPosts({ search: query }),

  searchByImage: async (): Promise<ApiResult<Post[]>> =>
    notImplemented("이미지 검색 API는 아직 백엔드와 연결되지 않았습니다."),
};

export const authStorage = {
  getToken: getStoredToken,
  clearToken: clearStoredToken,
  setToken: setStoredToken,
};

export const saveUserId = (userId: string) =>
  localStorage.setItem("give-app-user-id", userId);
