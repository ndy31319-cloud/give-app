const db = require('../db');
async function migrate() {
  const [columns] = await db.query('SHOW COLUMNS FROM PICKUP_REQUEST');
  if (!columns.some(row => row.Field === 'appointment')) await db.query('ALTER TABLE PICKUP_REQUEST ADD COLUMN appointment JSON NULL');
  console.log('Appointment migration complete; existing requests preserved.');
}
if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
module.exports = migrate;
