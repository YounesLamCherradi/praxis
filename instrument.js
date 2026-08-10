require("dotenv").config();
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
  });

  if (process.env.SENTRY_VERIFY_ON_STARTUP === "true") {
    Sentry.captureException(
      new Error("Praxis Node Sentry verification test")
    );
  }
}

module.exports = Sentry;
