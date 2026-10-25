// Additive migration for policy freshness and official application links.
// Existing policy rows are preserved; the chatbot treats these fields as optional.
const db = require('../db');

async function migrate() {
  const [columns] = await db.query('SHOW COLUMNS FROM POLICY');
  const fields = new Set(columns.map(row => row.Field));
  const additions = {
    official_url: 'VARCHAR(1000) NULL',
    application_url: 'VARCHAR(1000) NULL',
    application_period: 'VARCHAR(255) NULL',
    region: 'VARCHAR(120) NULL',
    source_updated_at: 'DATETIME NULL',
  };

  for (const [name, definition] of Object.entries(additions)) {
    if (!fields.has(name)) {
      await db.query(`ALTER TABLE POLICY ADD COLUMN ${name} ${definition}`);
    }
  }

  // Government24 eligibility descriptions can exceed the original 255-byte limit.
  if (fields.has('target_criteria')) {
    await db.query('ALTER TABLE POLICY MODIFY COLUMN target_criteria TEXT NULL');
  }

  const [indexes] = await db.query('SHOW INDEX FROM POLICY');
  if (!indexes.some(row => row.Key_name === 'idx_policy_category_region')) {
    await db.query('CREATE INDEX idx_policy_category_region ON POLICY (category, region)');
  }
  console.log('Policy metadata migration complete. Existing policy rows were preserved.');
}

if (require.main === module) {
  migrate()
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => db.end());
}

module.exports = migrate;
