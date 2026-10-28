const GOV24_HOSTS = new Set(['gov.kr', 'www.gov.kr']);
const GOV24_SEARCH_URL = 'https://www.gov.kr/search';

/**
 * Keep the policy-specific path while making Government24 links eligible for
 * iOS Universal Link handling. Do not invent a custom gov24:// scheme because
 * the Government24 app does not publish one for arbitrary policy pages.
 */
export function normalizePolicyUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (GOV24_HOSTS.has(parsed.hostname.toLowerCase())) {
      parsed.protocol = 'https:';
      if (parsed.hostname.toLowerCase() === 'gov.kr') {
        parsed.hostname = 'www.gov.kr';
      }
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * The Government24 API does not provide a detail URL for every legacy row in
 * our database. A title-scoped search is safer than sending the user to the
 * generic benefit directory and still works for expired or archived services.
 */
export function buildPolicySearchUrl(title: string | null | undefined): string | null {
  const normalizedTitle = String(title ?? '').trim();
  if (!normalizedTitle) return null;
  return `${GOV24_SEARCH_URL}?srchTxt=${encodeURIComponent(normalizedTitle)}`;
}

export function resolvePolicyUrl(
  officialUrl: string | null | undefined,
  applicationUrl: string | null | undefined,
  title: string | null | undefined,
): string | null {
  return normalizePolicyUrl(officialUrl)
    || normalizePolicyUrl(applicationUrl)
    || buildPolicySearchUrl(title);
}
