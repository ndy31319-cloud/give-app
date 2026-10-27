const GOV24_HOSTS = new Set(['gov.kr', 'www.gov.kr']);

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
