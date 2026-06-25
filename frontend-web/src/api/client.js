const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === 'development' ? '' : 'https://give-app.onrender.com';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE_URL;

export const KIOSK_DEFAULT_LOCATION = {
  dongName: '안양동',
  latitude: 37.3798657,
  longitude: 126.9288104,
};

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

function buildKioskHeaders() {
  return process.env.REACT_APP_KIOSK_API_KEY
    ? { 'x-kiosk-key': process.env.REACT_APP_KIOSK_API_KEY }
    : {};
}

export async function loginMember({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, member_pw: password }),
  });
}

export async function loginWithMemberCode({ code, postId }) {
  const certificateNumber = normalizeCertificateCode(code);

  return request('/api/auth/code-login', {
    method: 'POST',
    body: JSON.stringify({
      code: certificateNumber,
      certificate_number: certificateNumber,
      certificateNo: certificateNumber,
      postId,
    }),
  });
}

export function normalizeCertificateCode(value) {
  const input = String(value || '').trim().toUpperCase();
  const digits = input.replace(/\D/g, '');

  if (/^WF-\d{4}-\d{4}$/.test(input)) {
    return input;
  }

  if (/^\d{4}$/.test(digits)) {
    return `WF-2026-${digits}`;
  }

  if (/^\d{8}$/.test(digits)) {
    return `WF-${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return input;
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

export function getPostImageUrl(item) {
  const imageList = item?.images || item?.imageUrls || item?.image_urls;
  const firstImage = Array.isArray(imageList) ? imageList.find(Boolean) : null;
  return item?.image || item?.img || item?.image_url || item?.imageUrl || firstImage || null;
}

export function getSavedUserDongName() {
  try {
    const user = JSON.parse(localStorage.getItem('givegive_user') || 'null');
    return user?.dongName || user?.dong_name || user?.location?.dongName || KIOSK_DEFAULT_LOCATION.dongName;
  } catch {
    return KIOSK_DEFAULT_LOCATION.dongName;
  }
}

export async function fetchPost(postId, type) {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return request(`/api/posts/${postId}${query}`);
}

export async function fetchCurrentMember() {
  return request('/api/members/me');
}

export async function fetchMyPosts() {
  return request('/api/members/me/posts');
}

export async function fetchMyLikes() {
  return request('/api/members/me/likes');
}

export async function fetchWantedPosts(params = {}) {
  const posts = await fetchPosts(params);
  const items = posts.content || posts.posts || posts || [];
  return items.filter((item) => (item.post_type || item.postType || item.type) === 'request');
}

export async function createWantedPost({
  title,
  content,
  category,
  categoryId,
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
      category,
      category_id: categoryId,
      urgency,
      dongName,
      latitude,
      longitude,
      createdFrom: 'web',
    }),
  });
}

export async function validateLockerQr(token) {
  return request('/api/device/qr/storage/validate', {
    method: 'POST',
    headers: buildKioskHeaders(),
    body: JSON.stringify({ token }),
  });
}

export async function consumeLockerQr(token) {
  return request('/api/device/qr/storage/consume', {
    method: 'POST',
    headers: buildKioskHeaders(),
    body: JSON.stringify({ token }),
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
