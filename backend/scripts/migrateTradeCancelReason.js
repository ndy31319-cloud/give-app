const db = require('../db');

async function migrate() {
  const [columns] = await db.query('SHOW COLUMNS FROM PICKUP_REQUEST');
  if (!columns.some(row => row.Field === 'cancel_reason')) {
    await db.query('ALTER TABLE PICKUP_REQUEST ADD COLUMN cancel_reason VARCHAR(200) NULL');
  }
  console.log('Trade cancellation reason migration complete; existing requests preserved.');
}

if (require.main === module) migrate().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.end());

module.exports = migrate;
