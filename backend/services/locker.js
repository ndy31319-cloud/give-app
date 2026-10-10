const db = require('../db');
const { isMemberQrToken } = require('./memberQr');

const ACTIVE_STATUSES = ['awaiting_deposit', 'stored'];
const SCAN_WINDOW_SECONDS = 600;

function fail(statusCode, message, errorCode) {
  throw Object.assign(new Error(message), { statusCode, errorCode });
}

async function transaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const transferDetailsSql = `SELECT t.transfer_id, t.pickup_id, t.donate_id,
  t.donor_id, t.recipient_id, t.status, t.deposit_scanned_at,
  t.stored_at, t.pickup_scanned_at, t.picked_up_at,
  d.title, d.status AS post_status, p.request_status,
  recipient.nickname AS recipient_nickname,
  donor.nickname AS donor_nickname, items.item_names
  FROM LOCKER_TRANSFER t
  JOIN ITEM_DONATE d ON d.donate_id = t.donate_id
  JOIN PICKUP_REQUEST p ON p.pickup_id = t.pickup_id
  JOIN MEMBER recipient ON recipient.member_id = t.recipient_id
  JOIN MEMBER donor ON donor.member_id = t.donor_id
  LEFT JOIN (
    SELECT donate_id, GROUP_CONCAT(item_name ORDER BY item_id SEPARATOR ', ') AS item_names
    FROM ITEM WHERE donate_id IS NOT NULL GROUP BY donate_id
  ) items ON items.donate_id = t.donate_id`;

function mapTransfer(row) {
  return {
    transferId: Number(row.transfer_id),
    pickupId: Number(row.pickup_id),
    donateId: Number(row.donate_id),
    donorId: Number(row.donor_id),
    recipientId: Number(row.recipient_id),
    title: row.title,
    items: row.item_names || row.title,
    recipientNickname: row.recipient_nickname,
    donorNickname: row.donor_nickname,
    status: row.status,
    storedAt: row.stored_at,
    pickedUpAt: row.picked_up_at,
  };
}

async function details(database, transferId) {
  const [rows] = await database.query(
    `${transferDetailsSql} WHERE t.transfer_id = ? LIMIT 1`, [transferId],
  );
  if (!rows[0]) fail(404, '보관함 거래를 찾을 수 없습니다.');
  return rows[0];
}

async function notify(connection, memberId, pickupId, type, message) {
  await connection.query(`INSERT INTO NOTIFICATION
    (member_id, related_type, related_id, notification_type, message, is_read, created_at)
    VALUES (?, 'pickup', ?, ?, ?, FALSE, NOW())`,
  [memberId, pickupId, type, message]);
}

async function eligible(memberId) {
  const [rows] = await db.query(`SELECT p.pickup_id, p.chat_room_id,
      d.donate_id, d.title, recipient.nickname AS recipient_nickname,
      items.item_names
    FROM PICKUP_REQUEST p
    JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
    JOIN MEMBER recipient ON recipient.member_id = p.requester_id
    LEFT JOIN LOCKER_TRANSFER t ON t.pickup_id = p.pickup_id
    LEFT JOIN (
      SELECT donate_id, GROUP_CONCAT(item_name ORDER BY item_id SEPARATOR ', ') AS item_names
      FROM ITEM WHERE donate_id IS NOT NULL GROUP BY donate_id
    ) items ON items.donate_id = d.donate_id
    WHERE d.member_id = ? AND p.request_status = 'approved'
      AND d.status = 'reserved' AND p.chat_room_id IS NOT NULL
      AND t.transfer_id IS NULL
    ORDER BY p.approved_at DESC, p.pickup_id DESC`, [memberId]);
  return rows.map((row) => ({
    pickupId: Number(row.pickup_id),
    donateId: Number(row.donate_id),
    roomId: row.chat_room_id,
    title: row.title,
    items: row.item_names || row.title,
    recipientNickname: row.recipient_nickname,
  }));
}

