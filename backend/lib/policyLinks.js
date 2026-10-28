const GOV24_HOSTS = new Set(["gov.kr", "www.gov.kr"]);

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeKey = (value) =>
  text(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

const normalizeUrl = (value) => {
  const raw = text(value);
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (GOV24_HOSTS.has(parsed.hostname.toLowerCase())) {
      parsed.protocol = "https:";
      if (parsed.hostname.toLowerCase() === "gov.kr") parsed.hostname = "www.gov.kr";
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const isPolicySpecificUrl = (value) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;

  const parsed = new URL(normalized);
  if (!GOV24_HOSTS.has(parsed.hostname.toLowerCase())) return true;

  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (path === "/search") return Boolean(parsed.searchParams.get("srchTxt")?.trim());
  return ![
    "/",
    "/portal",
    "/portal/gvrnPolicy/listAll",
    "/portal/rcvfvrSvc",
    "/portal/rcvfvrSvc/main",
    "/portal/rcvfvrSvc/dtlEx",
  ].includes(path);
};

const usableUrl = (value) => (isPolicySpecificUrl(value) ? normalizeUrl(value) : null);

function linkValues(row) {
  const officialUrl = usableUrl(row?.official_url ?? row?.officialUrl);
  const applicationUrl = usableUrl(row?.application_url ?? row?.applicationUrl);
  return officialUrl || applicationUrl ? { officialUrl, applicationUrl } : null;
}

function candidateScore(policy, candidate) {
  const policyKey = normalizeKey(policy?.policy_name ?? policy?.title);
  const candidateKey = normalizeKey(candidate?.policy_name ?? candidate?.title);
  if (!policyKey || !candidateKey) return -1;

  const policyAgency = normalizeKey(policy?.agency);
  const candidateAgency = normalizeKey(candidate?.agency);
  const sameAgency = policyAgency && candidateAgency && policyAgency === candidateAgency;

  if (policyKey === candidateKey) return sameAgency ? 100 : 90;

  // Some old rows use a shorter display title while the synchronized row has
  // a parenthetical qualifier, e.g. "청년내일저축계좌" and
  // "자산형성지원사업(청년내일저축계좌)". Only use this conservative
  // containment match when the agency also agrees, preventing near matches
  // from silently opening another benefit.
  if (sameAgency && policyKey.length >= 6 && candidateKey.includes(policyKey)) {
    return 70 - Math.min(candidateKey.length - policyKey.length, 20) / 100;
  }

  return -1;
}

/**
 * Fill only missing or generic URLs from an already synchronized POLICY row.
 * The function never replaces a policy's own specific URL and never guesses
 * from a loose similarity match.
 */
function enrichPolicyLinks(policies, linkRows) {
  if (!Array.isArray(policies) || !Array.isArray(linkRows) || !linkRows.length) {
    return Array.isArray(policies) ? policies : [];
  }

  return policies.map((policy) => {
    const ownLinks = linkValues(policy) || {};
    if (ownLinks.officialUrl || ownLinks.applicationUrl) return policy;

    const candidate = linkRows
      .map((row) => ({ row, score: candidateScore(policy, row), links: linkValues(row) }))
      .filter((item) => item.score >= 0 && item.links)
      .sort((left, right) => right.score - left.score)[0];

    if (!candidate) return policy;
    return {
      ...policy,
      official_url: candidate.links.officialUrl,
      application_url: candidate.links.applicationUrl,
    };
  });
}

module.exports = {
  enrichPolicyLinks,
  isPolicySpecificUrl,
  normalizeKey,
  normalizeUrl,
};
