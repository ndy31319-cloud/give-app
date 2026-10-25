/*
 * Import verified public-policy data into POLICY.
 *
 * Input: a JSON array, or { policies: [...] }, using the canonical field names
 * documented in POLICY_IMPORT.md. The transaction is all-or-nothing and the
 * importer never invents policy facts or replaces non-empty values with blanks.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const configuredMaxRows = Number(process.env.POLICY_IMPORT_MAX_ROWS || 1200);
const MAX_IMPORT_ROWS = Number.isSafeInteger(configuredMaxRows) && configuredMaxRows > 0 ? configuredMaxRows : 1200;
const MAX_TEXT_LENGTH = 10000;
const URL_FIELDS = ['official_url', 'application_url'];
const TEXT_FIELDS = [
  'policy_name', 'category', 'agency', 'summary', 'content',
  'target_criteria', 'support_detail', 'ai_search_text',
  'application_method', 'application_period', 'region',
];

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const nullable = value => clean(value) || null;

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  // Government24 may return timestamps as YYYYMMDDHHmmss.
  const normalized = /^\d{14}$/.test(raw)
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}+09:00`
    : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`source_updated_at 형식이 올바르지 않습니다: ${value}`);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function validateUrl(value, field, index) {
  const normalized = nullable(value);
  if (!normalized) return null;
  let parsed;
  try { parsed = new URL(normalized); } catch { throw new Error(`${index + 1}번째 정책의 ${field} URL이 올바르지 않습니다.`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${index + 1}번째 정책의 ${field}는 http 또는 https URL이어야 합니다.`);
  }
  return parsed.toString();
}

function normalizePolicy(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${index + 1}번째 정책 데이터가 객체가 아닙니다.`);
  }
  const policy = {};
  for (const field of TEXT_FIELDS) {
    const value = clean(raw[field] ?? raw[camelCase(field)]);
    if (value.length > MAX_TEXT_LENGTH) throw new Error(`${index + 1}번째 정책의 ${field}가 너무 깁니다.`);
    policy[field] = value || null;
  }
  for (const field of URL_FIELDS) {
    policy[field] = validateUrl(raw[field] ?? raw[camelCase(field)], field, index);
  }
  policy.source_updated_at = parseDate(raw.source_updated_at ?? raw.sourceUpdatedAt);

  if (!policy.policy_name || !policy.summary || !policy.content || !policy.agency) {
    throw new Error(`${index + 1}번째 정책에는 policy_name, agency, summary, content가 모두 필요합니다.`);
  }
  policy.ai_search_text = policy.ai_search_text || [
    policy.policy_name, policy.category, policy.agency, policy.summary,
    policy.target_criteria, policy.support_detail, policy.application_method, policy.content,
    policy.application_period, policy.region,
  ].filter(Boolean).join(' ');
  return policy;
}

function camelCase(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function dedupePolicies(policies) {
  const seen = new Set();
  return policies.filter(policy => {
    const key = policyKey(policy);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function policyKey(policy) {
  return [policy.policy_name, policy.agency, policy.region || '']
    .map(value => String(value ?? '').replace(/\s+/g, '').toLowerCase())
    .join('|');
}

function policyNameKey(policy) {
  return String(policy.policy_name ?? '').replace(/\s+/g, '').toLowerCase();
}

function readInput(filePath) {
  const absolutePath = path.resolve(filePath);
  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const rows = Array.isArray(parsed) ? parsed : parsed?.policies;
  if (!Array.isArray(rows)) throw new Error('JSON은 배열 또는 { policies: [] } 형식이어야 합니다.');
  if (rows.length === 0) throw new Error('가져올 정책이 없습니다.');
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`한 번에 ${MAX_IMPORT_ROWS}개를 초과해 가져올 수 없습니다.`);
  return dedupePolicies(rows.map(normalizePolicy));
}

async function importPolicies(filePath) {
  const policies = readInput(filePath);
  const [columns] = await db.query('SHOW COLUMNS FROM POLICY');
  const fields = new Set(columns.map(row => row.Field));
  const supported = [
    ...TEXT_FIELDS,
    ...URL_FIELDS,
    'source_updated_at',
  ].filter(field => fields.has(field));
  const requiredColumns = ['policy_name', 'category', 'agency', 'summary', 'content', 'target_criteria', 'support_detail', 'ai_search_text'];
  for (const field of requiredColumns) {
    if (!fields.has(field)) throw new Error(`POLICY 테이블에 필수 컬럼이 없습니다: ${field}`);
  }

  const connection = await db.getConnection();
  let inserted = 0;
  let updated = 0;
  try {
    await connection.beginTransaction();
    // Load existing keys once. Per-row SELECTs made a large API sync needlessly slow on Aiven.
    const [existingRows] = await connection.query(
      `SELECT policy_id, policy_name, agency${fields.has('region') ? ', region' : ''} FROM POLICY`,
    );
    const existingByKey = new Map();
    const existingByName = new Map();
    for (const row of existingRows) {
      const key = policyKey({
        policy_name: row.policy_name,
        agency: row.agency,
        region: fields.has('region') ? row.region : '',
      });
      if (!existingByKey.has(key)) existingByKey.set(key, row.policy_id);
      const nameKey = policyNameKey(row);
      if (!existingByName.has(nameKey)) existingByName.set(nameKey, row.policy_id);
    }

    const inserts = [];
    const updates = [];
    for (const policy of policies) {
      const values = supported.map(field => policy[field]);
      const existingId = existingByKey.get(policyKey(policy)) || existingByName.get(policyNameKey(policy));
      if (existingId) updates.push({ values, id: existingId });
      else inserts.push(values);
    }

    // Insert in chunks to keep the SQL packet bounded even when policy text is large.
    const insertChunkSize = 100;
    const insertPlaceholders = supported.map(() => '?').join(', ');
    for (let index = 0; index < inserts.length; index += insertChunkSize) {
      const chunk = inserts.slice(index, index + insertChunkSize);
      const placeholders = chunk.map(() => `(${insertPlaceholders})`).join(', ');
      await connection.query(
        `INSERT INTO POLICY (${supported.join(', ')}) VALUES ${placeholders}`,
        chunk.flat(),
      );
      inserted += chunk.length;
    }

    for (const update of updates) {
      const assignments = supported.map(field => `${field} = COALESCE(NULLIF(?, ''), ${field})`).join(', ');
      await connection.query(`UPDATE POLICY SET ${assignments} WHERE policy_id = ?`, [...update.values, update.id]);
      updated += 1;
    }
    await connection.commit();
    return { total: policies.length, inserted, updated };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('사용법: node backend/scripts/importPolicies.js <policies.json>');
    process.exitCode = 1;
  } else {
    importPolicies(filePath)
      .then(result => console.log(`정책 가져오기 완료: ${JSON.stringify(result)}`))
      .catch(error => { console.error(`정책 가져오기 실패: ${error.message}`); process.exitCode = 1; })
      .finally(() => db.end());
  }
}

module.exports = { importPolicies, normalizePolicy, readInput, dedupePolicies };