async function select(memberId, pickupId) {
  if (!/^\d+$/.test(String(pickupId))) fail(400, '올바른 거래를 선택해주세요.');
  return transaction(async (connection) => {
    const [baseRows] = await connection.query(
      `SELECT p.donate_id, p.requester_id FROM PICKUP_REQUEST p
       WHERE p.pickup_id = ?`, [pickupId],
    );
    if (!baseRows[0]) fail(404, '나눔 거래를 찾을 수 없습니다.');
    const base = baseRows[0];

    // Match the lock order used by trade status changes: donation, request, transfer.
    const [[donation]] = await connection.query(
      'SELECT * FROM ITEM_DONATE WHERE donate_id = ? FOR UPDATE', [base.donate_id],
    );
    const [[request]] = await connection.query(
      'SELECT * FROM PICKUP_REQUEST WHERE pickup_id = ? FOR UPDATE', [pickupId],
    );
    if (!donation || !request || Number(request.donate_id) !== Number(donation.donate_id)) {
      fail(409, '나눔 거래 정보가 변경됐습니다.');
    }
    if (Number(donation.member_id) !== Number(memberId)) fail(403, '나눔자만 보관함을 선택할 수 있습니다.');
    if (request.request_status !== 'approved' || donation.status !== 'reserved' || !request.chat_room_id) {
      fail(409, '수락된 나눔 거래만 보관함을 이용할 수 있습니다.');
    }

    const ids = [Number(memberId), Number(request.requester_id)].sort((a, b) => a - b);
    await connection.query('SELECT member_id FROM MEMBER WHERE member_id IN (?) FOR UPDATE', [ids]);
    const [qrRows] = await connection.query('SELECT member_id FROM MEMBER_QR WHERE member_id = ?', [memberId]);
    if (!qrRows.length) fail(409, '나눔자의 회원 QR이 발급되지 않았습니다.');

    const [existing] = await connection.query(
      'SELECT transfer_id, status FROM LOCKER_TRANSFER WHERE pickup_id = ? FOR UPDATE',
      [pickupId],
    );
    if (existing.length) {
      if (ACTIVE_STATUSES.includes(existing[0].status)) {
        return mapTransfer(await details(connection, existing[0].transfer_id));
      }
      fail(409, '이미 종료된 보관함 거래입니다.');
    }
    const [[slot]] = await connection.query(
      'SELECT transfer_id FROM LOCKER_SLOT WHERE slot_id = 1 FOR UPDATE',
    );
    if (!slot || slot.transfer_id !== null) {
      fail(409, '현재 보관함을 사용 중입니다. 이용이 끝나면 다시 선택해주세요.');
    }
    const [active] = await connection.query(
      `SELECT transfer_id FROM LOCKER_TRANSFER
       WHERE status IN ('awaiting_deposit', 'stored')
         AND (donor_id IN (?) OR recipient_id IN (?)) LIMIT 1`, [ids, ids],
    );
    if (active.length) fail(409, '진행 중인 보관함 거래가 있어 새 거래를 선택할 수 없습니다.');

    const [result] = await connection.query(
      `INSERT INTO LOCKER_TRANSFER
       (pickup_id, donate_id, donor_id, recipient_id, status)
       VALUES (?, ?, ?, ?, 'awaiting_deposit')`,
      [pickupId, donation.donate_id, memberId, request.requester_id],
    );
    await connection.query('UPDATE LOCKER_SLOT SET transfer_id = ? WHERE slot_id = 1', [result.insertId]);
    await notify(connection, request.requester_id, pickupId, 'request',
      `‘${donation.title}’ 나눔을 보관함에서 진행하기로 했어요. 물품이 준비되면 알려드릴게요.`);
    return mapTransfer(await details(connection, result.insertId));
  });
}

async function memberAccess(memberId) {
  const [rows] = await db.query(`${transferDetailsSql}
    WHERE (t.donor_id = ? OR t.recipient_id = ?)
      AND t.status IN ('awaiting_deposit', 'stored')
    ORDER BY t.created_at DESC LIMIT 1`, [memberId, memberId]);
  if (!rows.length) return { enabled: false, role: null, transfer: null };
  const row = rows[0];
  const role = Number(row.donor_id) === Number(memberId) ? 'donor' : 'recipient';
  const enabled = row.request_status === 'approved' && row.post_status === 'reserved' &&
    ((role === 'donor' && row.status === 'awaiting_deposit') ||
     (role === 'recipient' && row.status === 'stored'));
  return { enabled, role, transfer: mapTransfer(row) };
}

