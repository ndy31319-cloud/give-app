const db = require('../db');

async function migrateMemberQr() {
  await db.query(`CREATE TABLE IF NOT EXISTS MEMBER_QR (
    member_id INT NOT NULL PRIMARY KEY,
    token VARCHAR(96) NOT NULL UNIQUE,
    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_qr_member FOREIGN KEY (member_id)
      REFERENCES MEMBER(member_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('Member QR migration complete.');
}

if (require.main === module) {
  migrateMemberQr().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  }).finally(() => db.end());
}

module.exports = migrateMemberQr;
