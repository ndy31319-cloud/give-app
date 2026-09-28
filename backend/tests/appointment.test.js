const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readAppointment, transition } = require('../lib/appointment');
const input = () => ({ revision: 0, at: new Date(Date.now() + 86400000).toISOString(), place: '학교 정문', latitude: 37.5, longitude: 127 });
test('proposal requires valid future time, nonempty place, paired coordinates and exact revision', () => {
  const empty = readAppointment(null);
  for (const patch of [{ at: 'bad' }, { at: '2026-02-30T12:00:00Z' }, { at: new Date(0).toISOString() }, { place: ' ' }, { place: '가'.repeat(201) }, { latitude: 91 }, { longitude: null }, { revision: 1 }, { revision: '0' }]) {
    assert.throws(() => transition(empty, 'propose', { ...input(), ...patch }, 1));
  }
  assert.equal(transition(empty, 'propose', { ...input(), latitude: null, longitude: null }, 1).pending.latitude, null);
});
test('only other party confirms latest proposal and existing confirmation survives edits', () => {
  const pending = transition(readAppointment(null), 'propose', input(), 1);
  assert.throws(() => transition(pending, 'confirm', { revision: 1 }, 1), error => error.statusCode === 403);
  const confirmed = transition(pending, 'confirm', { revision: 1 }, 2);
  const changed = transition(confirmed, 'propose', { ...input(), revision: 2, place: '도서관' }, 2);
  assert.deepEqual(changed.confirmed, confirmed.confirmed);
  assert.equal(changed.pending.place, '도서관');
  assert.throws(() => transition(changed, 'confirm', { revision: 1 }, 1), error => error.statusCode === 409);
  const final = transition(changed, 'confirm', { revision: 3 }, 1);
  assert.equal(final.confirmed.place, '도서관'); assert.equal(final.pending, null);
  const overdue = { ...changed, pending: { ...changed.pending, at: new Date(0).toISOString() } };
  assert.throws(() => transition(overdue, 'confirm', { revision: 3 }, 1), error => error.statusCode === 409);
});
