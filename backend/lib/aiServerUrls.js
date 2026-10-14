const DEFAULT_LOCAL_AI_SERVER_URL = "http://127.0.0.1:8000";

const splitConfiguredUrls = (value) =>
  String(value || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

const uniqueUrls = (urls) => [...new Set(urls.filter(Boolean))];

const isHostedRuntime = () =>
  Boolean(
    process.env.RENDER ||
      process.env.RENDER_SERVICE_ID ||
      process.env.RENDER_EXTERNAL_URL,
  );

const shouldBlockLoopbackAiUrl = () =>
  process.env.AI_SERVER_ALLOW_LOOPBACK_IN_PRODUCTION !== "true" &&
  (process.env.NODE_ENV === "production" || isHostedRuntime());

const isLoopbackUrl = (rawUrl) => {
  try {
    const { hostname } = new URL(rawUrl);
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
  } catch {
    return false;
  }
};

const stripKnownAiSuffix = (rawUrl) => {
  let normalizedUrl = String(rawUrl || "").trim().replace(/\/+$/, "");
  const suffixes = [
    "/docs",
    "/api/post/generate-post",
    "/api/chat",
    "/api/image/check-safety",
    "/api/image",
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (normalizedUrl.endsWith(suffix)) {
        normalizedUrl = normalizedUrl.slice(0, -suffix.length).replace(/\/+$/, "");
        changed = true;
      }
    }
  }

  return normalizedUrl;
};

const appendEndpoint = (baseUrl, endpointPath) =>
  `${baseUrl.replace(/\/+$/, "")}/${endpointPath.replace(/^\/+/, "")}`;

const getBaseAiServerUrls = ({ includeDefaultLocal = true } = {}) => {
  const primaryUrls = splitConfiguredUrls(process.env.AI_SERVER_URL_PRIMARY);
  const legacyUrls = splitConfiguredUrls(process.env.AI_SERVER_URL);
  const localUrls = [
    ...splitConfiguredUrls(process.env.AI_SERVER_URL_LOCAL),
    ...splitConfiguredUrls(process.env.LOCAL_AI_SERVER_URL),
  ];
  const fallbackUrls = splitConfiguredUrls(process.env.AI_SERVER_URL_FALLBACK);
  const configuredUrls = [
    ...(primaryUrls.length ? primaryUrls : legacyUrls),
    ...localUrls,
    ...fallbackUrls,
  ];

  if (
    configuredUrls.length === 0 &&
    includeDefaultLocal &&
    process.env.AI_SERVER_DISABLE_LOCAL_DEFAULT !== "true" &&
    !shouldBlockLoopbackAiUrl()
  ) {
    configuredUrls.push(DEFAULT_LOCAL_AI_SERVER_URL);
  }

  return configuredUrls;
};

const normalizeAiEndpointUrl = (rawUrl, endpointPath) => {
  if (!rawUrl) {
    return null;
  }

  if (shouldBlockLoopbackAiUrl() && isLoopbackUrl(rawUrl)) {
    return null;
  }

  const normalizedUrl = String(rawUrl).trim().replace(/\/+$/, "");
  const normalizedEndpoint = `/${endpointPath.replace(/^\/+/, "")}`.replace(/\/+$/, "");

  if (normalizedUrl.endsWith(normalizedEndpoint)) {
    return endpointPath.endsWith("/") ? `${normalizedUrl}/` : normalizedUrl;
  }

  return appendEndpoint(stripKnownAiSuffix(rawUrl), endpointPath);
};

const resolveAiEndpointUrls = ({
  endpointPath,
  explicitUrls = [],
  missingMessage,
}) => {
  const candidateUrls = uniqueUrls([
    ...explicitUrls,
    ...getBaseAiServerUrls({ includeDefaultLocal: explicitUrls.length === 0 }),
  ]);
  const urls = uniqueUrls(
    candidateUrls
      .map((rawUrl) => normalizeAiEndpointUrl(rawUrl, endpointPath))
      .filter(Boolean),
  );

  if (!urls.length) {
    const error = new Error(
      missingMessage ||
        "AI 서버 URL이 설정되어 있지 않습니다. Render에서는 로컬 PC의 127.0.0.1에 접근할 수 없으므로 ngrok 또는 Cloudflare Tunnel 공개 주소를 AI_SERVER_URL에 설정해주세요.",
    );
    error.statusCode = 503;
    throw error;
  }

  return urls;
};

module.exports = {
  DEFAULT_LOCAL_AI_SERVER_URL,
  resolveAiEndpointUrls,
  splitConfiguredUrls,
  stripKnownAiSuffix,
};
