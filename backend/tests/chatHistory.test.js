const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHandler(query) {
  const routes = [];
  const auth = () => {};
  const router = { get() {}, post() {}, delete: (...args) => routes.push(args) };
  const dependencies = { axios: {}, express: { Router: () => router }, '../middlewares/authMiddleware': auth, '../db': { query } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/policies.js'), 'utf8'), {
    require: name => { assert.ok(name in dependencies, name); return dependencies[name]; },
    module: { exports: {} }, process: { env: {} }, console: { error() {} },
  });
  const route = routes.find(([url]) => url === '/chatbot/history');
  assert.equal(route[1], auth, 'deletion must require authentication');
  return route[2];
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('history deletion uses the authenticated owner and ignores a supplied member id', async () => {
  const handler = loadHandler(async (sql, values) => {
    assert.equal(sql, 'DELETE FROM AI_CHAT_HISTORY WHERE member_id = ?');
    assert.equal(values.length, 1);
    assert.equal(values[0], 14);
  });
  const res = response();
  await handler({ user: { member_id: 14 }, body: { member_id: 99 } }, res);
  assert.equal(res.body.success, true);
});

test('missing owner cannot delete any history', async () => {
  const handler = loadHandler(async () => assert.fail('must not query'));
  const res = response();
  await handler({ user: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('database failures never report deletion success', async () => {
  const handler = loadHandler(async () => { throw new Error('offline'); });
  const res = response();
  await handler({ user: { member_id: 14 } }, res);
  assert.equal(res.statusCode, 500);
  assert.notEqual(res.body.success, true);
});
