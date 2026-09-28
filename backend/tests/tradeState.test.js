const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextStatus } = require('../lib/tradeState');
const trade = { donor_id: 1, requester_id: 2, request_status: 'pending' };

test('only donor can accept, reject or complete', () => {
  for (const action of ['approve', 'reject', 'complete']) {
    assert.throws(() => nextStatus(trade, action, 2), error => error.statusCode === 403);
  }
  assert.equal(nextStatus(trade, 'approve', 1), 'approved');
});
test('outsiders cannot act even with a valid request ID', () => {
  for (const action of ['approve', 'reject', 'cancel', 'complete']) {
    assert.throws(() => nextStatus(trade, action, 3), error => error.statusCode === 403);
  }
});
test('pending cannot complete; terminal and expired requests cannot be revived', () => {
  assert.throws(() => nextStatus(trade, 'complete', 1), error => error.statusCode === 409);
  for (const state of ['canceled', 'rejected', 'expired', 'completed']) {
    for (const action of ['approve', 'reject', 'cancel', 'complete']) {
      const target = { approve: 'approved', reject: 'rejected', cancel: 'canceled', complete: 'completed' }[action];
      if (target === state) continue;
      assert.throws(() => nextStatus({ ...trade, request_status: state }, action, 1), error => error.statusCode === 409);
    }
  }
});
test('duplicate actions are idempotent; either participant may cancel', () => {
  assert.equal(nextStatus({ ...trade, request_status: 'approved' }, 'approve', 1), 'approved');
  assert.equal(nextStatus({ ...trade, request_status: 'completed' }, 'complete', 1), 'completed');
  for (const status of ['pending', 'approved']) for (const member of [1, 2]) {
    assert.equal(nextStatus({ ...trade, request_status: status }, 'cancel', member), 'canceled');
  }
});
