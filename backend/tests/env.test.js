const assert = require("node:assert/strict");
const test = require("node:test");

const {
  matchesApiKey,
  normalizeMultilineSecret,
  normalizeScalar,
  isProductionRuntime,
  splitEnvList,
} = require("../lib/env");

test("normalizes quoted and Markdown-style scalar values", () => {
  assert.equal(normalizeScalar(' "https://example.com/docs" '), "https://example.com/docs");
  assert.equal(
    normalizeScalar("[https://example.com](https://example.com)"),
    "https://example.com",
  );
});

test("normalizes comma-separated CORS values", () => {
  assert.deepEqual(
    splitEnvList('"[https://one.example.com], https://two.example.com"'),
    ["https://one.example.com", "https://two.example.com"],
  );
});

test("converts escaped newlines in Render secrets", () => {
  assert.equal(
    normalizeMultilineSecret('"-----BEGIN TEST-----\\nvalue\\n-----END TEST-----"'),
    "-----BEGIN TEST-----\nvalue\n-----END TEST-----",
  );
});

test("compares API keys without exposing their values", () => {
  assert.equal(matchesApiKey(" kiosk-key ", "kiosk-key"), true);
  assert.equal(matchesApiKey("kiosk-key", "different-key"), false);
  assert.equal(matchesApiKey("", ""), false);
});

test("detects hosted production runtime without requiring Render-only values locally", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    render: process.env.RENDER,
    serviceId: process.env.RENDER_SERVICE_ID,
    externalUrl: process.env.RENDER_EXTERNAL_URL,
  };

  process.env.NODE_ENV = "production";
  delete process.env.RENDER;
  delete process.env.RENDER_SERVICE_ID;
  delete process.env.RENDER_EXTERNAL_URL;
  assert.equal(isProductionRuntime(), true);

  process.env.NODE_ENV = "development";
  process.env.RENDER_SERVICE_ID = "srv-test";
  assert.equal(isProductionRuntime(), true);

  if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previous.nodeEnv;
  if (previous.render === undefined) delete process.env.RENDER;
  else process.env.RENDER = previous.render;
  if (previous.serviceId === undefined) delete process.env.RENDER_SERVICE_ID;
  else process.env.RENDER_SERVICE_ID = previous.serviceId;
  if (previous.externalUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
  else process.env.RENDER_EXTERNAL_URL = previous.externalUrl;
});
