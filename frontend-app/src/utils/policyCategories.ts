export const POLICY_CATEGORY_ALIASES: Record<string, string[]> = {
  생활비: ['생활비', '생활안정'],
  주거: ['주거', '주거·자립'],
  의료: ['의료', '보건·의료'],
  교육: ['교육', '보육·교육'],
  문화: ['문화', '문화·환경'],
  일자리: ['일자리', '고용·창업'],
  복지: ['복지', '보호·돌봄', '임신·출산', '농림축산어업', '행정·안전'],
};

const normalize = (value: string | null | undefined) =>
  String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();

export function getPolicyCategoryGroup(category: string | null | undefined): string {
  const normalized = normalize(category);
  if (!normalized) return '';

  const matched = Object.entries(POLICY_CATEGORY_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => normalize(alias) === normalized),
  );
  return matched?.[0] ?? String(category).trim();
}

export function matchesPolicyCategory(
  policyCategory: string | null | undefined,
  selectedCategory: string,
  categoryGroup?: string | null,
): boolean {
  const selectedGroup = getPolicyCategoryGroup(selectedCategory);
  const actualGroup = getPolicyCategoryGroup(categoryGroup || policyCategory);
  return actualGroup === selectedGroup;
}
