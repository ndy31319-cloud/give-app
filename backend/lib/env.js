const crypto = require("crypto");

const unwrapQuotes = (value) => {
  let normalized = String(value ?? "").trim();

  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
};

// Tolerate values copied from Markdown or a local .env file with quotes.
const normalizeScalar = (value) => {
  let normalized = unwrapQuotes(value);
  const markdownLink = normalized.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

  if (markdownLink) {
    normalized = markdownLink[2].trim();
  } else if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1).trim();
  }

  return unwrapQuotes(normalized);
};

const normalizeMultilineSecret = (value) =>
  unwrapQuotes(value).replace(/\\n/g, "\n").replace(/\r/g, "");

const splitEnvList = (value) =>
  unwrapQuotes(value)
    .split(",")
    .map(normalizeScalar)
    .filter(Boolean);

const normalizeApiKey = (value) => normalizeScalar(value);

const isHostedRuntime = () =>
  Boolean(
    process.env.RENDER ||
      process.env.RENDER_SERVICE_ID ||
      process.env.RENDER_EXTERNAL_URL,
  );

const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" || isHostedRuntime();

const matchesApiKey = (expectedValue, providedValue) => {
  const expected = Buffer.from(normalizeApiKey(expectedValue));
  const provided = Buffer.from(normalizeApiKey(providedValue));

  return (
    expected.length > 0 &&
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided)
  );
};

module.exports = {
  matchesApiKey,
  normalizeApiKey,
  normalizeMultilineSecret,
  normalizeScalar,
  isProductionRuntime,
  isHostedRuntime,
  splitEnvList,
};
