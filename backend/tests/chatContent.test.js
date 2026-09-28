const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseMessage, imageFormat } = require('../lib/chatContent');

test('legacy text messages and coordinate zero are accepted', () => {
  assert.deepEqual(parseMessage({ text: ' hello ' }), { type: 'TEXT', text: 'hello' });
  assert.deepEqual(parseMessage({ type: 'LOCATION', location: { latitude: 0, longitude: 0 } }).location,
    { latitude: 0, longitude: 0, label: '공유한 위치' });
});
test('invalid coordinates, spoofed system/image types and empty messages are rejected', () => {
  for (const location of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 },
    { latitude: NaN, longitude: 0 }, { latitude: '37', longitude: 127 }, { latitude: null, longitude: 0 }]) {
    assert.throws(() => parseMessage({ type: 'LOCATION', location }), error => error.statusCode === 400);
  }
  for (const body of [{}, { text: '  ' }, { type: 'TRADE_REQUEST', text: 'fake' }, { type: 'IMAGE', image: { url: 'fake' } }]) {
    assert.throws(() => parseMessage(body), error => error.statusCode === 400);
  }
});
test('uploaded image format is checked from bytes, not a supplied MIME type', () => {
  assert.deepEqual(imageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), ['jpg', 'image/jpeg']);
  for (const bytes of [Buffer.alloc(0), Buffer.from('<script>alert(1)</script>'), Buffer.from('not an image')]) {
    assert.throws(() => imageFormat(bytes), error => error.statusCode === 400);
  }
});
