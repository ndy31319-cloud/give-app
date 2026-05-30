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
    throw new Error(data?.message || data?.error || 'API 요청에 실패했습니다.');
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

export async function signupMember({ name, id, password, phone, region }) {
  return request('/api/members/signup', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email: id,
      nickname: name,
      member_pw: password,
      phone,
      dong_name: region,
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

export async function fetchPost(postId, type) {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return request(`/api/posts/${postId}${query}`);
}

export async function fetchWantedPosts() {
  const posts = await fetchPosts();
  const items = posts.content || posts.posts || posts || [];
  return items.filter((item) => (item.post_type || item.postType || item.type) === 'request');
}

export async function createWantedPost({
  title,
  content,
  urgency = 'normal',
  dongName,
  latitude,
  longitude,
}) {
  return request('/api/wanted', {
    method: 'POST',
    body: JSON.stringify({
      title,
      content: content?.trim() ? content.trim() : null,
      urgency,
      dongName,
      latitude,
      longitude,
      createdFrom: 'web',
    }),
  });
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
