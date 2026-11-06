const text = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, "").trim();

// The app presents a small, stable set of categories while the synchronized
// Government24 data uses more detailed labels. Keep the mapping in one place
// so the API query and response normalization cannot drift apart.
const CATEGORY_GROUPS = Object.freeze({
  생활비: ["생활비", "생활안정"],
  주거: ["주거", "주거·자립"],
  의료: ["의료", "보건·의료"],
  교육: ["교육", "보육·교육"],
  문화: ["문화", "문화·환경"],
  일자리: ["일자리", "고용·창업"],
  복지: ["복지", "보호·돌봄", "임신·출산", "농림축산어업", "행정·안전"],
});

const normalizedGroups = Object.entries(CATEGORY_GROUPS).map(([group, aliases]) => ({
  group,
  aliases: new Set(aliases.map(text)),
}));

function getPolicyCategoryAliases(category) {
  const value = text(category);
  if (!value) return [];

  const group = normalizedGroups.find((item) => item.group === value || item.aliases.has(value));
  return group ? [...group.aliases] : [value];
}

function canonicalPolicyCategory(category) {
  const value = text(category);
  if (!value) return "";

  const group = normalizedGroups.find((item) => item.group === value || item.aliases.has(value));
  return group?.group || String(category).trim();
}

module.exports = {
  CATEGORY_GROUPS,
  canonicalPolicyCategory,
  getPolicyCategoryAliases,
};
