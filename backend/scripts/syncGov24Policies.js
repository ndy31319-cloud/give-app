/*
 * Sync verified public-service data from ODCLOUD's Government24 API into POLICY.
 *
 * The API key is read only from the backend environment. The existing policy
 * importer performs validation, deduplication, upsert, and transaction rollback.
 */
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const dotenv = require("dotenv");

const localEnvPath = path.join(__dirname, "..", ".env");
const rootEnvPath = path.join(__dirname, "..", "..", ".env");
dotenv.config({ path: fsSync.existsSync(localEnvPath) ? localEnvPath : rootEnvPath });

let dbInitialized = false;

const envNumber = (name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < min) return fallback;
  return Math.min(value, max);
};

const config = {
  baseUrl: String(process.env.ODCLOUD_BASE_URL || "https://api.odcloud.kr/api").replace(/\/+$/, ""),
  apiKey: String(process.env.ODCLOUD_API_KEY || "").trim(),
  listPath: process.env.ODCLOUD_SERVICE_LIST_PATH || "/gov24/v3/serviceList",
  detailPath: process.env.ODCLOUD_SERVICE_DETAIL_PATH || "/gov24/v3/serviceDetail",
  limit: envNumber("ODCLOUD_POLICY_SYNC_LIMIT", 1000, { max: 1200 }),
  pageSize: envNumber("ODCLOUD_POLICY_PAGE_SIZE", 1000, { max: 1000 }),
  timeoutMs: envNumber("ODCLOUD_API_TIMEOUT_MS", 20000, { min: 1000, max: 120000 }),
  fetchDetails: String(process.env.ODCLOUD_FETCH_DETAILS || "false").toLowerCase() === "true",
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();

const safeUrl = value => {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const safeSourceDate = value => {
  const candidate = text(value);
  if (!candidate) return null;
  if (/^\d{14}$/.test(candidate)) return candidate;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : candidate;
};

function apiUrl(apiPath, params = {}) {
  const url = new URL(`${config.baseUrl}/${String(apiPath).replace(/^\/+/, "")}`);
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("serviceKey", config.apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

async function requestJson(apiPath, params = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(apiUrl(apiPath, params), { signal: controller.signal });
    const body = await response.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    if (!response.ok) {
      const message = text(parsed?.msg || parsed?.message || body).slice(0, 240);
      throw new Error(`ODCLOUD API 요청 실패 (${response.status})${message ? `: ${message}` : ""}`);
    }
    if (!parsed || !Array.isArray(parsed.data)) {
      throw new Error("ODCLOUD API 응답에 data 배열이 없습니다.");
    }
    return parsed;
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`ODCLOUD API 응답 시간이 초과되었습니다 (${config.timeoutMs}ms).`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchServiceList() {
  if (!config.apiKey) throw new Error("ODCLOUD_API_KEY가 설정되지 않았습니다.");

  const rows = [];
  let page = 1;
  while (rows.length < config.limit) {
    const perPage = Math.min(config.pageSize, config.limit - rows.length);
    const response = await requestJson(config.listPath, { page, perPage });
    rows.push(...response.data);
    if (response.data.length === 0 || rows.length >= Number(response.totalCount || 0)) break;
    page += 1;
  }
  return rows.slice(0, config.limit);
}

async function fetchServiceDetail(serviceId) {
  if (!serviceId) return null;
  const response = await requestJson(config.detailPath, {
    page: 1,
    perPage: 1,
    "cond[서비스ID::EQ]": serviceId,
  });
  return response.data[0] || null;
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function joinDetails(fields) {
  return Object.entries(fields)
    .map(([label, value]) => [label, text(value)])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function toPolicy(row, detail = null) {
  const merged = { ...row, ...(detail || {}) };
  const name = text(merged["서비스명"]);
  const agency = text(merged["소관기관명"] || merged["접수기관"] || merged["접수기관명"] || "정부24");
  const summary = text(merged["서비스목적요약"] || merged["서비스목적"] || name);
  const content = joinDetails({
    "서비스 목적": merged["서비스목적"] || merged["서비스목적요약"],
    "지원 대상": merged["지원대상"],
    "선정 기준": merged["선정기준"],
    "지원 내용": merged["지원내용"],
    "신청 방법": merged["신청방법"],
    "신청 기한": merged["신청기한"],
    "구비 서류": merged["구비서류"],
    "접수 기관": merged["접수기관"] || merged["접수기관명"],
    "문의처": merged["전화문의"] || merged["문의처"],
  }) || summary;
  const officialUrl = safeUrl(merged["상세조회URL"]);
  const applicationUrl = safeUrl(merged["온라인신청사이트URL"]);
  const sourceUpdatedAt = safeSourceDate(merged["수정일시"] || merged["등록일시"]);
  const aiSearchText = [name, merged["지원유형"], merged["서비스분야"], agency, summary, content].map(text).filter(Boolean).join(" ");

  return {
    policy_name: name,
    category: text(merged["서비스분야"] || merged["지원유형"] || "기타"),
    agency,
    summary,
    content,
    target_criteria: text(merged["지원대상"] || merged["선정기준"] || "공고 확인"),
    support_detail: text(merged["지원내용"] || summary),
    ai_search_text: aiSearchText,
    official_url: officialUrl,
    application_url: applicationUrl,
    application_period: text(merged["신청기한"] || "공고 확인"),
    region: null,
    source_updated_at: sourceUpdatedAt,
  };
}

async function buildPolicies() {
  const list = await fetchServiceList();
  let details = [];
  if (config.fetchDetails) {
    details = await withConcurrency(list, 5, async row => {
      try {
        return await fetchServiceDetail(text(row["서비스ID"]));
      } catch (error) {
        console.warn(`상세 조회를 건너뜁니다: ${text(row["서비스명"]) || "이름 없음"} (${error.message})`);
        return null;
      }
    });
  }
  const policies = list
    .map((row, index) => toPolicy(row, details[index]))
    .filter(policy => policy.policy_name && policy.agency && policy.summary && policy.content);
  if (policies.length < list.length) {
    console.warn(`필수값이 없는 API 정책 ${list.length - policies.length}건을 건너뛰었습니다.`);
  }
  return policies;
}

async function run() {
  if (!config.apiKey) throw new Error("ODCLOUD_API_KEY가 설정되지 않았습니다.");
  const policies = await buildPolicies();
  if (policies.length === 0) throw new Error("API에서 정책 데이터를 받지 못했습니다.");

  console.log(`ODCLOUD 정책 조회 완료: ${policies.length}건 (상세 조회: ${config.fetchDetails ? "사용" : "미사용"})`);
  console.log(`첫 정책 확인: ${policies[0].policy_name || "이름 없음"}`);
  if (process.argv.includes("--dry-run")) return { fetched: policies.length, dryRun: true };

  // Do not open MySQL for a dry run; this keeps API validation independent of DB state.
  require("../db");
  dbInitialized = true;
  const { importPolicies } = require("./importPolicies");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "give-policy-sync-"));
  const tempFile = path.join(tempDir, "policies.json");
  try {
    await fs.writeFile(tempFile, JSON.stringify({ policies }), "utf8");
    const result = await importPolicies(tempFile);
    return { fetched: policies.length, ...result, dryRun: false };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  run()
    .then(result => console.log(`정책 동기화 완료: ${JSON.stringify(result)}`))
    .catch(error => { console.error(`정책 동기화 실패: ${error.message}`); process.exitCode = 1; })
    .finally(() => {
      if (dbInitialized) {
        try { require("../db").end(); } catch { /* DB was never initialized. */ }
      }
    });
}

module.exports = { apiUrl, toPolicy, fetchServiceList, buildPolicies, run };
