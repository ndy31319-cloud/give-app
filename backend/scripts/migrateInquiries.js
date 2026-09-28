const db = require('../db');
async function migrate() {
  const [columns] = await db.query('SHOW COLUMNS FROM ADMIN_INQUIRY');
  const fields = new Set(columns.map(row => row.Field));
  for (const [name, definition] of Object.entries({ category: "VARCHAR(20) NOT NULL DEFAULT 'other'", answer: 'TEXT NULL', answered_by: 'INT NULL', answered_at: 'DATETIME NULL', request_key: 'VARCHAR(100) NULL' })) {
    if (!fields.has(name)) await db.query(`ALTER TABLE ADMIN_INQUIRY ADD COLUMN ${name} ${definition}`);
  }
  const [indexes] = await db.query('SHOW INDEX FROM ADMIN_INQUIRY');
  if (!indexes.some(row => row.Key_name === 'uq_inquiry_request')) await db.query('CREATE UNIQUE INDEX uq_inquiry_request ON ADMIN_INQUIRY (member_id, request_key)');
  const [[table]] = await db.query('SHOW CREATE TABLE NOTIFICATION');
  if (!table['Create Table'].includes("'inquiry'")) await db.query(`ALTER TABLE NOTIFICATION DROP CHECK chk_notification_related_type,
    ADD CONSTRAINT chk_notification_related_type CHECK (related_type IN ('donate','request','pickup','inquiry'))`);
  console.log('Inquiry migration complete; existing inquiries preserved.');
}
if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
module.exports = migrate;
