const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('givegive_access_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || 'API 요청에 실패했습니다.');
  }

  return data;
}

export async function loginMember({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, member_pw: password }),
  });
}

export async function loginWithMemberCode({ code, postId }) {
  return request('/api/auth/code-login', {
    method: 'POST',
    body: JSON.stringify({ code, certificate_number: code, postId }),
  });
}

export async function signupMember({ name, nickname, phone }) {
  return request('/api/members/signup', {
    method: 'POST',
    body: JSON.stringify({
      name,
      nickname,
      phone,
      role: 'user',
    }),
  });
}

export async function fetchPosts(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return request(`/api/posts${query ? `?${query}` : ''}`);
}

export async function fetchPost(postId) {
  return request(`/api/posts/${postId}`);
}

export async function fetchWantedPosts() {
  return request('/api/wanted');
}

export function saveAuthToken(token) {
  if (token) {
    localStorage.setItem('givegive_access_token', token);
  }
}

export function clearAuthToken() {
  localStorage.removeItem('givegive_access_token');
}

export { API_BASE_URL };
