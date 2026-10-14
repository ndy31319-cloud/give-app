const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_LOCAL_AI_SERVER_URL,
  resolveAiEndpointUrls,
  stripKnownAiSuffix,
} = require("../lib/aiServerUrls");

const AI_ENV_KEYS = [
  "AI_CHATBOT_URL",
  "AI_SERVER_ALLOW_LOOPBACK_IN_PRODUCTION",
  "AI_SERVER_DISABLE_LOCAL_DEFAULT",
  "AI_SERVER_URL",
  "AI_SERVER_URL_FALLBACK",
  "AI_SERVER_URL_LOCAL",
  "AI_SERVER_URL_PRIMARY",
  "LOCAL_AI_SERVER_URL",
  "NODE_ENV",
  "RENDER",
  "RENDER_EXTERNAL_URL",
  "RENDER_SERVICE_ID",
];

function withEnv(values, callback) {
  const previous = Object.fromEntries(
    AI_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  for (const key of AI_ENV_KEYS) {
    delete process.env[key];
  }

  Object.assign(process.env, values);

  try {
    callback();
  } finally {
    for (const key of AI_ENV_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

test("local development defaults to the local AI server", () => {
  withEnv({ NODE_ENV: "development" }, () => {
    assert.deepEqual(resolveAiEndpointUrls({ endpointPath: "/api/chat/" }), [
      `${DEFAULT_LOCAL_AI_SERVER_URL}/api/chat/`,
    ]);
  });
});

test("known AI endpoint suffixes are normalized before appending a different endpoint", () => {
  withEnv(
    {
      AI_SERVER_URL:
        "https://example-ai.ngrok-free.app/api/chat/, https://example-ai.ngrok-free.app/docs",
    },
    () => {
      assert.equal(
        stripKnownAiSuffix("https://example-ai.ngrok-free.app/api/chat/"),
        "https://example-ai.ngrok-free.app",
      );
      assert.deepEqual(
        resolveAiEndpointUrls({ endpointPath: "/api/post/generate-post" }),
        ["https://example-ai.ngrok-free.app/api/post/generate-post"],
      );
    },
  );
});

test("explicit chatbot URL keeps the chat endpoint shape", () => {
  withEnv({ AI_CHATBOT_URL: "https://example-ai.ngrok-free.app/api/chat/" }, () => {
    assert.deepEqual(
      resolveAiEndpointUrls({
        endpointPath: "/api/chat/",
        explicitUrls: [process.env.AI_CHATBOT_URL],
      }),
      ["https://example-ai.ngrok-free.app/api/chat/"],
    );
  });
});

test("hosted runtimes ignore loopback AI URLs and use public tunnel fallbacks", () => {
  withEnv(
    {
      RENDER_SERVICE_ID: "srv-test",
      AI_SERVER_URL: "http://127.0.0.1:8000",
      AI_SERVER_URL_FALLBACK: "https://example-ai.ngrok-free.app",
    },
    () => {
      assert.deepEqual(
        resolveAiEndpointUrls({ endpointPath: "/api/post/generate-post" }),
        ["https://example-ai.ngrok-free.app/api/post/generate-post"],
      );
    },
  );
});

test("hosted runtimes fail clearly when only loopback AI URLs are configured", () => {
  withEnv(
    {
      RENDER_SERVICE_ID: "srv-test",
      AI_SERVER_URL: "http://127.0.0.1:8000",
    },
    () => {
      assert.throws(
        () => resolveAiEndpointUrls({ endpointPath: "/api/chat/" }),
        /AI 서버 URL/,
      );
    },
  );
});
