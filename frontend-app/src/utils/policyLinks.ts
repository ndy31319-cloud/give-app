const GOV24_HOSTS = new Set(['gov.kr', 'www.gov.kr']);
const GOV24_SEARCH_URL = 'https://www.gov.kr/search';

function trimPath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

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
 * Reject Government24 directory/home links. They are valid HTTPS URLs, but
 * they do not identify the selected policy and make category links appear to
 * work while sending the user to an unrelated generic page.
 */
export function isPolicySpecificUrl(value: string | null | undefined): boolean {
  const normalized = normalizePolicyUrl(value);
  if (!normalized) return false;

  const parsed = new URL(normalized);
  if (!GOV24_HOSTS.has(parsed.hostname.toLowerCase())) return true;

  const path = trimPath(parsed.pathname);
  if (path === '/search') {
    return Boolean(parsed.searchParams.get('srchTxt')?.trim());
  }
  if (
    path === '/' ||
    path === '/portal' ||
    path === '/portal/gvrnPolicy/listAll' ||
    path === '/portal/rcvfvrSvc' ||
    path === '/portal/rcvfvrSvc/main' ||
    path === '/portal/rcvfvrSvc/dtlEx'
  ) {
    return false;
  }

  return true;
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
  return (isPolicySpecificUrl(officialUrl) ? normalizePolicyUrl(officialUrl) : null)
    || (isPolicySpecificUrl(applicationUrl) ? normalizePolicyUrl(applicationUrl) : null)
    || buildPolicySearchUrl(title);
}