async function resolveMember(token, action) {
  if (token.startsWith('give-member-v1:')) {
    if (!isMemberQrToken(token)) fail(400, '유효하지 않은 QR코드입니다.', 'QR_INVALID');
    const [rows] = await db.query('SELECT member_id FROM MEMBER_QR WHERE token = ? LIMIT 1', [token]);
    if (!rows.length) fail(404, '등록되지 않은 회원 QR입니다.', 'QR_UNREGISTERED');
    return Number(rows[0].member_id);
  }
  if (action === 'pickup' && /^WF-\d{4}-\d{4}$/i.test(token)) {
    const [rows] = await db.query(`SELECT m.member_id
      FROM VULNERABLE_CERTIFICATE c
      JOIN MEMBER m ON m.email = CONCAT('kiosk_certificate_', c.certificate_id, '@give.local')
        OR (m.name = c.name AND c.phone IS NOT NULL
          AND REPLACE(REPLACE(REPLACE(m.phone, '-', ''), ' ', ''), '.', '') =
              REPLACE(REPLACE(REPLACE(c.phone, '-', ''), ' ', ''), '.', ''))
      WHERE c.certificate_no = ? AND c.status = 'active'
        AND (c.expires_at IS NULL OR c.expires_at >= CURDATE())
        AND m.role_id = 3 LIMIT 2`, [token.toUpperCase()]);
    if (rows.length !== 1) fail(404, '유효한 수혜자 회원코드를 확인하지 못했습니다.');
    return Number(rows[0].member_id);
  }
  fail(400, '이 보관함에서 사용할 수 없는 QR 또는 회원코드입니다.', 'QR_INVALID');
}

async function lockTransfer(connection, transferId) {
  const [[base]] = await connection.query(
    'SELECT donate_id, pickup_id FROM LOCKER_TRANSFER WHERE transfer_id = ?', [transferId],
  );
  if (!base) fail(404, '보관함 거래를 찾을 수 없습니다.');
  const [[donation]] = await connection.query(
    'SELECT * FROM ITEM_DONATE WHERE donate_id = ? FOR UPDATE', [base.donate_id],
  );
  const [[request]] = await connection.query(
    'SELECT * FROM PICKUP_REQUEST WHERE pickup_id = ? FOR UPDATE', [base.pickup_id],
  );
  const [[transfer]] = await connection.query(
    'SELECT * FROM LOCKER_TRANSFER WHERE transfer_id = ? FOR UPDATE', [transferId],
  );
  const [[slot]] = await connection.query(
    'SELECT transfer_id FROM LOCKER_SLOT WHERE slot_id = 1 FOR UPDATE',
  );
  if (!donation || !request || !transfer ||
      Number(request.donate_id) !== Number(donation.donate_id) ||
      Number(transfer.pickup_id) !== Number(request.pickup_id)) {
    fail(409, '보관함 거래 정보가 변경됐습니다.');
  }
  if (['awaiting_deposit', 'stored'].includes(transfer.status) &&
      Number(slot?.transfer_id) !== Number(transferId)) {
    fail(409, '보관함 점유 상태를 확인하지 못했습니다.');
  }
  return { donation, request, transfer };
}

async function scan(token, action) {
  if (!['deposit', 'pickup'].includes(action)) fail(400, '올바른 보관함 작업을 선택해주세요.');
  const memberId = await resolveMember(String(token || '').trim(), action);
  const column = action === 'deposit' ? 'donor_id' : 'recipient_id';
  const status = action === 'deposit' ? 'awaiting_deposit' : 'stored';
  const [rows] = await db.query(
    `SELECT transfer_id FROM LOCKER_TRANSFER WHERE ${column} = ? AND status = ?`,
    [memberId, status],
  );
  if (rows.length !== 1) fail(409, action === 'deposit'
    ? '현재 보관함에 넣을 수 있는 나눔이 없습니다.'
    : '아직 보관함에 준비된 물품이 없습니다.',
  action === 'deposit' ? 'DEPOSIT_NOT_ALLOWED' : 'ITEM_NOT_READY');

  return transaction(async (connection) => {
    const { donation, request, transfer } = await lockTransfer(connection, rows[0].transfer_id);
    if (transfer.status !== status || Number(transfer[column]) !== memberId ||
        request.request_status !== 'approved' || donation.status !== 'reserved') {
      fail(409, '보관함 이용 상태가 변경됐습니다. 다시 확인해주세요.', 'TRADE_STATE_CHANGED');
    }
    const scanColumn = action === 'deposit' ? 'deposit_scanned_at' : 'pickup_scanned_at';
    await connection.query(
      `UPDATE LOCKER_TRANSFER SET ${scanColumn} = NOW() WHERE transfer_id = ?`,
      [transfer.transfer_id],
    );
    return { ...mapTransfer(await details(connection, transfer.transfer_id)), action };
  });
}

