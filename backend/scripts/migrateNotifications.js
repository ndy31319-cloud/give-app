const db = require('../db');
async function migrate() {
  const [[row]] = await db.query('SHOW CREATE TABLE NOTIFICATION');
  if (row['Create Table'].includes('chk_notification_type') && !row['Create Table'].includes("'pickup_expired'")) {
    await db.query(`ALTER TABLE NOTIFICATION DROP CHECK chk_notification_type,
      ADD CONSTRAINT chk_notification_type CHECK (notification_type IN
      ('chat','request','pickup_request','pickup_approved','pickup_completed','admin','pickup_rejected','pickup_canceled','pickup_expired'))`);
  }
  console.log('Notification types migrated; existing notifications preserved.');
}
if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
module.exports = migrate;
