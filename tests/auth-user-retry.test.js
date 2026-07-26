const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getAuthenticatedUser,
} = require("../auth-user-retry");

test("transient Supabase authentication transport failures are retried", async () => {
  let calls = 0;
  const expectedUser = { id: "user-1" };
  const authClient = {
    auth: {
      async getUser() {
        calls += 1;
        if (calls === 1) throw new TypeError("fetch failed");
        return { data: { user: expectedUser }, error: null };
      },
    },
  };

  const user = await getAuthenticatedUser(authClient, "token", {
    retryDelayMs: 0,
  });

  assert.equal(calls, 2);
  assert.equal(user, expectedUser);
});

test("invalid tokens are not retried", async () => {
  let calls = 0;
  const authClient = {
    auth: {
      async getUser() {
        calls += 1;
        return {
          data: { user: null },
          error: { message: "invalid token" },
        };
      },
    },
  };

  const user = await getAuthenticatedUser(authClient, "bad-token", {
    retryDelayMs: 0,
  });

  assert.equal(calls, 1);
  assert.equal(user, null);
});

test("a repeated provider outage remains an error", async () => {
  let calls = 0;
  const authClient = {
    auth: {
      async getUser() {
        calls += 1;
        throw new TypeError("fetch failed");
      },
    },
  };

  await assert.rejects(
    getAuthenticatedUser(authClient, "token", {
      retryDelayMs: 0,
    }),
    /fetch failed/
  );
  assert.equal(calls, 2);
});
