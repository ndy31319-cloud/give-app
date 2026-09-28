// Additive migration: old pickup requests retain NULL room/expiry fields.
const db = require('../db');

async function migrate() {
  const [columns] = await db.query('SHOW COLUMNS FROM PICKUP_REQUEST');
  const fields = new Set(columns.map(row => row.Field));
  const additions = {
    chat_room_id: 'VARCHAR(120) NULL',
    expires_at: 'DATETIME NULL',
    resolved_at: 'DATETIME NULL',
    chat_synced: 'BOOLEAN NOT NULL DEFAULT TRUE',
  };
  for (const [name, definition] of Object.entries(additions)) {
    if (!fields.has(name)) await db.query(`ALTER TABLE PICKUP_REQUEST ADD COLUMN ${name} ${definition}`);
  }
  const [[table]] = await db.query('SHOW CREATE TABLE PICKUP_REQUEST');
  const ddl = table['Create Table'];
  if (ddl.includes('chk_pickup_request_status') && !ddl.includes("'expired'")) {
    await db.query(`ALTER TABLE PICKUP_REQUEST DROP CHECK chk_pickup_request_status,
      ADD CONSTRAINT chk_pickup_request_status CHECK
      (request_status IN ('pending', 'approved', 'rejected', 'picked_up', 'canceled', 'expired', 'completed'))`);
  }
  const [indexes] = await db.query('SHOW INDEX FROM PICKUP_REQUEST');
  if (!indexes.some(row => row.Key_name === 'idx_pickup_trade_expiry')) {
    await db.query('CREATE INDEX idx_pickup_trade_expiry ON PICKUP_REQUEST (request_status, expires_at)');
  }
  if (!indexes.some(row => row.Key_name === 'idx_pickup_trade_active')) {
    await db.query('CREATE INDEX idx_pickup_trade_active ON PICKUP_REQUEST (donate_id, request_status)');
  }
  console.log('Trade request migration complete. Existing requests were preserved.');
}

if (require.main === module) {
  migrate().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
}
module.exports = migrate;