async function confirm(transferId, action) {
  if (!/^\d+$/.test(String(transferId)) || !['deposit', 'pickup'].includes(action)) {
    fail(400, '올바른 보관함 완료 요청이 아닙니다.');
  }
  return transaction(async (connection) => {
    const { donation, request, transfer } = await lockTransfer(connection, transferId);
    const isDeposit = action === 'deposit';
    const expectedStatus = isDeposit ? 'awaiting_deposit' : 'stored';
    const scanColumn = isDeposit ? 'deposit_scanned_at' : 'pickup_scanned_at';
    if (transfer.status !== expectedStatus || request.request_status !== 'approved' ||
        donation.status !== 'reserved') {
      fail(409, '이미 처리됐거나 취소된 보관함 거래입니다.');
    }
    const [[clock]] = await connection.query(
      `SELECT TIMESTAMPDIFF(SECOND, ${scanColumn}, NOW()) AS elapsed
       FROM LOCKER_TRANSFER WHERE transfer_id = ?`, [transferId],
    );
    if (clock.elapsed === null || clock.elapsed < 0 ||
        clock.elapsed > SCAN_WINDOW_SECONDS) {
      fail(409, 'QR 인식 시간이 지났습니다. 다시 인식해주세요.', 'QR_SCAN_EXPIRED');
    }
    if (isDeposit) {
      await connection.query(`UPDATE LOCKER_TRANSFER
        SET status = 'stored', stored_at = NOW(), deposit_scanned_at = NULL
        WHERE transfer_id = ?`, [transferId]);
      await notify(connection, transfer.recipient_id, transfer.pickup_id, 'request',
        `‘${donation.title}’ 물품이 보관함에 준비됐어요. 회원 QR 또는 회원코드로 찾아가세요.`);
    } else {
      await connection.query(`UPDATE LOCKER_TRANSFER
        SET status = 'completed', picked_up_at = NOW(), pickup_scanned_at = NULL
        WHERE transfer_id = ?`, [transferId]);
      await connection.query(`UPDATE PICKUP_REQUEST
        SET request_status = 'completed', pickup_at = NOW(), resolved_at = NOW(), chat_synced = FALSE
        WHERE pickup_id = ?`, [transfer.pickup_id]);
      await connection.query(`UPDATE ITEM_DONATE SET status = 'completed', updated_at = NOW()
        WHERE donate_id = ?`, [transfer.donate_id]);
      await connection.query('UPDATE LOCKER_SLOT SET transfer_id = NULL WHERE slot_id = 1 AND transfer_id = ?',
        [transferId]);
      await notify(connection, transfer.donor_id, transfer.pickup_id, 'pickup_completed',
        `‘${donation.title}’ 물품을 받는 분이 찾아가셨어요.`);
    }
    return mapTransfer(await details(connection, transferId));
  });
}

async function confirmByToken(token, action) {
  const memberId = await resolveMember(String(token || '').trim(), action);
  const column = action === 'deposit' ? 'donor_id' : 'recipient_id';
  const expected = action === 'deposit' ? 'awaiting_deposit' : 'stored';
  const [rows] = await db.query(
    `SELECT transfer_id FROM LOCKER_TRANSFER WHERE ${column} = ? AND status = ? LIMIT 2`,
    [memberId, expected],
  );
  if (rows.length !== 1) fail(409, '진행 중인 보관함 거래를 확인하지 못했습니다.');
  return confirm(rows[0].transfer_id, action);
}

async function recordDeviceStatus(input) {
  const deviceId = String(input.deviceId || '').trim();
  const state = String(input.state || '').trim();
  if (!/^[\w-]{1,80}$/.test(deviceId) || !/^[\w-]{1,40}$/.test(state)) {
    fail(400, '올바른 기기 상태가 아닙니다.');
  }
  await db.query(`INSERT INTO LOCKER_DEVICE_STATUS
    (device_id, state, locker_open, item_detected, message)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE state = VALUES(state), locker_open = VALUES(locker_open),
      item_detected = VALUES(item_detected), message = VALUES(message), updated_at = NOW()`,
  [deviceId, state, Boolean(input.lockerOpen), Boolean(input.itemDetected),
    String(input.message || '').slice(0, 255)]);
  return { deviceId, state };
}

async function status(transferId) {
  if (!/^\d+$/.test(String(transferId))) fail(400, '올바른 보관함 거래 번호가 아닙니다.');
  return mapTransfer(await details(db, transferId));
}

module.exports = { eligible, select, memberAccess, scan, confirm, confirmByToken,
  recordDeviceStatus, status, fail };
