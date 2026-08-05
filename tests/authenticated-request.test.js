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

test("authenticated FormData uploads let fetch generate the multipart boundary", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  let capturedOptions = null;
  global.fetch = async (_url, options) => {
    capturedOptions = options;
    return response(200, { success: true });
  };

  const { authenticatedFetch } = await import(`${authUrl}?formdata=${Date.now()}`);
  const formData = new FormData();
  formData.append("rubric", "rubric contents");

  await authenticatedFetch("/api/rubric/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: formData,
  });

  assert.equal(capturedOptions.body, formData);
  assert.equal(capturedOptions.credentials, "include");
  assert.equal(new Headers(capturedOptions.headers).has("Content-Type"), false);
});

test("authenticated JSON requests retain their application/json content type", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  let capturedOptions = null;
  global.fetch = async (_url, options) => {
    capturedOptions = options;
    return response(200, { success: true });
  };

  const { authenticatedFetch } = await import(`${authUrl}?json=${Date.now()}`);
  await authenticatedFetch("/api/example", {
    method: "POST",
    body: JSON.stringify({ value: true }),
  });

  assert.equal(
    new Headers(capturedOptions.headers).get("Content-Type"),
    "application/json"
  );
});

test("FormData upload retry after session refresh still omits Content-Type", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  const uploadHeaders = [];
  let uploadAttempts = 0;
  global.fetch = async (url, options) => {
    if (url === "/api/auth/refresh") {
      return response(200, { ok: true });
    }

    uploadAttempts += 1;
    uploadHeaders.push(new Headers(options.headers));
    return uploadAttempts === 1
      ? response(401, { error: "Expired" })
      : response(200, { success: true });
  };

  const { authenticatedFetch } = await import(`${authUrl}?formdataRetry=${Date.now()}`);
  const formData = new FormData();
  formData.append("rubric", "rubric contents");

  const result = await authenticatedFetch("/api/rubric/parse", {
    method: "POST",
    body: formData,
  });

  assert.equal(result.status, 200);
  assert.equal(uploadHeaders.length, 2);
  assert.equal(uploadHeaders.every((headers) => !headers.has("Content-Type")), true);
});
