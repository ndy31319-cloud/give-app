const db = require('../db');

async function migrateLockerTransfers() {
  await db.query(`CREATE TABLE IF NOT EXISTS LOCKER_SLOT (
    slot_id TINYINT NOT NULL PRIMARY KEY,
    transfer_id BIGINT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query('INSERT IGNORE INTO LOCKER_SLOT (slot_id, transfer_id) VALUES (1, NULL)');
  await db.query(`CREATE TABLE IF NOT EXISTS LOCKER_TRANSFER (
    transfer_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    pickup_id INT NOT NULL UNIQUE,
    donate_id INT NOT NULL,
    donor_id INT NOT NULL,
    recipient_id INT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'awaiting_deposit',
    deposit_scanned_at DATETIME NULL,
    stored_at DATETIME NULL,
    pickup_scanned_at DATETIME NULL,
    picked_up_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_locker_donor_status (donor_id, status),
    INDEX idx_locker_recipient_status (recipient_id, status),
    CONSTRAINT fk_locker_transfer_pickup FOREIGN KEY (pickup_id)
      REFERENCES PICKUP_REQUEST(pickup_id) ON DELETE CASCADE,
    CONSTRAINT fk_locker_transfer_donor FOREIGN KEY (donor_id)
      REFERENCES MEMBER(member_id),
    CONSTRAINT fk_locker_transfer_recipient FOREIGN KEY (recipient_id)
      REFERENCES MEMBER(member_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS LOCKER_DEVICE_STATUS (
    device_id VARCHAR(80) NOT NULL PRIMARY KEY,
    state VARCHAR(40) NOT NULL,
    locker_open BOOLEAN NOT NULL DEFAULT FALSE,
    item_detected BOOLEAN NOT NULL DEFAULT FALSE,
    message VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('Locker transfer migration complete.');
}

if (require.main === module) {
  migrateLockerTransfers().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  }).finally(() => db.end());
}

module.exports = migrateLockerTransfers;
