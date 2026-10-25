const DONATION_OFFER_PICKUP_MEMO_PREFIX = "요청글 나눔 의사 자동 연결";

const buildDonationOfferPickupMemo = (requestId) =>
  `${DONATION_OFFER_PICKUP_MEMO_PREFIX} #${requestId}`;

// A request post and the donation post created from its "나눔 의사" action
// are separate records. Keep the original request from remaining active after
// the linked donation has actually been picked up.
async function syncLinkedRequestStatus(connection, donateId) {
  await connection.query(
    `UPDATE ITEM_REQUEST r
     INNER JOIN PICKUP_REQUEST p
       ON p.donate_id = ?
      AND p.memo LIKE CONCAT(?, ' #%')
      AND CAST(SUBSTRING_INDEX(p.memo, '#', -1) AS UNSIGNED) = r.request_id
     SET r.status = 'completed', r.updated_at = NOW()
     WHERE p.request_status IN ('completed', 'picked_up')`,
    [donateId, DONATION_OFFER_PICKUP_MEMO_PREFIX],
  );
}

async function getCompletedLinkedRequestIds(database) {
  const [rows] = await database.query(
    `SELECT DISTINCT r.request_id
     FROM ITEM_REQUEST r
     INNER JOIN PICKUP_REQUEST p
       ON p.memo LIKE CONCAT(?, ' #%')
      AND CAST(SUBSTRING_INDEX(p.memo, '#', -1) AS UNSIGNED) = r.request_id
     INNER JOIN ITEM_DONATE d ON d.donate_id = p.donate_id
     WHERE d.status = 'completed'
        OR p.request_status IN ('completed', 'picked_up')`,
    [DONATION_OFFER_PICKUP_MEMO_PREFIX],
  );

  return new Set(rows.map((row) => Number(row.request_id)).filter(Number.isInteger));
}

module.exports = {
  DONATION_OFFER_PICKUP_MEMO_PREFIX,
  buildDonationOfferPickupMemo,
  getCompletedLinkedRequestIds,
  syncLinkedRequestStatus,
};
