const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const authUrl = pathToFileURL(
  path.join(__dirname, "../frontend/src/services/auth.js")
).href;

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

test("authenticated requests refresh once and retry the original request", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    if (url === "/api/auth/refresh") return response(200, { ok: true });
    if (calls.filter((entry) => entry === "/api/protected").length === 1) {
      return response(401, { error: "Expired" });
    }
    return response(200, { value: "restored" });
  };

  const { requestJson } = await import(`${authUrl}?single=${Date.now()}`);
  const data = await requestJson("/api/protected");
  assert.equal(data.value, "restored");
  assert.deepEqual(calls, [
    "/api/protected",
    "/api/auth/refresh",
    "/api/protected",
  ]);
});

test("concurrent 401 responses share one refresh request", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  let refreshCalls = 0;
  const protectedCalls = new Map();
  global.fetch = async (url) => {
    if (url === "/api/auth/refresh") {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response(200, { ok: true });
    }
    const count = (protectedCalls.get(url) || 0) + 1;
    protectedCalls.set(url, count);
    return count === 1
      ? response(401, { error: "Expired" })
      : response(200, { ok: true });
  };

  const { requestJson } = await import(`${authUrl}?concurrent=${Date.now()}`);
  await Promise.all([
    requestJson("/api/protected-a"),
    requestJson("/api/protected-b"),
  ]);
  assert.equal(refreshCalls, 1);
  assert.equal(protectedCalls.get("/api/protected-a"), 2);
  assert.equal(protectedCalls.get("/api/protected-b"), 2);
});

test("failed refresh preserves the final 401 error metadata", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async (url) =>
    url === "/api/auth/refresh"
      ? response(401, { error: "Refresh expired" })
      : response(401, { error: "Please sign in again" });

  const { requestJson } = await import(`${authUrl}?failed=${Date.now()}`);
  await assert.rejects(
    requestJson("/api/protected"),
    (error) => error.status === 401 && error.message === "Please sign in again"
  );
});

test("request errors preserve retryable metadata from temporary backend failures", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () =>
    response(429, {
      error: "AI is busy right now.",
      retryable: true,
    });

  const { requestJson } = await import(`${authUrl}?retryable=${Date.now()}`);
  await assert.rejects(
    requestJson("/api/generate"),
    (error) =>
      error.status === 429 &&
      error.retryable === true &&
      error.message === "AI is busy right now."
  );
});
