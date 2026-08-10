const DONATE_TYPES = new Set(['donate', 'share', 'give', 'donation']);
const REQUEST_TYPES = new Set(['request', 'need', 'wanted']);
const UNAVAILABLE_DONATE_STATUSES = new Set([
  'reserved',
  'completed',
  'complete',
  'closed',
  'done',
  'received',
  'picked up',
  'pickup completed',
]);
const DONATION_INTEREST_STORAGE_PREFIX = 'givegive_donation_interest_request_ids';

const CATEGORY_ALIASES = {
  clothing: [
    'clothing',
    'clothes',
    'fashion',
    'wear',
    'apparel',
    '의류',
    '옷',
    '패션',
    '패션/의류',
  ],
  electronics: [
    'electronics',
    'electronic',
    'appliance',
    'appliances',
    'home appliance',
    'home appliances',
    '전자제품',
    '전자 제품',
    '가전',
    '가전제품',
    '가전 제품',
    '디지털/가전',
  ],
  furniture: [
    'furniture',
    'interior',
    'furnishing',
    '가구',
    '인테리어',
    '가구/인테리어',
  ],
  books: [
    'books',
    'book',
    '도서',
    '책',
    '서적',
  ],
  household: [
    'household',
    'daily',
    'daily necessities',
    'daily supplies',
    'living',
    '생활',
    '생활용품',
    '생활 용품',
    '생필품',
  ],
  baby: [
    'baby',
    'kids',
    'child',
    'children',
    '유아',
    '아동',
    '유아용품',
    '유아 용품',
    '아동용품',
    '아동 용품',
  ],
  kitchen: [
    'kitchen',
    'cookware',
    'tableware',
    '주방',
    '주방용품',
    '주방 용품',
  ],
  digital: [
    'digital',
    'device',
    'devices',
    'gadget',
    'gadgets',
    '디지털',
    '디지털기기',
    '디지털 기기',
    '전자기기',
    '전자 기기',
  ],
};

const CATEGORY_ID_ALIASES = {
  1: 'clothing',
  2: 'electronics',
  51: 'household',
  91: 'furniture',
  106: 'books',
};

function simplify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getPostId(item) {
  return item?.post_id || item?.postId || item?.recordId || item?.id;
}

export function getPostType(item) {
  return simplify(item?.post_type || item?.postType || item?.type || item?.postKind);
}

export function isDonatePost(item) {
  const postType = getPostType(item);
  const status = simplify(item?.status || item?.postStatus || item?.post_status);

  if (UNAVAILABLE_DONATE_STATUSES.has(status)) {
    return false;
  }

  if (!postType) {
    return true;
  }

  if (REQUEST_TYPES.has(postType)) {
    return false;
  }

  return DONATE_TYPES.has(postType) || postType.includes('donate') || postType.includes('share');
}

export function isRequestOpen(item) {
  const status = simplify(item?.status || item?.postStatus || item?.post_status);
  return status === 'open';
}

function getDonationInterestStorageKey() {
  try {
    const user = JSON.parse(localStorage.getItem('givegive_user') || 'null');
    const userId = user?.memberId || user?.member_id || user?.id || user?.email || 'unknown';
    return `${DONATION_INTEREST_STORAGE_PREFIX}:${userId}`;
  } catch {
    return `${DONATION_INTEREST_STORAGE_PREFIX}:unknown`;
  }
}

export function getSentDonationRequestIds() {
  try {
    const savedIds = JSON.parse(localStorage.getItem(getDonationInterestStorageKey()) || '[]');
    return new Set(Array.isArray(savedIds) ? savedIds.map(String) : []);
  } catch {
    return new Set();
  }
}

export function saveDonationInterest(item) {
  const requestId = getPostId(item);

  if (requestId === undefined || requestId === null) {
    return null;
  }

  const sentIds = getSentDonationRequestIds();
  sentIds.add(String(requestId));
  localStorage.setItem(getDonationInterestStorageKey(), JSON.stringify([...sentIds]));
  return String(requestId);
}

export function normalizeCategory(category) {
  const normalized = simplify(category);

  if (!normalized) {
    return '';
  }

  const exactMatch = Object.entries(CATEGORY_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => simplify(alias) === normalized)
  );

  if (exactMatch) {
    return exactMatch[0];
  }

  const partialMatch = Object.entries(CATEGORY_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => {
      const normalizedAlias = simplify(alias);
      return normalizedAlias && (normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized));
    })
  );

  return partialMatch ? partialMatch[0] : normalized;
}

export function getItemCategory(item) {
  const directCategory =
    item?.category ||
    item?.categoryName ||
    item?.category_name ||
    item?.productCategory ||
    item?.product_category ||
    item?.product?.category;
  const normalizedDirectCategory = normalizeCategory(directCategory);

  if (normalizedDirectCategory) {
    return normalizedDirectCategory;
  }

  const categoryId =
    item?.category_id ||
    item?.categoryId ||
    item?.product_id ||
    item?.productId ||
    item?.product?.product_id ||
    item?.product?.productId;

  return CATEGORY_ID_ALIASES[Number(categoryId)] || '';
}

export function matchesCategory(item, selectedCategory) {
  return selectedCategory === 'all' || getItemCategory(item) === selectedCategory;
}
