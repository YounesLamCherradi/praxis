const MAX_NOTIFICATION_RETRY_MINUTES = 60;

function getNotificationRetryDelayMs(attemptCount) {
  const attempts = Math.max(1, Math.floor(Number(attemptCount) || 1));
  const minutes = Math.min(
    MAX_NOTIFICATION_RETRY_MINUTES,
    2 ** Math.min(attempts, 6)
  );
  return minutes * 60_000;
}

function buildNotificationFailurePatch(error, attemptCount, nowMs = Date.now()) {
  return {
    status: 'failed',
    last_error: String(error?.message || error || 'Notification delivery failed.').slice(0, 2000),
    available_at: new Date(nowMs + getNotificationRetryDelayMs(attemptCount)).toISOString(),
  };
}

module.exports = {
  buildNotificationFailurePatch,
  getNotificationRetryDelayMs,
};
