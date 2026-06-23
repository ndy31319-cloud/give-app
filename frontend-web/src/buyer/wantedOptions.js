export const WANTED_CATEGORY_OPTIONS = [
  { id: 'clothing', name: '의류', productId: 1 },
  { id: 'electronics', name: '전자제품', productId: 2 },
  { id: 'furniture', name: '가구', productId: 91 },
  { id: 'books', name: '도서', productId: 106 },
  { id: 'household', name: '생활용품', productId: 51 },
  { id: 'baby', name: '육아용품', productId: 51 },
  { id: 'kitchen', name: '주방용품', productId: 51 },
  { id: 'digital', name: '디지털기기', productId: 2 },
  { id: 'custom', name: '직접 입력', productId: 51 },
];

export const URGENCY_OPTIONS = [
  { value: 'urgent', label: '급해요' },
  { value: 'normal', label: '급하지 않아요' },
  { value: 'slow', label: '천천히 받아도 돼요' },
];

export function getWantedCategoryPayload(categoryId) {
  const selectedCategory = WANTED_CATEGORY_OPTIONS.find((category) => category.id === categoryId);

  return {
    category: selectedCategory?.id || 'custom',
    categoryId: selectedCategory?.productId || 51,
  };
}
