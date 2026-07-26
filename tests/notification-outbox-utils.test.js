const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildNotificationFailurePatch,
  getNotificationRetryDelayMs,
} = require("../notification-outbox-utils");

test("notification retries use bounded exponential backoff", () => {
  assert.equal(getNotificationRetryDelayMs(1), 2 * 60_000);
  assert.equal(getNotificationRetryDelayMs(2), 4 * 60_000);
  assert.equal(getNotificationRetryDelayMs(5), 32 * 60_000);
  assert.equal(getNotificationRetryDelayMs(20), 60 * 60_000);
});

test("notification failure patches preserve a bounded error and next retry time", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");
  const patch = buildNotificationFailurePatch(new Error("SMTP unavailable"), 2, now);
  assert.equal(patch.status, "failed");
  assert.equal(patch.last_error, "SMTP unavailable");
  assert.equal(patch.available_at, "2026-07-23T12:04:00.000Z");
});
