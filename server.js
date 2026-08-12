const Sentry = require('./instrument');
require('dotenv').config();
const path = require('node:path');
const express = require('express');
const db = require('./db');
const compression = require('compression');
const crypto = require('node:crypto');
// SMTP fallback (kept for possible future use):
// const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { parseRubricBuffer, parseRubricText } = require('./rubricParser');
const { analyzeSubmission } = require('./public/writing-process/analyze');
const { ANALYSIS_VERSION } = require('./public/writing-process/types');
const { BASE_ASSIGNMENT_TYPES } = require('./public/app-constants');
const {
  appendResetQuery,
  getTeacherReviewSavedAt,
  submissionWasReopened,
  submissionPayloadWithGradedStatus,
  teacherReviewWasNewlySaved,
} = require('./notification-utils');
const {
  buildDeidentifiedArchiveRow,
  createOpenTeacherReview,
  mergeAppendOnlyProcessHistory,
  normalizeStudentVisibleSubmission,
  preserveProcessHistoryOnSubmit,
  sanitizeStudentSubmissionPayload,
  sanitizeTeacherSubmissionPayload,
} = require('./submission-sanitizer');
const { buildSubmissionAttemptList } = require('./submission-attempts');
const {
  getCanonicalRedirectTarget,
  getConfiguredBaseUrl,
  getSafeRedirectPath,
} = require('./canonical-url-utils');
const {
  BUG_REPORT_BUCKET,
  decodeBugReportAttachment,
} = require('./bug-report-attachment');
const {
  buildNotificationFailurePatch,
} = require('./notification-outbox-utils');
const {
  getAuthenticatedUser,
} = require('./auth-user-retry');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const APP_DB_BACKEND = String(process.env.APP_DB_BACKEND || 'supabase').trim().toLowerCase();
const USE_POSTGRES_APP_DB = APP_DB_BACKEND === 'postgres';

const app = express();
app.disable("x-powered-by");
app.use(compression());

// Allow the deployed React frontend to call the Render API directly.
app.use((req, res, next) => {
  const requestOrigin = stripTrailingSlashes(
    String(req.headers.origin || "")
  );

  const allowedOrigins = new Set(
    [
      stripTrailingSlashes(process.env.PUBLIC_APP_URL || ""),
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ].filter(Boolean)
  );

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    res.set("Access-Control-Allow-Origin", requestOrigin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Credentials", "true");
    res.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, sentry-trace, baggage"
    );
    res.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

// Security headers applied to every response (static assets + API). HSTS,
// X-Frame-Options, X-Content-Type-Options, Cross-Origin-Opener-Policy and
// Referrer-Policy are safe to enforce. The Content-Security-Policy is sent
// Report-Only so it cannot break the app: tune the reported origins (and remove
// the inline event-handler usage) before switching to an enforcing
// `Content-Security-Policy` header.
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy-Report-Only': [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' https://js-de.sentry-cdn.com https://browser.sentry-cdn.com",
      "connect-src 'self' https://*.sentry.io https://*.ingest.de.sentry.io https://*.ingest.sentry.io",
      "worker-src 'self' blob:",
    ].join('; '),
  });
  next();
});

// Render uses this endpoint to verify that the backend is running.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Praxis API",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});



// Local PostgreSQL health check for the cPanel deployment.
app.get("/api/health/postgres", async (req, res) => {
  try {
    await db.query("SELECT 1");
    return res.status(200).json({
      success: true,
      postgres: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[POSTGRES HEALTH]", error.message);
    return res.status(500).json({
      success: false,
      postgres: "unavailable",
    });
  }
});

app.get('/api/setup/status', async (req, res) => {
  try {
    const status = await getBackendSetupStatus();
    res.status(200).json({
      ok: status.missing.length === 0,
      status,
      nextStep: status.missing.length === 0
        ? 'Supabase core tables are available.'
        : 'Run migrations/bootstrap-auth-schema.sql in the Supabase SQL editor for a fresh project.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res, next) => {

  // API requests must remain on the Render backend.
  if (req.path.startsWith("/api/")) {
    return next();
  }
  const redirectPath = getSafeRedirectPath(req.originalUrl || req.url);
  const redirectTarget = getCanonicalRedirectTarget({
    method: req.method,
    host: req.headers['x-forwarded-host'] || req.headers.host,
    originalUrl: redirectPath,
    configuredBase: getConfiguredBaseUrl(),
  });
  if (redirectTarget) {
    res.set('Location', redirectTarget);
    return res.status(308).end();
  }
  return next();
});
// Invite links are the bare origin with a ?join=CLASSID query
// (e.g. https://praxiswrite.com/?join=abc123). The static middleware below
// serves the marketing landing page for "/", so without this the invited
// student lands on the landing page instead of the sign-up / join screen.
// Rewrite "/" to the app shell whenever a join invite is present so the
// invited student reaches the auth screen directly (which forces a
// student-only sign-up for invites). Rewriting the path — rather than reading
// the file here — lets the static middleware below do the file read, so this
// handler performs no direct file-system access of its own.
app.get('/', (req, res, next) => {
  // Serve the app (not the marketing landing page) for flows the SPA must
  // handle on load: class invites (?join) and the password-reset callback
  // (?reset), whose recovery token Supabase appends to this URL as a hash.
  if (req.query.join || req.query.reset) {
    req.url = '/index.html';
  }
  return next();
});
app.use(express.static(path.join(__dirname, 'public'), { index: 'landing.html' }));
app.use(express.json({ limit: '10mb' }))

// Non-remember sessions expire after inactivity (default: 1 hour).
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (!isNonRememberSession(req)) return next();
  if (!hasSessionCookies(req)) return next();

  const lastActivity = getLastActivityMs(req);
  const now = Date.now();

  if (lastActivity && now - lastActivity > NON_REMEMBER_INACTIVITY_MS) {
    req.sessionInactive = true;
    clearAuthCookies(req, res);
    return next();
  }

  setLastActivityCookie(req, res);
  return next();
});

const SUPABASE_SERVER_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BROWSER_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLIC_KEY;

const SERVER_CLIENT_AUTH_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithSupabaseTimeout,
  },
};

const SUPABASE_REQUEST_TIMEOUT_MS = Math.max(
  3_000,
  Number(process.env.SUPABASE_REQUEST_TIMEOUT_MS || 12_000)
);

async function fetchWithSupabaseTimeout(url, options = {}) {
  if (options.signal) return fetch(url, options);

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SUPABASE_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Supabase admin client (secret/service role — server only).
const supabase = createClient(
  process.env.SUPABASE_URL,
  SUPABASE_SERVER_KEY,
  SERVER_CLIENT_AUTH_OPTIONS
);

// User-auth client for user session operations. Keep this separate so sign-in
// and refresh calls cannot pollute the admin client's Authorization context.
const supabaseUserAuth = createClient(
  process.env.SUPABASE_URL,
  SUPABASE_BROWSER_KEY,
  SERVER_CLIENT_AUTH_OPTIONS
);

if (!SUPABASE_SERVER_KEY) {
  console.error(
    '[STARTUP ERROR] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'The server will use anonymous Supabase access, which is blocked by RLS for write operations. ' +
    'Set SUPABASE_SERVICE_ROLE_KEY in your environment variables (.env or hosting platform).'
  );
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NOTIFY_FROM_EMAIL =
  process.env.NOTIFY_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  process.env.FROM_EMAIL ||
  '';
// SMTP configuration (kept for possible future use):
// const SMTP_HOST = process.env.SMTP_HOST || '';
// const SMTP_PORT = Number(process.env.SMTP_PORT || 0);
// const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
// const SMTP_USER = process.env.SMTP_USER || '';
// const SMTP_PASS = process.env.SMTP_PASS || '';
const DEADLINE_REMINDER_POLL_MS = Math.max(5 * 60 * 1000, Number(process.env.ASSIGNMENT_REMINDER_POLL_MS || 15 * 60 * 1000));
const DEADLINE_REMINDER_WINDOW_MS = Math.max(5 * 60 * 1000, Number(process.env.ASSIGNMENT_REMINDER_WINDOW_MS || 20 * 60 * 1000));
const OTP_CODE_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RETENTION_HOURS = Math.max(1, Number(process.env.OTP_RETENTION_HOURS || 48));
const OTP_CLEANUP_INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.OTP_CLEANUP_INTERVAL_MS || 60 * 60 * 1000));
const OTP_PURPOSE_SIGNUP = 'signup';
const OTP_PURPOSE_PASSWORD_RESET = 'password_reset';
// Classroom defaults: avoid long shared-IP lockouts while still slowing brute-force bursts.
const SIGNIN_RATE_WINDOW_MS = Math.max(60 * 1000, Number(process.env.SIGNIN_RATE_WINDOW_MS || 15 * 60 * 1000));
const SIGNIN_RATE_MAX_ATTEMPTS = Math.max(1, Number(process.env.SIGNIN_RATE_MAX_ATTEMPTS || 8));
const SIGNIN_RATE_BLOCK_MS = Math.max(60 * 1000, Number(process.env.SIGNIN_RATE_BLOCK_MS || 2 * 60 * 1000));
const SIGNIN_IP_RATE_WINDOW_MS = Math.max(60 * 1000, Number(process.env.SIGNIN_IP_RATE_WINDOW_MS || 15 * 60 * 1000));
const SIGNIN_IP_RATE_MAX_ATTEMPTS = Math.max(1, Number(process.env.SIGNIN_IP_RATE_MAX_ATTEMPTS || 120));
const SIGNIN_IP_RATE_BLOCK_MS = Math.max(60 * 1000, Number(process.env.SIGNIN_IP_RATE_BLOCK_MS || 60 * 1000));
const SIGNIN_FAILURE_DELAY_BASE_MS = Math.max(500, Number(process.env.SIGNIN_FAILURE_DELAY_BASE_MS || 2000));
const SIGNIN_FAILURE_DELAY_MAX_MS = Math.max(SIGNIN_FAILURE_DELAY_BASE_MS, Number(process.env.SIGNIN_FAILURE_DELAY_MAX_MS || 30000));
const SIGNIN_FAILURE_DELAY_START_AFTER = Math.max(1, Number(process.env.SIGNIN_FAILURE_DELAY_START_AFTER || 2));
const NON_REMEMBER_INACTIVITY_MS = Math.max(5 * 60 * 1000, Number(process.env.NON_REMEMBER_INACTIVITY_MS || 60 * 60 * 1000));
const OTP_SECRET =
  process.env.OTP_SECRET ||
  process.env.AUTH_OTP_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  '';
let deadlineReminderJob = null;
let notificationOutboxJob = null;
let deadlineReminderInFlight = false;
let otpCleanupLastRanAt = 0;
const signinRateLimiter = new Map();
const signinIpRateLimiter = new Map();
const joinCodeRateLimiter = new Map();
const joinCodeIpRateLimiter = new Map();
const JOIN_CODE_RATE_WINDOW_MS = 15 * 60 * 1000;
const JOIN_CODE_RATE_MAX_FAILURES = 10;
const JOIN_CODE_RATE_BLOCK_MS = 5 * 60 * 1000;
const JOIN_CODE_IP_RATE_MAX_FAILURES = 100;
const ACCOUNT_SETUP_INCOMPLETE_MESSAGE = "Your login worked, but your account setup is incomplete. Please ask your teacher (if you're a student) or contact support so we can finish setting up your account.";
const SIGNUP_PROFILE_ERROR_MESSAGE = "We couldn't finish setting up your account. Please try creating your account again. If this keeps happening, ask your teacher (if you're a student) or contact support.";

// let smtpTransport = null;

if (!process.env.SUPABASE_URL || !SUPABASE_SERVER_KEY) {
  console.warn('Supabase server client is missing SUPABASE_URL or a service-role key.');
}

if (!process.env.SUPABASE_URL || !SUPABASE_BROWSER_KEY) {
  console.warn('Supabase user-auth client is missing SUPABASE_URL or a publishable/anon key.');
}

function getBearerToken(req) {
  if (req.sessionInactive === true) return null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const candidate = String(auth.slice(7) || '').trim();
    if (candidate && candidate !== 'null' && candidate !== 'undefined') {
      return candidate;
    }
  }
  const cookieToken = getCookieValue(req, 'praxis_at');
  return cookieToken || null;
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  if (!raw) return {};

  return raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eq = part.indexOf('=');
      if (eq < 0) return acc;
      const key = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (!key) return acc;
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function getCookieValue(req, key) {
  const cookies = parseCookies(req);
  return String(cookies[key] || '').trim() || null;
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (forwardedProto === 'https') return true;
  return Boolean(req.secure);
}

function buildCookieHeader(name, value, {
  httpOnly = true,
  secure = false,
  sameSite = 'Lax',
  path = '/',
  maxAge = null,
} = {}) {
  const parts = [`${name}=${encodeURIComponent(String(value || ''))}`];
  parts.push(`Path=${path}`);
  parts.push(`SameSite=${sameSite}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (Number.isFinite(Number(maxAge)) && Number(maxAge) >= 0) {
    parts.push(`Max-Age=${Math.floor(Number(maxAge))}`);
  }
  return parts.join('; ');
}

function setAuthCookies(req, res, session, stayLoggedIn = true) {
  const secure = isSecureRequest(req);
  const accessToken = String(session?.access_token || '').trim();
  const refreshToken = String(session?.refresh_token || '').trim();
  if (!accessToken || !refreshToken) return;

  const accessMaxAge = Math.max(60, Number(session?.expires_in || 3600));
  const refreshMaxAge = stayLoggedIn ? 30 * 24 * 60 * 60 : null;

  const accessCookie = buildCookieHeader('praxis_at', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: accessMaxAge,
  });

  const refreshCookie = buildCookieHeader('praxis_rt', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: refreshMaxAge,
  });

  const rememberCookie = buildCookieHeader('praxis_rm', stayLoggedIn ? '1' : '0', {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: stayLoggedIn ? 30 * 24 * 60 * 60 : null,
  });

  res.append('Set-Cookie', accessCookie);
  res.append('Set-Cookie', refreshCookie);
  res.append('Set-Cookie', rememberCookie);

  if (!stayLoggedIn) {
    setLastActivityCookie(req, res);
  } else {
    res.append('Set-Cookie', buildCookieHeader('praxis_la', '', {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }));
  }
}

function clearAuthCookies(req, res) {
  const secure = isSecureRequest(req);
  res.append('Set-Cookie', buildCookieHeader('praxis_at', '', {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  }));
  res.append('Set-Cookie', buildCookieHeader('praxis_rt', '', {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  }));
  res.append('Set-Cookie', buildCookieHeader('praxis_rm', '', {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  }));
  res.append('Set-Cookie', buildCookieHeader('praxis_la', '', {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  }));
}

function isNonRememberSession(req) {
  return getCookieValue(req, 'praxis_rm') === '0';
}

function hasSessionCookies(req) {
  return Boolean(getCookieValue(req, 'praxis_at') || getCookieValue(req, 'praxis_rt'));
}

function getLastActivityMs(req) {
  const raw = getCookieValue(req, 'praxis_la');
  const value = Number(raw || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function setLastActivityCookie(req, res) {
  const secure = isSecureRequest(req);
  res.append('Set-Cookie', buildCookieHeader('praxis_la', String(Date.now()), {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.ceil(NON_REMEMBER_INACTIVITY_MS / 1000),
  }));
}

function getRequestScopedSupabase(req) {
  const token = getBearerToken(req);
  if (!process.env.SUPABASE_URL || !SUPABASE_BROWSER_KEY || !token) {
    return supabase;
  }
  return createClient(process.env.SUPABASE_URL, SUPABASE_BROWSER_KEY, {
    ...SERVER_CLIENT_AUTH_OPTIONS,
    global: {
      fetch: fetchWithSupabaseTimeout,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

// Helper to get authenticated user from request
async function getUser(req) {
  const token = getBearerToken(req);
  return getAuthenticatedUser(supabaseUserAuth, token);
}

function isRlsDenial(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return code === "42501" || msg.includes("row-level security") || msg.includes("violates") || msg.includes("insufficient_privilege");
}

function isMissingRelation(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  return code === '42P01' ||
    code === 'PGRST205' ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('table') && message.includes('schema cache'));
}

async function getBackendSetupStatus() {
  const status = {
    supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL),
    serviceRoleConfigured: Boolean(SUPABASE_SERVER_KEY),
    anonKeyConfigured: Boolean(SUPABASE_BROWSER_KEY),
    profilesTableReady: false,
    classesTableReady: false,
    assignmentsTableReady: false,
    submissionsTableReady: false,
    notificationOutboxTableReady: false,
    notificationDeliveriesTableReady: false,
    courseMessagesTableReady: false,
    missing: [],
  };

  if (!process.env.SUPABASE_URL || !SUPABASE_SERVER_KEY) {
    if (!process.env.SUPABASE_URL) status.missing.push('SUPABASE_URL');
    if (!SUPABASE_SERVER_KEY) status.missing.push('SUPABASE_SERVICE_ROLE_KEY');
    return status;
  }

  const checks = [
    ['profilesTableReady', 'profiles', 'id'],
    ['classesTableReady', 'classes', 'id'],
    ['assignmentsTableReady', 'assignments', 'id'],
    ['submissionsTableReady', 'submissions', 'id'],
    ['notificationOutboxTableReady', 'notification_outbox', 'id'],
    ['notificationDeliveriesTableReady', 'notification_deliveries', 'idempotency_key'],
    ['courseMessagesTableReady', 'course_messages', 'id'],
  ];

  for (const [field, table, keyColumn] of checks) {
    const { error } = await supabase
      .from(table)
      .select(keyColumn, { count: 'exact', head: true });
    if (!error) {
      status[field] = true;
      continue;
    }
    if (isMissingRelation(error)) {
      status.missing.push(table);
      continue;
    }
    status.missing.push(`${table}: ${error.message}`);
    return status;
  }

  return status;
}

// Research-consent flag must never reach any client (IRB: consent status is
// invisible to teachers and students alike). Strip it from every profile
// payload the API returns; admins manage it through the dedicated flags
// endpoint instead.
function sanitizeProfileForClient(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const sanitized = { ...profile };
  delete sanitized.exclude_from_writing_behavior;
  return sanitized;
}

// Helper to get user profile including role
async function getProfile(userId) {
  if (USE_POSTGRES_APP_DB) {
    try {
      const { rows } = await db.query(
        `SELECT *
           FROM public.profiles
          WHERE id = $1
          LIMIT 1`,
        [userId]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('[POSTGRES PROFILE]', safeLogError(error));
      return null;
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

function getRequestBaseUrl(req) {
  const configuredBase =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL;
  if (configuredBase) {
    return stripTrailingSlashes(configuredBase);
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const originHeader = String(req.headers.origin || '').trim();

  if (originHeader) {
    return stripTrailingSlashes(originHeader);
  }
  if (forwardedProto && forwardedHost) {
    return stripTrailingSlashes(`${forwardedProto}://${forwardedHost}`);
  }

  const host = req.headers.host;
  if (host) {
    return stripTrailingSlashes(`${req.protocol || 'https'}://${host}`);
  }

  return 'http://localhost:3000';
}

function getConfiguredPublicBaseUrl() {
  const configuredBase =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    '';
  return stripTrailingSlashes(configuredBase);
}

function isLocalhostUrl(value) {
  let raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('http://')) raw = raw.slice(7);
  if (raw.startsWith('https://')) raw = raw.slice(8);
  const slashIndex = raw.indexOf('/');
  if (slashIndex >= 0) raw = raw.slice(0, slashIndex);
  return raw === 'localhost' ||
    raw.startsWith('localhost:') ||
    raw === '127.0.0.1' ||
    raw.startsWith('127.0.0.1:') ||
    raw === '::1' ||
    raw === '[::1]' ||
    raw.startsWith('[::1]:');
}

// Apply a trusted configured origin to a reset redirect: honor the client's
// requested redirect only if it is same-origin, otherwise keep just its
// path+query on the trusted origin. Extracted to keep getPasswordResetBaseUrl's
// cognitive complexity within bounds.
function applyTrustedResetOrigin(configuredBase, redirectFromClient, isAbsoluteClientRedirect) {
  if (!isAbsoluteClientRedirect) return configuredBase;
  try {
    const trusted = new URL(configuredBase);
    const requested = new URL(redirectFromClient);
    if (requested.origin === trusted.origin) {
      return stripTrailingSlashes(requested.href);
    }
    return stripTrailingSlashes(`${trusted.origin}${requested.pathname}${requested.search}`);
  } catch {
    return configuredBase; // malformed redirect — fall back to the trusted base
  }
}

function getPasswordResetBaseUrl(req, requestedRedirect) {
  const redirectFromClient = String(requestedRedirect || '').trim();
  const lowerRedirect = redirectFromClient.toLowerCase();
  const isAbsoluteClientRedirect =
    (lowerRedirect.startsWith('http://') || lowerRedirect.startsWith('https://')) &&
    !isLocalhostUrl(redirectFromClient);

  // When a trusted public base is configured (PUBLIC_APP_URL etc.), never emit an
  // off-domain reset link (defense-in-depth on top of Supabase's allow-list). A
  // same-origin `…/?reset=1` is returned verbatim, so the normal flow is unchanged.
  // When no trusted base is configured the previous behavior is preserved so the
  // origin is never mis-resolved from proxy headers.
  const configuredBase = getConfiguredPublicBaseUrl();
  if (configuredBase && !isLocalhostUrl(configuredBase)) {
    return applyTrustedResetOrigin(configuredBase, redirectFromClient, isAbsoluteClientRedirect);
  }

  if (isAbsoluteClientRedirect) {
    return stripTrailingSlashes(redirectFromClient);
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  if (forwardedProto && forwardedHost && !isLocalhostUrl(forwardedHost)) {
    return stripTrailingSlashes(`${forwardedProto}://${forwardedHost}`);
  }

  const originHeader = String(req.headers.origin || '').trim();
  if (originHeader && !isLocalhostUrl(originHeader)) {
    return stripTrailingSlashes(originHeader);
  }

  return getRequestBaseUrl(req);
}

function stripTrailingSlashes(value) {
  const raw = String(value || '');
  let end = raw.length;
  while (end > 0 && raw[end - 1] === '/') end -= 1;
  return raw.slice(0, end);
}

function canSendNotificationEmails() {
  return Boolean(RESEND_API_KEY && NOTIFY_FROM_EMAIL);
}

/*
 * SMTP transport retained for possible future use.
 *
 * function getSmtpTransport() {
 *   if (smtpTransport) return smtpTransport;
 *   if (!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS)) return null;
 *
 *   smtpTransport = nodemailer.createTransport({
 *     host: SMTP_HOST,
 *     port: SMTP_PORT,
 *     secure: SMTP_SECURE,
 *     connectionTimeout: Math.max(
 *       3_000,
 *       Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10_000)
 *     ),
 *     greetingTimeout: Math.max(
 *       3_000,
 *       Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10_000)
 *     ),
 *     socketTimeout: Math.max(
 *       5_000,
 *       Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20_000)
 *     ),
 *     auth: {
 *       user: SMTP_USER,
 *       pass: SMTP_PASS,
 *     },
 *   });
 *   return smtpTransport;
 * }
 */

function maskEmail(email = '') {
  const value = String(email || '').trim();
  const [name, domain] = value.split('@');
  if (!name || !domain) return value ? 'configured' : '';
  const visibleName = name.length <= 2 ? `${name[0] || ''}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${visibleName}@${domain}`;
}

function safeLogId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return crypto
    .createHash('sha256')
    .update(raw)
    .digest('hex')
    .slice(0, 12);
}

function safeLogError(error) {
  return error?.message || String(error || 'Unknown error');
}

// Returns only the error class name — never message or stack, both of
// which can include user-controlled data tainted from the request body
// (Sonar S5145). Use in request handler catch blocks.
function errorClassForLog(error) {
  return error?.name || 'Error';
}

function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 10) {
    return 'Password must be at least 10 characters.';
  }
  if (!/[a-z]/.test(value)) {
    return 'Password must include at least 1 lowercase letter.';
  }
  if (!/[A-Z]/.test(value)) {
    return 'Password must include at least 1 uppercase letter.';
  }
  if (!/\d/.test(value)) {
    return 'Password must include at least 1 number.';
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Password must include at least 1 special character.';
  }
  return '';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').trim();
  if (forwarded) return forwarded.split(',')[0].trim();
  return String(req.ip || req.socket?.remoteAddress || '').trim() || 'unknown';
}

function cleanupRateBucket(map, now, windowMs) {
  for (const [key, value] of map.entries()) {
    const blockedUntil = Number(value?.blockedUntil || 0);
    const lastTs = Number(value?.attempts?.[value.attempts.length - 1] || 0);
    const staleWindow = windowMs * 2;
    if (blockedUntil > now) continue;
    if (!lastTs || now - lastTs > staleWindow) {
      map.delete(key);
    }
  }
}

function evaluateRateBucket(map, key, now, { windowMs, maxAttempts, blockMs, progressiveDelay = null }) {
  const current = map.get(key) || { attempts: [], blockedUntil: 0 };
  const activeAttempts = (current.attempts || []).filter((ts) => now - Number(ts || 0) <= windowMs);
  current.attempts = activeAttempts;

  if (Number(current.blockedUntil || 0) > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.blockedUntil - now) / 1000));
    map.set(key, current);
    return { blocked: true, retryAfterSeconds };
  }

  if (activeAttempts.length >= maxAttempts) {
    current.blockedUntil = now + blockMs;
    map.set(key, current);
    return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil(blockMs / 1000)), reason: 'rate_limited' };
  }

  if (progressiveDelay) {
    const priorFailures = activeAttempts.length;
    const startAfter = Math.max(1, Number(progressiveDelay.startAfterAttempts || 1));
    if (priorFailures >= startAfter) {
      const exponent = Math.max(0, priorFailures - startAfter);
      const baseDelayMs = Math.max(1, Number(progressiveDelay.baseDelayMs || 1));
      const maxDelayMs = Math.max(baseDelayMs, Number(progressiveDelay.maxDelayMs || baseDelayMs));
      const delayMs = Math.min(maxDelayMs, baseDelayMs * (2 ** exponent));
      const lastFailureTs = Number(activeAttempts[activeAttempts.length - 1] || 0);
      if (lastFailureTs > 0) {
        const nextAllowedTs = lastFailureTs + delayMs;
        if (nextAllowedTs > now) {
          map.set(key, current);
          return {
            blocked: true,
            retryAfterSeconds: Math.max(1, Math.ceil((nextAllowedTs - now) / 1000)),
            reason: 'cooldown',
          };
        }
      }
    }
  }

  map.set(key, current);
  return { blocked: false, retryAfterSeconds: 0, reason: 'ok' };
}

function registerRateFailure(map, key, now, { windowMs, maxAttempts, blockMs }) {
  const current = map.get(key) || { attempts: [], blockedUntil: 0 };
  const activeAttempts = (current.attempts || []).filter((ts) => now - Number(ts || 0) <= windowMs);
  activeAttempts.push(now);
  current.attempts = activeAttempts;
  if (activeAttempts.length >= maxAttempts) {
    current.blockedUntil = now + blockMs;
  }
  map.set(key, current);
}

function clearRateBucketEntry(map, key) {
  map.delete(key);
}

function checkSigninRateLimit(req, email) {
  const now = Date.now();
  cleanupRateBucket(signinRateLimiter, now, SIGNIN_RATE_WINDOW_MS);
  cleanupRateBucket(signinIpRateLimiter, now, SIGNIN_IP_RATE_WINDOW_MS);

  const emailKey = `${getClientIp(req)}:${normalizeEmail(email)}`;
  const ipKey = getClientIp(req);

  const emailCheck = evaluateRateBucket(signinRateLimiter, emailKey, now, {
    windowMs: SIGNIN_RATE_WINDOW_MS,
    maxAttempts: SIGNIN_RATE_MAX_ATTEMPTS,
    blockMs: SIGNIN_RATE_BLOCK_MS,
    progressiveDelay: {
      baseDelayMs: SIGNIN_FAILURE_DELAY_BASE_MS,
      maxDelayMs: SIGNIN_FAILURE_DELAY_MAX_MS,
      startAfterAttempts: SIGNIN_FAILURE_DELAY_START_AFTER,
    },
  });
  if (emailCheck.blocked) return emailCheck;

  const ipCheck = evaluateRateBucket(signinIpRateLimiter, ipKey, now, {
    windowMs: SIGNIN_IP_RATE_WINDOW_MS,
    maxAttempts: SIGNIN_IP_RATE_MAX_ATTEMPTS,
    blockMs: SIGNIN_IP_RATE_BLOCK_MS,
  });
  if (ipCheck.blocked) return ipCheck;

  return { blocked: false, retryAfterSeconds: 0 };
}

function registerSigninFailure(req, email) {
  const now = Date.now();
  registerRateFailure(signinRateLimiter, `${getClientIp(req)}:${normalizeEmail(email)}`, now, {
    windowMs: SIGNIN_RATE_WINDOW_MS,
    maxAttempts: SIGNIN_RATE_MAX_ATTEMPTS,
    blockMs: SIGNIN_RATE_BLOCK_MS,
  });
  registerRateFailure(signinIpRateLimiter, getClientIp(req), now, {
    windowMs: SIGNIN_IP_RATE_WINDOW_MS,
    maxAttempts: SIGNIN_IP_RATE_MAX_ATTEMPTS,
    blockMs: SIGNIN_IP_RATE_BLOCK_MS,
  });
}

function clearSigninFailures(req, email) {
  clearRateBucketEntry(signinRateLimiter, `${getClientIp(req)}:${normalizeEmail(email)}`);
}

async function maybeCleanupOtpRecords() {
  const now = Date.now();
  if (now - otpCleanupLastRanAt < OTP_CLEANUP_INTERVAL_MS) return;
  otpCleanupLastRanAt = now;

  const cutoffIso = new Date(
    now - OTP_RETENTION_HOURS * 60 * 60 * 1000
  ).toISOString();

  if (USE_POSTGRES_APP_DB) {
    await db.query(
      `DELETE FROM public.auth_email_otps
        WHERE created_at < $1`,
      [cutoffIso]
    );
    return;
  }

  const { error } = await supabase
    .from('auth_email_otps')
    .delete()
    .lt('created_at', cutoffIso);

  if (error && !isMissingRelation(error)) {
    console.warn('OTP cleanup failed:', safeLogError(error));
  }
}

function otpHash(email, purpose, code) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${purpose}:${normalizeEmail(email)}:${String(code || '').trim()}`)
    .digest('hex');
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(
    OTP_CODE_LENGTH,
    '0'
  );
}

async function getLatestOtp(email, purpose) {
  if (USE_POSTGRES_APP_DB) {
    const { rows } = await db.query(
      `SELECT *
         FROM public.auth_email_otps
        WHERE email = $1
          AND purpose = $2
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1`,
      [normalizeEmail(email), purpose]
    );

    return rows[0] || null;
  }

  const { data, error } = await supabase
    .from('auth_email_otps')
    .select('*')
    .eq('email', normalizeEmail(email))
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function createOtp(email, purpose) {
  const code = generateOtpCode();
  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + OTP_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const resendAvailableAt = new Date(
    now.getTime() + OTP_RESEND_SECONDS * 1000
  ).toISOString();

  if (USE_POSTGRES_APP_DB) {
    const { rows } = await db.query(
      `INSERT INTO public.auth_email_otps
        (
          email,
          purpose,
          code_hash,
          attempts,
          max_attempts,
          expires_at,
          resend_available_at
        )
       VALUES ($1, $2, $3, 0, $4, $5, $6)
       RETURNING id, resend_available_at, expires_at`,
      [
        normalizeEmail(email),
        purpose,
        otpHash(email, purpose, code),
        OTP_MAX_ATTEMPTS,
        expiresAt,
        resendAvailableAt,
      ]
    );

    return {
      code,
      otpId: rows[0].id,
      expiresAt,
      resendAvailableAt,
    };
  }

  const { data, error } = await supabase
    .from('auth_email_otps')
    .insert({
      email: normalizeEmail(email),
      purpose,
      code_hash: otpHash(email, purpose, code),
      attempts: 0,
      max_attempts: OTP_MAX_ATTEMPTS,
      expires_at: expiresAt,
      resend_available_at: resendAvailableAt,
    })
    .select('id, resend_available_at, expires_at')
    .single();

  if (error) throw error;

  return {
    code,
    otpId: data.id,
    expiresAt,
    resendAvailableAt,
  };
}

async function consumeOtpRecord(id) {
  if (USE_POSTGRES_APP_DB) {
    await db.query(
      `UPDATE public.auth_email_otps
          SET consumed_at = NOW()
        WHERE id = $1
          AND consumed_at IS NULL`,
      [id]
    );
    return;
  }

  await supabase
    .from('auth_email_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .is('consumed_at', null);
}

async function verifyOtpCode(email, purpose, code) {
  const latestOtp = await getLatestOtp(email, purpose);

  if (!latestOtp) {
    return {
      ok: false,
      error: 'Invalid or expired verification code.',
    };
  }

  const now = new Date();
  const expiresAt = new Date(latestOtp.expires_at);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() < now.getTime()
  ) {
    await consumeOtpRecord(latestOtp.id);

    return {
      ok: false,
      error: 'Invalid or expired verification code.',
    };
  }

  const incomingHash = otpHash(email, purpose, code);

  if (incomingHash !== latestOtp.code_hash) {
    const nextAttempts = Number(latestOtp.attempts || 0) + 1;
    const maxAttempts = Number(
      latestOtp.max_attempts || OTP_MAX_ATTEMPTS
    );

    if (USE_POSTGRES_APP_DB) {
      await db.query(
        `UPDATE public.auth_email_otps
            SET attempts = $2,
                consumed_at = CASE
                  WHEN $3 THEN NOW()
                  ELSE consumed_at
                END
          WHERE id = $1
            AND consumed_at IS NULL`,
        [
          latestOtp.id,
          nextAttempts,
          nextAttempts >= maxAttempts,
        ]
      );
    } else {
      const payload = { attempts: nextAttempts };

      if (nextAttempts >= maxAttempts) {
        payload.consumed_at = new Date().toISOString();
      }

      await supabase
        .from('auth_email_otps')
        .update(payload)
        .eq('id', latestOtp.id)
        .is('consumed_at', null);
    }

    if (nextAttempts >= maxAttempts) {
      return {
        ok: false,
        error:
          'Maximum attempts reached. Please request a new code.',
      };
    }

    return {
      ok: false,
      error: `Invalid verification code. ${Math.max(
        0,
        maxAttempts - nextAttempts
      )} attempts remaining.`,
    };
  }

  await consumeOtpRecord(latestOtp.id);
  return { ok: true };
}

async function getAuthUserByEmail(email) {
  const targetEmail = normalizeEmail(email);
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((user) => normalizeEmail(user.email) === targetEmail);
    if (match) return match;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function requestEmailOtp({ email, purpose, subject, introLine, safetyLine = '', recipientName = '' }) {
  // Retention cleanup is maintenance and must not add a Supabase round trip to
  // the user-facing "Get code" request. The guarded task logs its own failure.
  void maybeCleanupOtpRecords().catch((error) => {
    console.warn('OTP cleanup failed:', safeLogError(error));
  });
  const normalizedEmail = normalizeEmail(email);
  const existingOtp = await getLatestOtp(normalizedEmail, purpose);

  if (existingOtp?.resend_available_at) {
    const nextAllowedTime = new Date(existingOtp.resend_available_at);
    const waitMs = nextAllowedTime.getTime() - Date.now();
    if (waitMs > 0) {
      return {
        ok: false,
        status: 429,
        error: 'Please wait before requesting another code.',
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      };
    }
  }

  const { code } = await createOtp(normalizedEmail, purpose);
  const safeName = String(recipientName || '').trim();
  const greetingName = safeName || 'User';
  const optionalSafetyLine = String(safetyLine || '').trim();
  await sendEmail({
    to: normalizedEmail,
    subject,
    html: `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#1d2a44;">
        <p>Dear ${escapeHtmlEmail(greetingName)},</p>
        <p>${escapeHtmlEmail(introLine)}</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;margin:12px 0;color:#2563eb;">${escapeHtmlEmail(code)}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>
        ${optionalSafetyLine ? `<p>${escapeHtmlEmail(optionalSafetyLine)}</p>` : ''}
        <p style="margin-top:20px;color:#5a6d8b;font-size:12px;">Do not reply to this email. This mailbox is not monitored.</p>
        <p style="margin-top:12px;">Best regards,<br/>PraxisWrite Support Team</p>
      </div>
    `,
    text: `Dear ${greetingName},\n\n${introLine}\n\nYour verification code is: ${code}\nThis code expires in ${OTP_TTL_MINUTES} minutes.${optionalSafetyLine ? `\n\n${optionalSafetyLine}` : ''}\n\nDo not reply to this email. This mailbox is not monitored.\n\nBest regards,\nPraxisWrite Support Team`,
    idempotencyKey: makeIdempotencyKey([
      'otp',
      purpose,
      normalizedEmail,
      Date.now(),
    ]),
  });

  return {
    ok: true,
    resendSeconds: OTP_RESEND_SECONDS,
  };
}

function makeIdempotencyKey(parts = []) {
  return parts
    .filter(Boolean)
    .join('-')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 240);
}

function clampNumber(value, { min = 0, max = 1, fallback = null } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function escapeHtmlEmail(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDeadline(deadlineValue) {
  if (!deadlineValue) return '';
  const date = new Date(deadlineValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  if (!canSendNotificationEmails() || !to) {
    console.warn(`Email skipped for "${subject || 'untitled email'}": ${to ? 'email configuration missing' : 'recipient missing'}`);
    return { skipped: true };
  }
  const recipients = Array.isArray(to) ? to : [to];

  console.info('[EMAIL DIAG] Sending email', {
    subject,
    recipients: recipients.map(maskEmail),
    recipientCount: recipients.length,
    idempotencyKey: idempotencyKey || null,
    from: maskEmail(NOTIFY_FROM_EMAIL),
    provider: 'resend',
  });

  /*
   * SMTP delivery retained for possible future use.
   *
   * const smtp = getSmtpTransport();
   * const payload = await smtp.sendMail({
   *   from: NOTIFY_FROM_EMAIL,
   *   to: recipients,
   *   subject,
   *   html,
   *   text,
   * });
   * return payload;
   */

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    Math.max(5_000, Number(process.env.RESEND_TIMEOUT_MS || 20_000))
  );
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: NOTIFY_FROM_EMAIL,
        to: recipients,
        subject,
        html,
        text,
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[EMAIL DIAG] Resend rejected email', {
      subject,
      status: response.status,
      payload,
      recipients: recipients.map(maskEmail),
    });
    throw new Error(payload?.message || payload?.error || `Email send failed with status ${response.status}`);
  }
  const recipientCount = recipients.length;
  console.info(`Email sent for "${subject}" to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}.`, {
    resendId: payload?.id || null,
    recipients: recipients.map(maskEmail),
  });
  return payload;
}

async function sendDurableEmail(email) {
  const idempotencyKey = String(email?.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    throw new Error('Durable email delivery requires an idempotency key.');
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase
    .from('notification_deliveries')
    .insert({
      idempotency_key: idempotencyKey,
      status: 'processing',
      started_at: now,
      updated_at: now,
    });

  if (insertError && insertError.code !== '23505') throw insertError;
  if (insertError?.code === '23505') {
    const { data: existing, error: readError } = await supabase
      .from('notification_deliveries')
      .select('status, attempt_count')
      .eq('idempotency_key', idempotencyKey)
      .single();
    if (readError) throw readError;
    if (existing.status === 'delivered' || existing.status === 'processing') {
      return { deduplicated: true, status: existing.status };
    }
    const { error: retryClaimError } = await supabase
      .from('notification_deliveries')
      .update({
        status: 'processing',
        attempt_count: Number(existing.attempt_count || 1) + 1,
        started_at: now,
        updated_at: now,
        last_error: null,
      })
      .eq('idempotency_key', idempotencyKey)
      .eq('status', 'failed');
    if (retryClaimError) throw retryClaimError;
  }

  let result;
  try {
    result = await sendEmail(email);
  } catch (error) {
    await supabase
      .from('notification_deliveries')
      .update({
        status: 'failed',
        last_error: safeLogError(error).slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('idempotency_key', idempotencyKey);
    throw error;
  }

  // Once the provider accepted the message, never mark the key retryable. If
  // this database write fails, its existing "processing" state deliberately
  // suppresses an uncertain retry that could duplicate an SMTP delivery.
  const providerMessageId = result?.messageId || result?.id || null;
  const { error: deliveredError } = await supabase
    .from('notification_deliveries')
    .update({
      status: 'delivered',
      provider_message_id: providerMessageId,
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('idempotency_key', idempotencyKey);
  if (deliveredError) throw deliveredError;
  return result;
}

async function enqueueSubmissionStatusNotifications(previousSubmission, submission) {
  if (teacherReviewWasNewlySaved(previousSubmission?.teacher_review, submission?.teacher_review)) {
    await enqueueDomainEvent({
      eventType: 'submission_reviewed',
      aggregateType: 'submission',
      aggregateId: submission.id,
      idempotencyKey: `submission-reviewed:${submission.id}:${submission.version || getTeacherReviewSavedAt(submission.teacher_review) || submission.updated_at}`,
      payload: { previousTeacherReview: previousSubmission?.teacher_review || {} },
    });
  }
  if (submissionWasReopened(previousSubmission, submission)) {
    await enqueueDomainEvent({
      eventType: 'submission_reopened',
      aggregateType: 'submission',
      aggregateId: submission.id,
      idempotencyKey: `submission-reopened:${submission.id}:${submission.version || submission.updated_at}`,
      payload: { previousSubmission: previousSubmission || {} },
    });
  }
}

async function settleWithConcurrency(items, worker, concurrency = 10) {
  const values = Array.isArray(items) ? items : [];
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(
    values.length,
    Math.max(1, Math.floor(Number(concurrency) || 1))
  );

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = {
          status: 'fulfilled',
          value: await worker(values[index], index),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }));

  return results;
}

async function getAuthUserEmailMap(userIds = []) {
  const wantedIds = Array.from(new Set(userIds.filter(Boolean)));
  const emailMap = new Map();
  if (!wantedIds.length) return emailMap;

  await settleWithConcurrency(wantedIds, async (userId) => {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) throw error;
      if (data?.user?.email) {
        emailMap.set(userId, data.user.email);
      }
    } catch (error) {
      console.error('Could not load auth email for user %s:', userId, error.message || error);
    }
  }, 10);

  return emailMap;
}

function buildEmailConfigDiagnostic() {
  return {
    emailEnabled: canSendNotificationEmails(),
    hasResendApiKey: Boolean(RESEND_API_KEY),
    hasFromEmail: Boolean(NOTIFY_FROM_EMAIL),
    from: maskEmail(NOTIFY_FROM_EMAIL),
    publicBaseUrl: getConfiguredPublicBaseUrl(),
  };
}

async function getClassStudentRecipients(classId) {
  const { data, error } = await supabase
    .from('class_members')
    .select('student_id, profiles(name, email)')
    .eq('class_id', classId);
  if (error) throw error;

  const studentRows = (data || []).filter((entry) => entry.student_id);
  const missingEmailIds = studentRows
    .filter((entry) => !normalizeEmail(entry.profiles?.email))
    .map((entry) => entry.student_id);
  const emailMap = await getAuthUserEmailMap(missingEmailIds);
  return studentRows
    .map((entry) => ({
      id: entry.student_id,
      name: entry.profiles?.name || 'Student',
      email: normalizeEmail(entry.profiles?.email || emailMap.get(entry.student_id)),
    }))
    .filter((entry) => entry.email);
}

async function notifyStudentsAboutAssignment({
  assignment,
  className,
  baseUrl,
  mode,
}) {
  if (!canSendNotificationEmails() || !assignment?.class_id) {
    console.info('[EMAIL DIAG] Assignment notification skipped', {
      emailEnabled: canSendNotificationEmails(),
      assignmentId: assignment?.id || null,
      classId: assignment?.class_id || null,
      reason: !canSendNotificationEmails() ? 'email configuration missing' : 'assignment class missing',
    });
    return;
  }
  const recipients = await getClassStudentRecipients(assignment.class_id);
  if (!recipients.length) {
    console.info('[EMAIL DIAG] Assignment notification skipped', {
      assignmentId: assignment.id || null,
      classId: assignment.class_id,
      reason: 'no enrolled students with email addresses',
    });
    return;
  }

  const safeTitle = escapeHtmlEmail(assignment.title || 'New assignment');
  const subjectTitle = String(assignment.title || 'Assignment')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const safeClassName = escapeHtmlEmail(className || 'your class');
  const safeDeadline = formatDeadline(assignment.deadline);
  const subject = mode === 'deadline-reminder'
    ? `DO NOT REPLY — Assignment due soon: ${subjectTitle}`
    : `DO NOT REPLY — New assignment posted: ${subjectTitle}`;

  const deliveryResults = await settleWithConcurrency(recipients, (recipient) => {
    const intro = mode === 'deadline-reminder'
      ? `<p>Hi ${escapeHtmlEmail(recipient.name)},</p><p>This is a reminder that an assignment is due in about 24 hours.</p>`
      : `<p>Hi ${escapeHtmlEmail(recipient.name)},</p><p>Your teacher has posted a new assignment.</p>`;
    const deadlineLine = safeDeadline
      ? `<p><strong>Deadline:</strong> ${escapeHtmlEmail(safeDeadline)}</p>`
      : '';
    const textDeadlineLine = safeDeadline ? `Deadline: ${safeDeadline}\n` : '';
    const text = mode === 'deadline-reminder'
      ? `Hi ${recipient.name},\n\nThis is a reminder that an assignment is due in about 24 hours.\nClass: ${className || 'praxis'}\nAssignment: ${assignment.title || 'Assignment'}\n${textDeadlineLine}`
      : `Hi ${recipient.name},\n\nYour teacher has posted a new assignment.\nClass: ${className || 'praxis'}\nAssignment: ${assignment.title || 'Assignment'}\n${textDeadlineLine}`;

    return sendDurableEmail({
      to: recipient.email,
      subject,
      html: `
        <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#1d2a44;">
          ${intro}
          <p><strong>Class:</strong> ${safeClassName}</p>
          <p><strong>Assignment:</strong> ${safeTitle}</p>
          ${deadlineLine}
        </div>
      `,
      text,
      idempotencyKey: makeIdempotencyKey([
        mode,
        assignment.id,
        recipient.id,
        mode === 'deadline-reminder'
          ? assignment.deadline
          : assignment.updated_at || assignment.created_at || assignment.deadline || 'published',
      ]),
    });
  }, 10);
  const failedDeliveries = deliveryResults.filter((result) => result.status === 'rejected');
  if (failedDeliveries.length) {
    throw new AggregateError(
      failedDeliveries.map((result) => result.reason),
      `${failedDeliveries.length} of ${recipients.length} assignment notification emails failed.`
    );
  }
}

async function notifyStudentAboutGradedSubmission({
  assignment,
  submission,
  previousTeacherReview,
  baseUrl,
}) {
  const shouldSend = teacherReviewWasNewlySaved(previousTeacherReview, submission?.teacher_review);
  if (!canSendNotificationEmails() || !assignment?.id || !submission?.student_id || !shouldSend) {
    console.info('[EMAIL DIAG] Grade notification skipped', {
      emailEnabled: canSendNotificationEmails(),
      assignmentId: assignment?.id || null,
      studentId: submission?.student_id || null,
      shouldSend,
      previousSavedAt: getTeacherReviewSavedAt(previousTeacherReview),
      nextSavedAt: getTeacherReviewSavedAt(submission?.teacher_review),
      nextReviewStatus: submission?.teacher_review?.status || null,
    });
    return;
  }

  const emailMap = await getAuthUserEmailMap([submission.student_id]);
  const studentEmail = emailMap.get(submission.student_id);
  if (!studentEmail) {
    console.error(`Grade notification skipped: no auth email found for student ${submission.student_id}`);
    return;
  }

  const studentName = submission.profiles?.name || 'Student';
  const safeStudentName = escapeHtmlEmail(studentName);
  const safeTitle = escapeHtmlEmail(assignment.title || 'Assignment');
  const subjectTitle = String(assignment.title || 'Assignment')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const safeClassName = escapeHtmlEmail(assignment.classes?.name || assignment.className || 'your class');
  const score = submission.teacher_review?.finalScore;
  const scoreLine = score !== undefined && score !== null && String(score) !== ''
    ? `<p><strong>Score:</strong> ${escapeHtmlEmail(String(score))}</p>`
    : '';
  const textScoreLine = score !== undefined && score !== null && String(score) !== ''
    ? `Score: ${score}\n`
    : '';

  await sendDurableEmail({
    to: studentEmail,
    subject: `DO NOT REPLY — Feedback available: ${subjectTitle}`,
    html: `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#1d2a44;">
        <p>Hi ${safeStudentName},</p>
        <p>Your teacher has reviewed your work.</p>
        <p><strong>Class:</strong> ${safeClassName}</p>
        <p><strong>Assignment:</strong> ${safeTitle}</p>
        ${scoreLine}
      </div>
    `,
    text: `Hi ${studentName},\n\nYour teacher has reviewed your work.\nClass: ${assignment.classes?.name || assignment.className || 'your class'}\nAssignment: ${assignment.title || 'Assignment'}\n${textScoreLine}`,
    idempotencyKey: makeIdempotencyKey([
      'grade-published',
      assignment.id,
      submission.student_id,
      getTeacherReviewSavedAt(submission.teacher_review),
    ]),
  });
}

async function notifyStudentAboutReopenedSubmission({
  assignment,
  previousSubmission,
  submission,
  baseUrl,
}) {
  const shouldSend = submissionWasReopened(previousSubmission, submission);
  if (!canSendNotificationEmails() || !assignment?.id || !submission?.student_id || !shouldSend) {
    console.info('[EMAIL DIAG] Reopen notification skipped', {
      emailEnabled: canSendNotificationEmails(),
      assignmentId: assignment?.id || null,
      studentId: submission?.student_id || null,
      shouldSend,
      previousStatus: previousSubmission?.status || null,
      nextStatus: submission?.status || null,
    });
    return;
  }

  const emailMap = await getAuthUserEmailMap([submission.student_id]);
  const studentEmail = emailMap.get(submission.student_id);
  if (!studentEmail) {
    console.error(`Reopen notification skipped: no auth email found for student ${submission.student_id}`);
    return;
  }

  const studentName = submission.profiles?.name || 'Student';
  const safeStudentName = escapeHtmlEmail(studentName);
  const safeTitle = escapeHtmlEmail(assignment.title || 'Assignment');
  const subjectTitle = String(assignment.title || 'Assignment')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const safeClassName = escapeHtmlEmail(assignment.classes?.name || assignment.className || 'your class');

  await sendDurableEmail({
    to: studentEmail,
    subject: `DO NOT REPLY — Assignment reopened: ${subjectTitle}`,
    html: `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#1d2a44;">
        <p>Hi ${safeStudentName},</p>
        <p>Your teacher has reopened an assignment.</p>
        <p><strong>Class:</strong> ${safeClassName}</p>
        <p><strong>Assignment:</strong> ${safeTitle}</p>
        <p>You can edit your work and submit it again. Your existing work is still saved.</p>
      </div>
    `,
    text: `Hi ${studentName},\n\nYour teacher has reopened an assignment.\nClass: ${assignment.classes?.name || assignment.className || 'your class'}\nAssignment: ${assignment.title || 'Assignment'}\nYou can edit your work and submit it again. Your existing work is still saved.`,
    idempotencyKey: makeIdempotencyKey([
      'submission-reopened',
      assignment.id,
      submission.student_id,
      submission.updated_at || submission.updatedAt || new Date().toISOString(),
    ]),
  });
}

async function notifyTeacherAboutStudentSubmission({
  assignment,
  submission,
  baseUrl,
}) {
  if (!canSendNotificationEmails() || !assignment?.class_id || !submission?.student_id) {
    console.info('[EMAIL DIAG] Teacher submission notification skipped', {
      emailEnabled: canSendNotificationEmails(),
      assignmentId: assignment?.id || null,
      classId: assignment?.class_id || null,
      studentId: submission?.student_id || null,
    });
    return;
  }

  const { data: classRow, error: classError } = await supabase
    .from('classes')
    .select('id, name, teacher_id')
    .eq('id', assignment.class_id)
    .maybeSingle();
  if (classError) throw classError;
  if (!classRow?.teacher_id) return;

  const emailMap = await getAuthUserEmailMap([classRow.teacher_id]);
  const teacherEmail = emailMap.get(classRow.teacher_id);
  if (!teacherEmail) {
    console.error(`Submission notification skipped: no auth email found for teacher ${classRow.teacher_id}`);
    return;
  }

  const studentName = submission.profiles?.name || 'A student';
  const safeStudentName = escapeHtmlEmail(studentName);
  const safeTitle = escapeHtmlEmail(assignment.title || 'Assignment');
  const subjectTitle = String(assignment.title || 'Assignment')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const safeClassName = escapeHtmlEmail(classRow.name || 'your class');
  const submittedAt = formatDeadline(submission.submitted_at || submission.submittedAt || new Date().toISOString());
  const submittedLine = submittedAt
    ? `<p><strong>Submitted:</strong> ${escapeHtmlEmail(submittedAt)}</p>`
    : '';
  const textSubmittedLine = submittedAt ? `Submitted: ${submittedAt}\n` : '';

  await sendDurableEmail({
    to: teacherEmail,
    subject: `DO NOT REPLY — New submission received: ${subjectTitle}`,
    html: `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#1d2a44;">
        <p>A student has submitted work for review.</p>
        <p><strong>Student:</strong> ${safeStudentName}</p>
        <p><strong>Class:</strong> ${safeClassName}</p>
        <p><strong>Assignment:</strong> ${safeTitle}</p>
        ${submittedLine}
      </div>
    `,
    text: `A student has submitted work for review.\nStudent: ${studentName}\nClass: ${classRow.name || 'your class'}\nAssignment: ${assignment.title || 'Assignment'}\n${textSubmittedLine}`,
    idempotencyKey: makeIdempotencyKey([
      'student-submitted',
      assignment.id,
      submission.student_id,
      submission.submitted_at || submission.submittedAt || submission.updated_at || submission.updatedAt || new Date().toISOString(),
    ]),
  });
}

let notificationOutboxInFlight = false;

async function deliverNotificationOutboxEvent(event) {
  const payload = event.payload || {};
  const baseUrl = getConfiguredPublicBaseUrl();

  if (
    event.event_type === 'assignment_published' ||
    event.event_type === 'assignment_deadline_reminder'
  ) {
    const { data: assignment, error } = await supabase
      .from('assignments')
      .select('*, classes(name)')
      .eq('id', event.aggregate_id)
      .single();
    if (error) throw error;
    await notifyStudentsAboutAssignment({
      assignment,
      className: assignment.classes?.name || 'your class',
      baseUrl,
      mode: event.event_type === 'assignment_deadline_reminder'
        ? 'deadline-reminder'
        : 'published',
    });
    return;
  }

  if (event.event_type === 'submission_received') {
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*, profiles(id, name)')
      .eq('id', event.aggregate_id)
      .single();
    if (submissionError) throw submissionError;
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', submission.assignment_id)
      .single();
    if (assignmentError) throw assignmentError;
    await notifyTeacherAboutStudentSubmission({ assignment, submission, baseUrl });
    return;
  }

  if (event.event_type === 'submission_reviewed' || event.event_type === 'submission_reopened') {
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*, profiles(id, name)')
      .eq('id', event.aggregate_id)
      .single();
    if (submissionError) throw submissionError;
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('*, classes(name)')
      .eq('id', submission.assignment_id)
      .single();
    if (assignmentError) throw assignmentError;
    if (event.event_type === 'submission_reviewed') {
      await notifyStudentAboutGradedSubmission({
        assignment,
        submission,
        previousTeacherReview: payload.previousTeacherReview || {},
        baseUrl,
      });
    } else {
      await notifyStudentAboutReopenedSubmission({
        assignment,
        previousSubmission: payload.previousSubmission || {},
        submission,
        baseUrl,
      });
    }
    return;
  }

  if (event.event_type === 'course_message') {
    const { data: message, error: messageError } = await supabase
      .from('course_messages')
      .select('*, classes(name)')
      .eq('id', event.aggregate_id)
      .single();
    if (messageError) throw messageError;

    const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
    const safeBody = escapeHtmlEmail(message.body).replace(/\r?\n/g, '<br>');
    const safeTeacherName = escapeHtmlEmail(payload.teacherName || 'Your instructor');
    const safeCourseName = escapeHtmlEmail(message.classes?.name || payload.courseName || 'your course');

    await supabase
      .from('course_messages')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', message.id);

    const results = await settleWithConcurrency(recipients, (recipient) =>
      sendDurableEmail({
        to: recipient.email,
        subject: message.subject,
        html: `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.65;color:#1d2a44;"><p>Hi ${escapeHtmlEmail(recipient.name || 'Student')},</p><div>${safeBody}</div><p style="margin-top:24px;color:#60708f;">Sent by ${safeTeacherName} · ${safeCourseName}</p></div>`,
        text: `Hi ${recipient.name || 'Student'},\n\n${message.body}\n\nSent by ${payload.teacherName || 'Your instructor'} · ${message.classes?.name || payload.courseName || 'your course'}`,
        idempotencyKey: makeIdempotencyKey([
          'teacher-course-message',
          message.teacher_id,
          message.provider_request_id,
          recipient.id || recipient.email,
        ]),
      }),
    10);
    const deliveredCount = results.filter((result) => result.status === 'fulfilled').length;
    const failedCount = recipients.length - deliveredCount;
    const nextStatus = failedCount === 0
      ? 'sent'
      : deliveredCount > 0
        ? 'partially_sent'
        : 'failed';
    const { error: updateError } = await supabase
      .from('course_messages')
      .update({
        status: nextStatus,
        delivered_count: deliveredCount,
        failed_count: failedCount,
        sent_at: deliveredCount > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', message.id);
    if (updateError) throw updateError;
    if (failedCount > 0) {
      throw new AggregateError(
        results.filter((result) => result.status === 'rejected').map((result) => result.reason),
        `${failedCount} of ${recipients.length} course message emails failed.`
      );
    }
    return;
  }

  throw new Error(`Unsupported notification outbox event: ${event.event_type}`);
}

async function processNotificationOutbox() {
  if (notificationOutboxInFlight || !canSendNotificationEmails()) return;
  notificationOutboxInFlight = true;
  try {
    const staleClaimCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { error: recoveryError } = await supabase
      .from('notification_outbox')
      .update({
        status: 'failed',
        available_at: new Date().toISOString(),
        last_error: 'Recovered after an interrupted notification worker.',
        claimed_at: null,
      })
      .eq('status', 'processing')
      .or(`claimed_at.is.null,claimed_at.lt.${staleClaimCutoff}`);
    if (recoveryError) throw recoveryError;

    const { data: events, error } = await supabase
      .from('notification_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('available_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(25);
    if (error) throw error;

    for (const event of events || []) {
      const attemptCount = Number(event.attempt_count || 0) + 1;
      const { data: claimed, error: claimError } = await supabase
        .from('notification_outbox')
        .update({
          status: 'processing',
          attempt_count: attemptCount,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', event.id)
        .in('status', ['pending', 'failed'])
        .select('id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) continue;

      try {
        await deliverNotificationOutboxEvent(event);
        const { error: deliveredError } = await supabase
          .from('notification_outbox')
          .update({
            status: 'delivered',
            processed_at: new Date().toISOString(),
            last_error: null,
            claimed_at: null,
          })
          .eq('id', event.id);
        if (deliveredError) throw deliveredError;
      } catch (deliveryError) {
        const failurePatch = {
          ...buildNotificationFailurePatch(deliveryError, attemptCount),
          claimed_at: null,
        };
        await supabase
          .from('notification_outbox')
          .update(failurePatch)
          .eq('id', event.id);
      }
    }
  } finally {
    notificationOutboxInFlight = false;
  }
}

async function processUpcomingDeadlineReminders() {
  if (!canSendNotificationEmails() || deadlineReminderInFlight) return;
  deadlineReminderInFlight = true;
  try {
    const now = Date.now();
    const lowerBound = new Date(now + (24 * 60 * 60 * 1000) - DEADLINE_REMINDER_WINDOW_MS).toISOString();
    const upperBound = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id, class_id, title, deadline, status')
      .eq('status', 'published')
      .gte('deadline', lowerBound)
      .lte('deadline', upperBound);
    if (error) throw error;
    if (!assignments?.length) return;

    const classIds = Array.from(new Set(assignments.map((assignment) => assignment.class_id).filter(Boolean)));
    const { data: classRows, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .in('id', classIds);
    if (classError) throw classError;
    const classNameMap = new Map((classRows || []).map((row) => [row.id, row.name]));

    for (const assignment of assignments) {
      await enqueueDomainEvent({
        eventType: 'assignment_deadline_reminder',
        aggregateType: 'assignment',
        aggregateId: assignment.id,
        idempotencyKey: `assignment-deadline-reminder:${assignment.id}:${assignment.deadline}`,
        payload: {
          assignmentId: assignment.id,
          classId: assignment.class_id,
          deadline: assignment.deadline,
          className: classNameMap.get(assignment.class_id) || 'your class',
        },
      });
    }
    processNotificationOutbox().catch((error) => {
      console.error('Deadline reminder outbox processing failed:', error);
    });
  } catch (error) {
    console.error('Deadline reminder processing failed:', error);
  } finally {
    deadlineReminderInFlight = false;
  }
}

async function requireTeacherProfile(req) {
  const user = await getUser(req);
  if (!user) return { user: null, profile: null, error: 'Not authenticated', status: 401 };
  const profile = await getProfile(user.id);
  if (!profile) {
    return { user, profile: null, error: ACCOUNT_SETUP_INCOMPLETE_MESSAGE, status: 409 };
  }
  if (profile.role !== 'teacher' && profile.role !== 'admin') {
    return { user, profile, error: 'Teacher access required', status: 403 };
  }
  return { user, profile, error: null, status: 200 };
}

function isLocalDevRequest(req) {
  const requestHost = String(req.headers.host || "").split(":")[0];

  return (
    req.hostname === "localhost" ||
    req.hostname === "127.0.0.1" ||
    req.hostname === "::1" ||
    requestHost === "localhost" ||
    requestHost === "127.0.0.1" ||
    requestHost === "::1" ||
    req.ip === "::1" ||
    req.ip === "127.0.0.1" ||
    req.ip === "::ffff:127.0.0.1"
  );
}


function isTrustedDemoRequest(req) {
  if (process.env.DEMO_SKIP_AUTH !== "true") {
    return false;
  }

  const configuredUrl =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    "";

  if (!configuredUrl) {
    return false;
  }

  let allowedHost = "";

  try {
    allowedHost = new URL(configuredUrl).host.toLowerCase();
  } catch {
    return false;
  }

  const requestOrigin = String(
    req.headers.origin || ""
  ).trim();

  let originHost = "";

  if (requestOrigin) {
    try {
      originHost = new URL(
        requestOrigin
      ).host.toLowerCase();
    } catch {
      originHost = "";
    }
  }

  const forwardedHost = String(
    req.headers["x-forwarded-host"] || ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

  return (
    originHost === allowedHost ||
    forwardedHost === allowedHost
  );
}
 
async function requireRubricTeacherProfile(req) {
  const skipRubricAuthForTest =
    (
      process.env.DEV_SKIP_RUBRIC_AUTH === "true" &&
      isLocalDevRequest(req)
    ) ||
    isTrustedDemoRequest(req);

  if (skipRubricAuthForTest) {
    return {
      user: {
        id: "demo-rubric-test-user",
      },

      profile: {
        id: "demo-rubric-test-user",
        role: "teacher",
        name: "Demo Teacher",
      },

      error: null,
      status: 200,
    };
  }

  return requireTeacherProfile(req);
}

async function ensureTeacherOwnsClass(classId, teacherId, client = supabase) {
  const { data, error } = await client
    .from('classes')
    .select('id, teacher_id, name')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function ensureTeacherOwnsAssignment(assignmentId, teacherId, client = supabase) {
  const { data, error } = await client
    .from('assignments')
    .select('id, class_id, title, status, version, updated_at')
    .eq('id', assignmentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ownedClass = await ensureTeacherOwnsClass(data.class_id, teacherId, client);
  return ownedClass ? { ...data, className: ownedClass.name || '' } : null;
}

// Snapshot the de-identified writing-process data of submissions into
// public.submission_archive before they are hard deleted, so timing/process
// data survives a class/assignment deletion for algorithm training.
//
// IRB constraint: the archive holds NO text of student work and NO student
// identity. Writing events are stripped to timing/position fields, the linked
// analysis metrics are copied before the cascade delete removes them, and the
// student id is replaced with a random UUID token (never derived from the id,
// so it cannot be linked back; one token per student per batch keeps grouping).
// Throws if the archive write fails so callers abort the delete rather than
// silently lose data.
async function archiveSubmissionsForDeletion(submissions, { reason, classId = null }) {
  const rows = (submissions || []).filter(Boolean);
  if (!rows.length) return;
  const submissionIds = rows.map((submission) => submission.id);
  const { data: analyses, error: analysisError } = await supabase
    .from('submission_process_analyses')
    .select('submission_id, analysis_version, metrics')
    .in('submission_id', submissionIds);
  if (analysisError) throw analysisError;
  const analysisBySubmissionId = new Map((analyses || []).map((analysis) => [analysis.submission_id, analysis]));
  const tokenByStudentId = new Map();
  const archiveRows = rows.map((submission) => {
    const studentKey = submission.student_id || submission.id;
    if (!tokenByStudentId.has(studentKey)) tokenByStudentId.set(studentKey, crypto.randomUUID());
    return buildDeidentifiedArchiveRow(submission, {
      reason,
      classId,
      studentToken: tokenByStudentId.get(studentKey),
      analysis: analysisBySubmissionId.get(submission.id),
    });
  });
  const { error } = await supabase.from('submission_archive').insert(archiveRows);
  if (error) throw error;
}

async function ensureStudentBelongsToClass(classId, studentId, client = supabase) {
  const { data, error } = await client
    .from('class_members')
    .select('class_id')
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Shared guard for teacher endpoints that act on a specific enrolled student.
// Returns { error, status } on failure, or { user, readClient } on success.
async function requireOwnedClassMember(req, { ownershipError }) {
  const { user, error: teacherError, status } = await requireTeacherProfile(req);
  if (teacherError) return { error: teacherError, status };
  const readClient = getRequestScopedSupabase(req);
  const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
  if (!ownedClass) return { error: ownershipError, status: 403 };
  const enrolledStudent = await ensureStudentBelongsToClass(req.params.classId, req.params.studentId, readClient);
  if (!enrolledStudent) return { error: 'That student is not enrolled in this class.', status: 404 };
  return { user, readClient };
}

async function ensureUserCanAccessClass(classId, userId, client = supabase) {
  const ownedClass = await ensureTeacherOwnsClass(classId, userId, client);
  if (ownedClass) return { role: 'teacher', classRecord: ownedClass };
  const enrolledClass = await ensureStudentBelongsToClass(classId, userId, client);
  if (enrolledClass) return { role: 'student', classRecord: enrolledClass };
  return null;
}

async function ensureStudentCanAccessAssignment(assignmentId, studentId, client = supabase) {
  const { data, error } = await client
    .from('assignments')
    .select('id, class_id, title, status')
    .eq('id', assignmentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.status !== 'published') return null;
  const enrolledClass = await ensureStudentBelongsToClass(data.class_id, studentId, client);
  if (!enrolledClass) return null;
  const { data: classRecord, error: classError } = await client
    .from('classes')
    .select('archived')
    .eq('id', data.class_id)
    .maybeSingle();
  if (classError) throw classError;
  return { ...data, classArchived: classRecord?.archived === true };
}

async function ensureStudentCanModifyAssignment(assignmentId, studentId, client = supabase) {
  const assignment = await ensureStudentCanAccessAssignment(assignmentId, studentId, client);
  return assignment && assignment.classArchived !== true ? assignment : null;
}

async function getSubmissionRecord(submissionId, client = supabase) {
  const { data, error } = await client
    .from('submissions')
    .select('id, assignment_id, student_id, status, teacher_review, version, updated_at, writing_events, keystroke_log')
    .eq('id', submissionId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Resolves append-only deltas sent by the client's auto-sync (Issue 1).
// The client uploads only new events as `<col>_append` plus the `<col>_base`
// length it expects the server to already hold. We read the current array, and
// if its length matches the base we concatenate and write the result into
// `payload[col]`. On any mismatch we return { conflict: true } so the caller
// can 409 and the client re-baselines with a full resend — no data is lost.
const APPEND_DELTA_FIELDS = [
  ['writing_events_append', 'writing_events_base', 'writing_events'],
  ['keystroke_log_append', 'keystroke_log_base', 'keystroke_log'],
];

async function applyAppendDeltas(reqBody, submission, payload) {
  const active = APPEND_DELTA_FIELDS.filter(([appendKey]) => Array.isArray(reqBody?.[appendKey]));
  if (!active.length) return { ok: true };
  for (const [appendKey, baseKey, col] of active) {
    const existing = Array.isArray(submission?.[col]) ? submission[col] : [];
    const base = Number(reqBody[baseKey] ?? 0);
    if (existing.length !== base) return { conflict: true };
    payload[col] = existing.concat(reqBody[appendKey]);
  }
  return { ok: true };
}

async function buildStudentPatchPayload(reqBody, submission, readClient) {
  let payload = { ...sanitizeStudentSubmissionPayload(reqBody), updated_at: new Date().toISOString() };
  const appended = await applyAppendDeltas(reqBody, submission, payload);
  if (!appended.conflict) {
    payload = mergeAppendOnlyProcessHistory(payload, submission);
  }
  return { conflict: appended.conflict === true, payload };
}

function getSubmissionTeacherReview(submission = {}) {
  return submission.teacher_review || submission.teacherReview || {};
}

function getSubmissionProcessInputHash(submission = {}, assignment = {}, profile = {}) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      submissionId: submission.id,
      assignmentId: submission.assignment_id || submission.assignmentId,
      studentId: submission.student_id || submission.studentId,
      finalText: submission.final_text || submission.finalText || '',
      draftText: submission.draft_text || submission.draftText || '',
      writingEvents: submission.writing_events || submission.writingEvents || [],
      keystrokeLog: submission.keystroke_log || submission.keystrokeLog || [],
      teacherReview: getSubmissionTeacherReview(submission),
      assignmentStatus: assignment.status || '',
      assignmentLevel: assignment.language_level || assignment.languageLevel || '',
      profileFlags: {
        isTestAccount: Boolean(profile.is_test_account || profile.isTestAccount),
        excludeFromWritingBehavior: Boolean(profile.exclude_from_writing_behavior || profile.excludeFromWritingBehavior),
      },
      updatedAt: submission.updated_at || submission.updatedAt || '',
    }))
    .digest('hex');
}

// Exclusion source recorded when profiles.exclude_from_writing_behavior is
// set (research-consent exclusion). It must never reach a non-admin client:
// sanitizeProcessAnalysisForViewer strips it from API responses, and the
// column grants keep it unreadable through PostgREST with a user token.
const PROFILE_EXCLUSION_SOURCE = 'profile_exclusion';

function getProcessAnalysisExclusionSources(submission = {}, profile = {}) {
  const sources = [];
  const review = getSubmissionTeacherReview(submission);
  if (profile?.is_test_account || profile?.isTestAccount) sources.push('test_account');
  if (review?.writingBehaviourExcluded || review?.writing_behaviour_excluded) sources.push('submission_flag');
  if (profile?.exclude_from_writing_behavior || profile?.excludeFromWritingBehavior) sources.push(PROFILE_EXCLUSION_SOURCE);
  return sources;
}

// Consent status must be invisible outside the admin role: for any other
// viewer (including the student themself) the analysis is reported as if the
// profile-level exclusion did not exist, so the UI renders identically for
// consenting and non-consenting students.
function sanitizeProcessAnalysisForViewer(result, viewerProfile) {
  if (viewerProfile?.role === 'admin') return result;
  const strip = (sources) => (Array.isArray(sources) ? sources.filter((source) => source !== PROFILE_EXCLUSION_SOURCE) : []);
  const analysis = result.analysis
    ? {
        ...result.analysis,
        exclusionSources: strip(result.analysis.exclusionSources),
        excludedFromAnalytics: strip(result.analysis.exclusionSources).length > 0,
      }
    : result.analysis;
  const stored = result.stored
    ? {
        ...result.stored,
        exclusion_sources: strip(result.stored.exclusion_sources),
        excluded_from_analytics: strip(result.stored.exclusion_sources).length > 0,
      }
    : result.stored;
  return { ...result, analysis, stored };
}

function buildProcessAnalysisPayload({ submission, assignment, profile, analysis, inputHash }) {
  return {
    submission_id: submission.id,
    assignment_id: submission.assignment_id || submission.assignmentId,
    class_id: assignment.class_id || assignment.classId || null,
    student_id: submission.student_id || submission.studentId,
    analysis_version: analysis.analysisVersion,
    input_hash: inputHash,
    process_status: analysis.status,
    process_status_label: analysis.statusLabel,
    reason: analysis.reason || '',
    metrics: analysis.metrics || {},
    timeline: analysis.timeline || [],
    evidence: analysis.evidence || [],
    paste_evidence: analysis.pasteEvidence || [],
    cohort_comparison: analysis.cohortComparison || {},
    coach_baseline: analysis.coachBaseline || {},
    excluded_from_analytics: Boolean(analysis.excludedFromAnalytics),
    exclusion_sources: analysis.exclusionSources || getProcessAnalysisExclusionSources(submission, profile),
    calculated_at: analysis.calculatedAt,
    updated_at: new Date().toISOString(),
  };
}

async function getProcessAnalysisContext(req, submissionId) {
  const user = await getUser(req);
  if (!user) return { status: 401, error: 'Not authenticated' };
  const viewerProfile = await getProfile(user.id);
  if (!viewerProfile) return { status: 409, error: ACCOUNT_SETUP_INCOMPLETE_MESSAGE };

  const readClient = getRequestScopedSupabase(req);
  const { data: submission, error: submissionError } = await readClient
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle();
  if (submissionError) return { status: 400, error: submissionError.message };
  if (!submission) return { status: 404, error: 'Submission not found' };

  const { data: assignment, error: assignmentError } = await readClient
    .from('assignments')
    .select('*')
    .eq('id', submission.assignment_id)
    .maybeSingle();
  if (assignmentError) return { status: 400, error: assignmentError.message };
  if (!assignment) return { status: 404, error: 'Assignment not found' };

  let allowed = false;
  if (viewerProfile.role === 'admin') {
    allowed = true;
  } else if (viewerProfile.role === 'student') {
    allowed = submission.student_id === user.id;
  } else if (viewerProfile.role === 'teacher') {
    const ownedAssignment = await ensureTeacherOwnsAssignment(assignment.id, user.id, readClient);
    allowed = Boolean(ownedAssignment);
  }
  if (!allowed) return { status: 403, error: 'You do not have access to this writing process analysis.' };

  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('id, name, role, is_test_account, exclude_from_writing_behavior')
    .eq('id', submission.student_id)
    .maybeSingle();

  return {
    status: 200,
    user,
    viewerProfile,
    submission,
    assignment,
    studentProfile: studentProfile || {},
  };
}

async function computeAndStoreProcessAnalysis(context, { store = true } = {}) {
  const exclusionSources = getProcessAnalysisExclusionSources(context.submission, context.studentProfile);
  const analysis = analyzeSubmission(context.submission, context.assignment, {
    excludedFromAnalytics: exclusionSources.length > 0,
    exclusionSources,
  });
  const inputHash = getSubmissionProcessInputHash(context.submission, context.assignment, context.studentProfile);
  const payload = buildProcessAnalysisPayload({
    submission: context.submission,
    assignment: context.assignment,
    profile: context.studentProfile,
    analysis,
    inputHash,
  });

  if (!store) return { analysis, inputHash, stored: null, storageError: null };

  const { data, error } = await supabase
    .from('submission_process_analyses')
    .upsert(payload, { onConflict: 'submission_id' })
    .select()
    .single();

  return {
    analysis,
    inputHash,
    stored: data || null,
    storageError: error ? error.message : null,
  };
}

function submissionHasProcessInput(submission = {}) {
  return Boolean(
    String(submission.final_text || submission.finalText || submission.draft_text || submission.draftText || '').trim()
    || (Array.isArray(submission.writing_events || submission.writingEvents) && (submission.writing_events || submission.writingEvents).length)
    || (Array.isArray(submission.keystroke_log || submission.keystrokeLog) && (submission.keystroke_log || submission.keystrokeLog).length)
  );
}

function buildProcessAnalysisLookup(assignments, analyses, profilesResult) {
  const profiles = profilesResult.error && isMissingProfileFlagColumn(profilesResult.error)
    ? []
    : (profilesResult.data || []);
  return {
    assignmentById: new Map((assignments || []).map((assignment) => [assignment.id, assignment])),
    analysisBySubmissionId: new Map((analyses || []).map((analysis) => [analysis.submission_id, analysis])),
    profileById: new Map(profiles.map((profile) => [profile.id, profile])),
  };
}

function collectStaleProcessAnalysisContexts(submissions, lookups, cappedLimit) {
  const staleContexts = [];
  let checked = 0;
  let stale = 0;
  let skipped = 0;

  for (const submission of (submissions || [])) {
    const assignment = lookups.assignmentById.get(submission.assignment_id);
    if (!assignment || !submissionHasProcessInput(submission)) {
      skipped += 1;
      continue;
    }

    checked += 1;
    const studentProfile = lookups.profileById.get(submission.student_id) || {};
    const inputHash = getSubmissionProcessInputHash(submission, assignment, studentProfile);
    const existing = lookups.analysisBySubmissionId.get(submission.id);
    const isStale = !existing
      || existing.analysis_version !== ANALYSIS_VERSION
      || existing.input_hash !== inputHash;

    if (!isStale) continue;
    stale += 1;
    if (staleContexts.length < cappedLimit) {
      staleContexts.push({ submission, assignment, studentProfile, inputHash });
    }
  }

  return { staleContexts, checked, stale, skipped };
}

async function recomputeProcessAnalysisContexts(staleContexts) {
  const storageWarnings = [];
  let recomputed = 0;
  for (const context of staleContexts) {
    const result = await computeAndStoreProcessAnalysis(context, { store: true });
    if (result.storageError) {
      storageWarnings.push({
        submissionId: context.submission.id,
        error: result.storageError,
      });
    } else {
      recomputed += 1;
    }
  }
  return { storageWarnings, recomputed };
}

async function recomputeStaleProcessAnalyses({ limit = 50 } = {}) {
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const { data: assignments, error: assignmentError } = await supabase
    .from('assignments')
    .select('*');
  if (assignmentError) throw assignmentError;

  const assignmentIds = (assignments || []).map((assignment) => assignment.id).filter(Boolean);
  if (!assignmentIds.length) {
    return {
      analysisVersion: ANALYSIS_VERSION,
      checked: 0,
      stale: 0,
      recomputed: 0,
      skipped: 0,
      remainingEstimate: 0,
      storageWarnings: [],
    };
  }

  const [
    submissionsResult,
    analysesResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from('submissions')
      .select('*'),
    supabase
      .from('submission_process_analyses')
      .select('submission_id, analysis_version, input_hash'),
    supabase
      .from('profiles')
      .select('id, name, role, is_test_account, exclude_from_writing_behavior'),
  ]);

  if (submissionsResult.error) throw submissionsResult.error;
  if (analysesResult.error) throw analysesResult.error;
  if (profilesResult.error && !isMissingProfileFlagColumn(profilesResult.error)) throw profilesResult.error;

  const lookups = buildProcessAnalysisLookup(assignments, analysesResult.data, profilesResult);
  const { staleContexts, checked, stale, skipped } = collectStaleProcessAnalysisContexts(
    submissionsResult.data,
    lookups,
    cappedLimit
  );
  const { storageWarnings, recomputed } = await recomputeProcessAnalysisContexts(staleContexts);

  return {
    analysisVersion: ANALYSIS_VERSION,
    checked,
    stale,
    recomputed,
    skipped,
    limit: cappedLimit,
    remainingEstimate: Math.max(0, stale - staleContexts.length),
    storageWarnings,
  };
}

// ── Per-user abuse guards (in-memory; reset on server restart) ──
// These are NOT hard quotas for normal use — they sit far above what a real
// teacher or student would ever hit. They exist to blunt a compromised or
// fake account (e.g. someone who registers just to drain the Anthropic bill).

// Rubric parsing: a teacher has no reason to parse more than a handful of
// rubrics a day. Cap per user per calendar day.
const RUBRIC_DAILY_MAX = 10;
const rubricUsageByUser = new Map(); // userId -> { day, count }

function checkRubricQuota(userId) {
  const day = new Date().toISOString().slice(0, 10);
  let rec = rubricUsageByUser.get(userId);
  if (rec?.day !== day) {
    rec = { day, count: 0 };
    rubricUsageByUser.set(userId, rec);
  }
  if (rec.count >= RUBRIC_DAILY_MAX) return false;
  rec.count += 1;
  return true;
}

// Chat / AI generate: no hard cap (a student may legitimately chat a lot),
// but a velocity breaker with escalating cooldowns. A human types with pauses;
// a bot or script fires in bursts. Each successive trip ratchets up the lockout
// so cycling burst → cooldown → burst quickly becomes a 24-hour block.
const AI_BURST_WINDOW_MS = 30000;
const AI_BURST_MAX = 12;       // >12 calls in 30s is not human pacing
const AI_HOURLY_WINDOW_MS = 3600000;
const AI_HOURLY_MAX = 150;     // sustained ceiling no real user reaches
const AI_COOLDOWN_TIERS_MS = [300000, 900000, 3600000, 86400000]; // 5m, 15m, 1h, 24h
const AI_OFFENCE_DECAY_MS = 3600000; // 1h with no new trip resets the escalation tier
const aiUsageByUser = new Map(); // userId -> { hits: number[], cooldownUntil, offences, lastTripAt }

function checkAiVelocity(userId) {
  const now = Date.now();
  let rec = aiUsageByUser.get(userId);
  if (!rec) {
    rec = { hits: [], cooldownUntil: 0, offences: 0, lastTripAt: 0 };
    aiUsageByUser.set(userId, rec);
  }
  if (now < rec.cooldownUntil) {
    return { allowed: false, retryAfter: Math.ceil((rec.cooldownUntil - now) / 1000) };
  }
  // Decay the escalation tier after a sustained clean period so occasional trips
  // days apart (normal classroom bursts) don't compound toward a 24h lockout.
  if (rec.offences > 0 && now - rec.lastTripAt > AI_OFFENCE_DECAY_MS) {
    rec.offences = 0;
  }
  rec.hits = rec.hits.filter((t) => now - t < AI_HOURLY_WINDOW_MS);
  const burstCount = rec.hits.filter((t) => now - t < AI_BURST_WINDOW_MS).length;
  if (burstCount >= AI_BURST_MAX || rec.hits.length >= AI_HOURLY_MAX) {
    const tier = Math.min(rec.offences, AI_COOLDOWN_TIERS_MS.length - 1);
    const cooldownMs = AI_COOLDOWN_TIERS_MS[tier];
    rec.offences += 1;
    rec.lastTripAt = now;
    rec.cooldownUntil = now + cooldownMs;
    return { allowed: false, retryAfter: Math.ceil(cooldownMs / 1000) };
  }
  rec.hits.push(now);
  return { allowed: true, retryAfter: 0 };
}

// ── Rubric parsing endpoints ────────────────────────────────
// Multer failures (oversized file, malformed multipart, unexpected field) are
// raised in connect middleware BEFORE the route handler runs, so the route's
// try/catch never sees them and Express would emit a bare HTML 500. Wrap the
// upload so those failures come back as a clean JSON error.
function uploadRubricSingle(req, res, next) {
  upload.single("rubric")(req, res, (err) => {
    if (err) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";

      return res.status(tooBig ? 413 : 400).json({
        success: false,
        error: tooBig
          ? "That file is too large (max 5 MB). Upload a smaller PDF / Word file, or paste the rubric text."
          : "We couldn't read that upload. Please use a PDF or Word file, or paste the rubric text.",
      });
    }

    return next();
  });
}

// A rubric the parser can't read (scanned/image PDF, empty, corrupt, or
// password-protected file) is a client-side problem, not a server fault.
function rubricParseErrorStatus(error) {
  if (error?.code === "RUBRIC_UNREADABLE") return 422;
  if (error?.code === "RUBRIC_PARSE_TIMEOUT") return 504;
  return 500;
}

async function handleRubricFileParse(req, res, { legacyShape = false } = {}) {
  try {
    const { user, error, status } = await requireRubricTeacherProfile(req);

    if (error) {
      return res.status(status).json(
        legacyShape
          ? { error }
          : {
              success: false,
              error,
            }
      );
    }

    if (!checkRubricQuota(user.id)) {
      return res.status(429).json(
        legacyShape
          ? {
              error:
                "Daily rubric parsing limit reached. Please try again tomorrow.",
            }
          : {
              success: false,
              error:
                "Daily rubric parsing limit reached. Please try again tomorrow.",
            }
      );
    }

    if (!req.file) {
      return res.status(400).json(
        legacyShape
          ? { error: "No file uploaded" }
          : {
              success: false,
              error: "No file uploaded.",
            }
      );
    }

    const { text, schema, rubricData } = await parseRubricBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (legacyShape) {
      return res.json({
        text,
        schema,
        rubricData,
      });
    }

    return res.json({
      success: true,
      text,
      schema,
      rubricData,
    });
  } catch (error) {
    return res.status(rubricParseErrorStatus(error)).json(
      legacyShape
        ? { error: error.message }
        : {
            success: false,
            error: error.message,
          }
    );
  }
}

app.post("/api/rubric/parse", uploadRubricSingle, async (req, res) => {
  return handleRubricFileParse(req, res);
});

const RUBRIC_PARSE_JOB_TTL_MS = 10 * 60 * 1000;
const rubricParseJobs = new Map();

function pruneRubricParseJobs() {
  const oldestAllowed = Date.now() - RUBRIC_PARSE_JOB_TTL_MS;
  for (const [jobId, job] of rubricParseJobs.entries()) {
    if (Number(job?.createdAt || 0) < oldestAllowed) {
      rubricParseJobs.delete(jobId);
    }
  }
}

// Netlify external proxy rewrites time out after 26 seconds. Start parsing in
// the Render process and return immediately so the browser can poll using
// short requests instead of holding one long proxy connection open.
app.post("/api/rubric/parse-jobs", uploadRubricSingle, async (req, res) => {
  try {
    const { user, error, status } = await requireRubricTeacherProfile(req);
    if (error) {
      return res.status(status).json({ success: false, error });
    }
    if (!checkRubricQuota(user.id)) {
      return res.status(429).json({
        success: false,
        error: "Daily rubric parsing limit reached. Please try again tomorrow.",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded.",
      });
    }

    pruneRubricParseJobs();
    const jobId = crypto.randomUUID();
    rubricParseJobs.set(jobId, {
      createdAt: Date.now(),
      ownerId: user.id,
      status: "processing",
    });

    void parseRubricBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    ).then((result) => {
      const job = rubricParseJobs.get(jobId);
      if (!job) return;
      rubricParseJobs.set(jobId, {
        ...job,
        status: "complete",
        result,
      });
    }).catch((parseError) => {
      const job = rubricParseJobs.get(jobId);
      if (!job) return;
      rubricParseJobs.set(jobId, {
        ...job,
        status: "failed",
        error: parseError?.message || "The rubric could not be parsed.",
      });
    });

    return res.status(202).json({
      success: true,
      jobId,
      status: "processing",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/rubric/parse-jobs/:jobId", async (req, res) => {
  try {
    const { user, error, status } = await requireRubricTeacherProfile(req);
    if (error) {
      return res.status(status).json({ success: false, error });
    }

    pruneRubricParseJobs();
    const jobId = String(req.params.jobId || "");
    const job = rubricParseJobs.get(jobId);
    if (!job || job.ownerId !== user.id) {
      return res.status(404).json({
        success: false,
        error: "Rubric parsing job was not found. Please upload the file again.",
      });
    }
    if (job.status === "processing") {
      return res.status(202).json({ success: true, status: "processing" });
    }

    rubricParseJobs.delete(jobId);
    if (job.status === "failed") {
      return res.status(422).json({ success: false, error: job.error });
    }

    return res.json({
      success: true,
      status: "complete",
      ...job.result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Alias for the new React frontend naming.
app.get('/api/rubrics', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const client = getRequestScopedSupabase(req);
    const { data, error: queryError } = await client
      .from('rubric_library')
      .select('*')
      .eq('owner_id', user.id)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });
    if (queryError) {
      // Reusable rubrics are optional until the rubric-library migration is
      // installed. Assignment creation still embeds its rubric on the
      // assignment itself, so an absent library must not break the builder.
      if (isMissingRelation(queryError)) {
        return res.json({ rubrics: [], libraryAvailable: false });
      }
      return res.status(400).json({ error: queryError.message });
    }
    res.json({ rubrics: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rubrics', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const rubricSchema = req.body?.rubric_schema || req.body?.rubricSchema || {};
    const title = String(req.body?.title || rubricSchema.title || 'Untitled rubric').trim();
    const { data, error: writeError } = await writeWithRequestScopedFallback(req, (client) =>
      client.from('rubric_library').insert({
        owner_id: user.id,
        title,
        rubric_schema: rubricSchema,
        status: String(req.body?.status || 'active').toLowerCase(),
      }).select().single()
    );
    if (writeError) return res.status(400).json({ error: writeError.message });
    res.json({ rubric: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/rubrics/:id', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const patch = {};
    if (req.body?.title !== undefined) patch.title = String(req.body.title).trim();
    if (req.body?.rubric_schema !== undefined || req.body?.rubricSchema !== undefined) {
      patch.rubric_schema = req.body.rubric_schema || req.body.rubricSchema;
    }
    if (req.body?.status !== undefined) patch.status = String(req.body.status).toLowerCase();
    const { data, error: writeError } = await writeWithRequestScopedFallback(req, (client) =>
      client.from('rubric_library').update(patch)
        .eq('id', req.params.id).eq('owner_id', user.id).select().maybeSingle()
    );
    if (writeError) return res.status(400).json({ error: writeError.message });
    if (!data) return res.status(404).json({ error: 'Rubric not found.' });
    res.json({ rubric: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rubrics/:id', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const { data, error: writeError } = await writeWithRequestScopedFallback(req, (client) =>
      client.from('rubric_library').update({ status: 'archived' })
        .eq('id', req.params.id).eq('owner_id', user.id).select('id').maybeSingle()
    );
    if (writeError) return res.status(400).json({ error: writeError.message });
    if (!data) return res.status(404).json({ error: 'Rubric not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Durable, per-teacher assignment-builder recovery state.
app.get('/api/assignment-builder-draft', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const client = getRequestScopedSupabase(req);
    const { data, error: readError } = await client
      .from('assignment_builder_drafts')
      .select('draft_state, updated_at')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (readError) return res.status(400).json({ error: readError.message });
    res.json({ draft: data?.draft_state || null, updatedAt: data?.updated_at || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/assignment-builder-draft', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const draftState = req.body?.draft;
    if (!draftState || typeof draftState !== 'object' || Array.isArray(draftState)) {
      return res.status(400).json({ error: 'A valid assignment draft is required.' });
    }
    const { data, error: writeError } = await writeWithRequestScopedFallback(req, (client) =>
      client.from('assignment_builder_drafts').upsert({
        owner_id: user.id,
        draft_state: draftState,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' }).select('updated_at').single()
    );
    if (writeError) return res.status(400).json({ error: writeError.message });
    res.json({ ok: true, updatedAt: data.updated_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/assignment-builder-draft', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const { error: deleteError } = await writeWithRequestScopedFallback(req, (client) =>
      client.from('assignment_builder_drafts').delete().eq('owner_id', user.id)
    );
    if (deleteError) return res.status(400).json({ error: deleteError.message });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/rubrics/parse", uploadRubricSingle, async (req, res) => {
  return handleRubricFileParse(req, res);
});

// Legacy endpoint kept for compatibility with the old frontend.
app.post("/api/extract-rubric", uploadRubricSingle, async (req, res) => {
  return handleRubricFileParse(req, res, { legacyShape: true });
});

app.post("/api/rubric/parse-text", async (req, res) => {
  try {
    const { user, error, status } = await requireRubricTeacherProfile(req);

    if (error) {
      return res.status(status).json({
        success: false,
        error,
      });
    }

    if (!checkRubricQuota(user.id)) {
      return res.status(429).json({
        success: false,
        error: "Daily rubric parsing limit reached. Please try again tomorrow.",
      });
    }

    const text = String(req.body?.text || "").trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Text is required.",
      });
    }

    const parsed = await parseRubricText(text, "Pasted rubric");

    return res.json({
      success: true,
      text: parsed.text,
      schema: parsed.schema,
      rubricData: parsed.rubricData,
    });
  } catch (error) {
    return res.status(rubricParseErrorStatus(error)).json({
      success: false,
      error: error.message,
    });
  }
});
// ── AI endpoint ─────────────────────────────────────────────
let aiRequestsInFlight = 0;
// Server-wide cap on simultaneous in-flight AI calls. Sized to cover a full
// class (~15-20 students) so our own server never turns a student away during
// a synchronized "everyone generate now" moment; it stays low enough to act as
// a shock absorber that keeps us inside Anthropic's per-minute token budget.
// When this trips, the client retries after a short backoff (the 429 below is
// flagged retryable), so students see a brief pause rather than an error.
const AI_MAX_CONCURRENT = 20;

// ~50k tokens of input — far above any real chat/feedback/grading payload,
const MAX_AI_INPUT_CHARS = 200000;

// Draft review can take longer because Claude reads the essay,
// checks assignment context, returns JSON, and finds exact excerpts.
const AI_TIMEOUT_MS = clampNumber(process.env.AI_TIMEOUT_MS, {
  min: 20000,
  max: 180000,
  fallback: 120000,
});
const AI_UPSTREAM_RETRY_DELAYS_MS = [350, 900];

// Netlify external proxy rewrites have a fixed request-duration ceiling. Keep
// slow AI work on Render and let the browser poll with short authenticated
// requests instead of holding one proxy connection open.
const AI_JOB_TTL_MS = 10 * 60 * 1000;
const AI_JOB_TARGETS = new Map([
  ["generate", "/api/generate"],
  ["teacher-review", "/api/teacher/ai-review-submission"],
]);
const aiJobs = new Map();

function pruneAiJobs() {
  const oldestAllowed = Date.now() - AI_JOB_TTL_MS;
  for (const [jobId, job] of aiJobs.entries()) {
    if (Number(job?.createdAt || 0) < oldestAllowed) aiJobs.delete(jobId);
  }
}

async function executeAiJob({ jobId, targetPath, payload, cookie, localPort }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    Math.min(185_000, AI_TIMEOUT_MS + 5_000)
  );

  try {
    const response = await fetch(`http://127.0.0.1:${localPort}${targetPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    const job = aiJobs.get(jobId);
    if (!job) return;
    aiJobs.set(jobId, response.ok && !result.error
      ? { ...job, status: "complete", result }
      : {
          ...job,
          status: "failed",
          httpStatus: response.status,
          retryable: result.retryable === true,
          error: result.error || `AI request failed (${response.status}).`,
        });
  } catch (error) {
    const job = aiJobs.get(jobId);
    if (!job) return;
    aiJobs.set(jobId, {
      ...job,
      status: "failed",
      httpStatus: error?.name === "AbortError" ? 504 : 503,
      retryable: error?.name !== "AbortError",
      error: error?.name === "AbortError"
        ? "AI request timed out. Please try again."
        : "The AI connection was interrupted. Please try again.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

app.post("/api/ai-jobs", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const target = String(req.body?.target || "");
  const targetPath = AI_JOB_TARGETS.get(target);
  if (!targetPath) return res.status(400).json({ error: "Unsupported AI job target." });

  pruneAiJobs();
  const jobId = crypto.randomUUID();
  aiJobs.set(jobId, {
    createdAt: Date.now(),
    ownerId: user.id,
    status: "processing",
  });

  void executeAiJob({
    jobId,
    targetPath,
    payload: req.body?.payload || {},
    cookie: String(req.headers.cookie || ""),
    localPort: req.socket.localPort,
  });

  return res.status(202).json({ jobId, status: "processing" });
});

app.get("/api/ai-jobs/:jobId", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  pruneAiJobs();
  const jobId = String(req.params.jobId || "");
  const job = aiJobs.get(jobId);
  if (!job || job.ownerId !== user.id) {
    return res.status(404).json({ error: "AI job was not found. Please try again." });
  }
  if (job.status === "processing") {
    return res.status(202).json({ status: "processing" });
  }

  aiJobs.delete(jobId);
  if (job.status === "failed") {
    return res.status(job.httpStatus || 500).json({
      error: job.error || "AI request failed.",
      retryable: job.retryable === true,
    });
  }
  return res.json({ status: "complete", result: job.result || {} });
});

function waitForAiRetry(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableAiTransportError(error) {
  const code = String(error?.cause?.code || error?.code || "").toUpperCase();
  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "EPIPE",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ].includes(code);
}

function aiInputCharCount(prompt, messages, system) {
  let total = String(system || '').length + String(prompt || '').length;
  if (Array.isArray(messages)) {
    for (const m of messages) {
      total += typeof m?.content === 'string' ? m.content.length : JSON.stringify(m?.content || '').length;
    }
  }
  return total;
}

app.post('/api/generate', async (req, res) => {
  const requestHost = String(req.headers.host || "").split(":")[0];

  const skipAiAuthForTest =
  (
    process.env.DEV_SKIP_AI_AUTH === "true" &&
    isLocalDevRequest(req)
  ) ||
  isTrustedDemoRequest(req);

const user = skipAiAuthForTest
  ? {
      id: "demo-ai-test-user",
    }
  : await getUser(req);

  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { prompt, messages, system, maxTokens, temperature } = req.body;
  if (messages && !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array.' });
  }
  if (aiInputCharCount(prompt, messages, system) > MAX_AI_INPUT_CHARS) {
    return res.status(413).json({ error: 'Your request is too large. Please shorten it and try again.' });
  }
  // Concurrency gate FIRST: a request bounced for transient contention must not
  // count against the user's velocity budget. Otherwise classroom congestion
  // (14 students clicking "generate" at once, each client retrying the busy-429)
  // would push legitimate students toward the burst limit and its cooldowns.
  if (aiRequestsInFlight >= AI_MAX_CONCURRENT) {
    // Flagged retryable so the client distinguishes this from the velocity-breaker
    // 429 below and retries only this one after a brief wait.
    return res.status(429).json({ error: 'AI is busy right now. Please try again in a moment.', retryable: true });
  }
  const velocity = checkAiVelocity(user.id);
  if (!velocity.allowed) {
    res.set('Retry-After', String(velocity.retryAfter));
    return res.status(429).json({ error: 'Too many requests in a short time. Please wait a few minutes and try again.' });
  }
  aiRequestsInFlight++;
  try {
    const apiMessages = (messages || [{ role: "user", content: prompt }])
      .map(({ role, content }) => ({ role, content }));
    const requestBody = {
      model: "claude-sonnet-4-6",
      max_tokens: clampNumber(maxTokens, { min: 200, max: 2500, fallback: 1000 }),
      messages: apiMessages,
    };
    if (system) requestBody.system = system;
    const safeTemperature = clampNumber(temperature, { min: 0, max: 1, fallback: null });
    if (safeTemperature !== null) requestBody.temperature = safeTemperature;

    const aiAbortController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiAbortController.abort(), AI_TIMEOUT_MS);
    let response;
    try {
      for (let attempt = 0; attempt <= AI_UPSTREAM_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
            signal: aiAbortController.signal,
          });
        } catch (error) {
          if (
            error?.name === 'AbortError' ||
            !isRetryableAiTransportError(error) ||
            attempt >= AI_UPSTREAM_RETRY_DELAYS_MS.length
          ) {
            throw error;
          }
          await waitForAiRetry(AI_UPSTREAM_RETRY_DELAYS_MS[attempt]);
          continue;
        }

        if (
          ![429, 500, 502, 503, 504, 529].includes(response.status) ||
          attempt >= AI_UPSTREAM_RETRY_DELAYS_MS.length
        ) {
          break;
        }
        await waitForAiRetry(AI_UPSTREAM_RETRY_DELAYS_MS[attempt]);
      }
    } finally {
      clearTimeout(aiTimeoutId);
    }

    const data = await response.json();
    if (!response.ok) {
      // Upstream rate-limit (429), overload (529), or transient unavailability
      // (503): tell the client to retry with backoff instead of hard-failing the
      // student mid-class. The client only auto-retries 429s flagged retryable,
      // so map these onto that path rather than relaying the raw status.
      if (response.status === 429 || response.status === 503 || response.status === 529) {
        return res.status(429).json({ error: 'AI is busy right now. Please try again in a moment.', retryable: true });
      }
      return res.status(response.status).json({ error: data?.error?.message || 'AI request failed.' });
    }
    const text = data?.content?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'AI returned an empty response. Please try again.' });
    res.json({ response: text });
  } catch (error) {
    if (error.name === 'AbortError') return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    if (isRetryableAiTransportError(error)) {
      return res.status(503).json({
        error: 'The AI connection was interrupted. Please try again.',
        retryable: true,
      });
    }
    res.status(500).json({ error: error.message });
  } finally {
    aiRequestsInFlight--;
  }
});

// ── Auth endpoints ───────────────────────────────────────────

function validateSignupPayload({ email, password, name, role }, signupCode) {
  if (!email || !password || !name || !role) return 'email, password, name and role are required';
  if (!['student', 'teacher'].includes(role)) return 'Please choose student or teacher.';
  if (!isAuiEmail(email)) return 'Access is restricted to @aui.ma accounts.';
  // Optional gate: when TEACHER_SIGNUP_CODE is set, teacher self-signup requires
  // it, so a public pilot URL can't be used to mint teacher accounts (which can
  // spend the AI budget). Inert when the env var is unset — default unchanged.
  if (role === 'teacher' && process.env.TEACHER_SIGNUP_CODE && signupCode !== process.env.TEACHER_SIGNUP_CODE) {
    return 'Teacher sign-up is restricted. Please contact an administrator.';
  }
  return validatePasswordStrength(password);
}

async function deleteSignupUser(userId, email) {
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error('ORPHAN AUTH USER - manual cleanup needed:', {
        userRef: safeLogId(userId),
        emailRef: safeLogId(email),
        reason: safeLogError(error),
      });
    }
  } catch (error) {
    console.error('ORPHAN AUTH USER - manual cleanup needed:', {
      userRef: safeLogId(userId),
      emailRef: safeLogId(email),
      reason: safeLogError(error),
    });
  }
}

async function createSignupProfile(
  userId,
  name,
  role,
  email = null
) {
  if (USE_POSTGRES_APP_DB) {
    try {
      const { rows } = await db.query(
        `INSERT INTO public.profiles
          (id, name, role, email)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          userId,
          name,
          role,
          normalizeEmail(email),
        ]
      );

      return {
        data: rows[0] || null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error,
      };
    }
  }

  return supabase
    .from('profiles')
    .insert({
      id: userId,
      name,
      role,
      email,
    })
    .select()
    .single();
}

function isAuiEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith('@aui.ma');
}

function authDeliveryErrorMessage() {
  return 'We could not send the verification code right now. Please try again in a minute.';
}

// Sign up
app.post('/api/auth/signup', async (req, res) => {
  let createdUserId = null;
  let createdUserEmail = null;
  try {
    const { email, password, name, role, signupCode, otpCode } = req.body;
    const cleanEmail = normalizeEmail(email);
    const cleanName = String(name || '').trim();
    const validationError = validateSignupPayload({ email: cleanEmail, password, name: cleanName, role }, signupCode);
    if (validationError) return res.status(400).json({ error: validationError });
    if (!/^\d{6}$/.test(String(otpCode || '').trim())) {
      return res.status(400).json({ error: 'A valid 6-digit verification code is required.' });
    }

    const otpCheck = await verifyOtpCode(cleanEmail, OTP_PURPOSE_SIGNUP, otpCode);
    if (!otpCheck.ok) {
      return res.status(400).json({ error: otpCheck.error });
    }

    const existingUser = await getAuthUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      user_metadata: { name: cleanName, role },
      email_confirm: true,
    });
    if (error) return res.status(400).json({ error: error.message });
    createdUserId = data?.user?.id || null;
    createdUserEmail = data?.user?.email || cleanEmail;
    if (!createdUserId) return res.status(500).json({ error: SIGNUP_PROFILE_ERROR_MESSAGE });

    const { data: profile, error: profileError } = await createSignupProfile(createdUserId, cleanName, role, cleanEmail);
    if (profileError || !profile) {
      await deleteSignupUser(createdUserId, createdUserEmail);
      return res.status(500).json({ error: SIGNUP_PROFILE_ERROR_MESSAGE });
    }

    return res.status(201).json({ profile: sanitizeProfileForClient(profile) });
  } catch (error) {
    if (createdUserId) await deleteSignupUser(createdUserId, createdUserEmail || req.body?.email);
    res.status(500).json({ error: createdUserId ? SIGNUP_PROFILE_ERROR_MESSAGE : error.message });
  }
});

app.post('/api/auth/signup/request-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '').trim();
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    if (!isAuiEmail(email)) {
      return res.status(400).json({ error: 'Access is restricted to @aui.ma accounts.' });
    }
    if (!canSendNotificationEmails()) {
      return res.status(503).json({ error: 'Verification email is not configured on the server yet.' });
    }

    const existingUser = await getAuthUserByEmail(email);
    if (existingUser) {
      return res.json({ ok: true, resendSeconds: OTP_RESEND_SECONDS });
    }

    const result = await requestEmailOtp({
      email,
      purpose: OTP_PURPOSE_SIGNUP,
      subject: 'DO NOT REPLY: PRAXISWRITE SIGNUP VERIFICATION CODE',
      introLine: 'Use this code to verify your email address and complete your PraxisWrite sign-up.',
      safetyLine: 'If you did not request this email, you can safely ignore it.',
      recipientName: name,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, retryAfterSeconds: result.retryAfterSeconds || 0 });
    }

    return res.json({ ok: true, resendSeconds: result.resendSeconds });
  } catch (error) {
    console.error('Signup code email dispatch failed:', errorClassForLog(error));
    res.status(500).json({ error: authDeliveryErrorMessage() });
  }
});

function buildBenchmarkLevelBucket(level) {
  return {
    level,
    total: 0,
    included: 0,
    excluded: 0,
    typingRates: [],
    longPausesPer100w: [],
    localRevisionsPer100w: [],
    productProcessRatios: [],
    pasteShares: [],
  };
}

function addBenchmarkMetric(bucket, metrics, key, target) {
  if (Number.isFinite(Number(metrics[key]))) bucket[target].push(metrics[key]);
}

function groupBenchmarkMetricsByLevel(submissions, assignmentById, excludedStudentIds) {
  const byLevel = {};
  for (const submission of submissions || []) {
    const assignment = assignmentById[submission.assignment_id] || {};
    const level = String(assignment.language_level || 'B1').trim().toUpperCase();
    const review = submission.teacher_review || {};
    const isExcluded = excludedStudentIds.has(submission.student_id)
      || Boolean(review.writingBehaviourExcluded || review.writing_behaviour_excluded);
    byLevel[level] ||= buildBenchmarkLevelBucket(level);
    byLevel[level].total += 1;
    if (isExcluded) {
      byLevel[level].excluded += 1;
      continue;
    }

    byLevel[level].included += 1;
    const analysis = analyzeSubmission(submission, assignment, {
      excludedFromAnalytics: false,
      exclusionSources: [],
    });
    if (analysis.status === 'not_enough_writing_data') continue;

    const metrics = analysis.metrics || {};
    addBenchmarkMetric(byLevel[level], metrics, 'typingRate', 'typingRates');
    addBenchmarkMetric(byLevel[level], metrics, 'longPausesPer100w', 'longPausesPer100w');
    addBenchmarkMetric(byLevel[level], metrics, 'localRevisionsPer100w', 'localRevisionsPer100w');
    addBenchmarkMetric(byLevel[level], metrics, 'productProcessRatio', 'productProcessRatios');
    addBenchmarkMetric(byLevel[level], metrics, 'pasteShare', 'pasteShares');
  }
  return byLevel;
}

// Sign in
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password, stayLoggedIn = true } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    const rateLimit = checkSigninRateLimit(req, cleanEmail);
    if (rateLimit.blocked) {
      res.set('Retry-After', String(rateLimit.retryAfterSeconds));
      const isShortCooldown = rateLimit.reason === 'cooldown';
      return res.status(429).json({
        error: isShortCooldown
          ? 'Too many recent sign-in attempts for this account. Please wait a few seconds and try again.'
          : 'Too many sign-in attempts. Please try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    if (!isAuiEmail(cleanEmail)) {
      registerSigninFailure(req, cleanEmail);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const { data, error } = await supabaseUserAuth.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      registerSigninFailure(req, cleanEmail);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const profile = await getProfile(data.user.id);
    if (!profile) {
      registerSigninFailure(req, cleanEmail);
      return res.status(409).json({ error: ACCOUNT_SETUP_INCOMPLETE_MESSAGE });
    }

    clearSigninFailures(req, cleanEmail);
    setAuthCookies(req, res, data.session, Boolean(stayLoggedIn));
    res.json({ profile: sanitizeProfileForClient(profile) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh expired Supabase session
app.post('/api/auth/refresh', async (req, res) => {
  try {
    if (req.sessionInactive === true) {
      return res.status(401).json({ error: 'Session expired due to inactivity.' });
    }
    const refresh_token = req.body?.refresh_token || getCookieValue(req, 'praxis_rt');
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

    const stayLoggedIn = req.body?.stayLoggedIn === true || getCookieValue(req, 'praxis_rm') !== '0';

    const { data, error } = await supabaseUserAuth.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: error.message });

    setAuthCookies(req, res, data.session, stayLoggedIn);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sign out
app.post('/api/auth/signout', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (token) await supabase.auth.admin.signOut(token);
  } catch (error) {
    clearAuthCookies(req, res);
    return res.status(500).json({ error: error.message });
  }
  clearAuthCookies(req, res);
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    if (!canSendNotificationEmails()) {
      return res.status(503).json({ error: 'Verification email is not configured on the server yet.' });
    }

    const user = await getAuthUserByEmail(email);
    if (!user || !isAuiEmail(email)) {
      return res.json({ ok: true, resendSeconds: OTP_RESEND_SECONDS });
    }

    const result = await requestEmailOtp({
      email,
      purpose: OTP_PURPOSE_PASSWORD_RESET,
      subject: 'DO NOT REPLY: PRAXISWRITE PASSWORD RESET CODE',
      introLine: 'Use this code to reset your PraxisWrite password.',
      safetyLine: 'If you did not request a password reset, you can safely ignore this email.',
      recipientName: 'User',
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, retryAfterSeconds: result.retryAfterSeconds || 0 });
    }

    return res.json({ ok: true, resendSeconds: result.resendSeconds });
  } catch (error) {
    console.error('Forgot-password code email dispatch failed:', errorClassForLog(error));
    res.status(500).json({ error: authDeliveryErrorMessage() });
  }
});

app.post('/api/auth/forgot-password/reset', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !code || !password) {
      return res.status(400).json({ error: 'Email, code and password are required.' });
    }
    if (!isAuiEmail(email)) {
      return res.status(400).json({ error: 'Access is restricted to @aui.ma accounts.' });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const otpCheck = await verifyOtpCode(email, OTP_PURPOSE_PASSWORD_RESET, code);
    if (!otpCheck.ok) {
      return res.status(400).json({ error: otpCheck.error });
    }

    const user = await getAuthUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) return res.status(400).json({ error: error.message });

    return res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/update-password', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const password = String(req.body?.password || '');
    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/status', async (req, res) => {
  try {
    const { error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    res.json({
      emailEnabled: canSendNotificationEmails(),
      hasResendApiKey: Boolean(RESEND_API_KEY),
      hasFromEmail: Boolean(NOTIFY_FROM_EMAIL),
      publicBaseUrl: getConfiguredPublicBaseUrl(),
      forgotPasswordRedirectTo: appendResetQuery(getPasswordResetBaseUrl(req, req.query?.redirectTo)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bug-reports', async (req, res) => {
  let uploadedPath = null;
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const profile = await getProfile(user.id);
    if (!profile) return res.status(409).json({ error: ACCOUNT_SETUP_INCOMPLETE_MESSAGE });
    const description = String(req.body?.description || '').trim();
    if (description.length < 10 || description.length > 5000) {
      return res.status(400).json({ error: 'Description must be between 10 and 5000 characters.' });
    }
    let attachment = null;
    try {
      attachment = decodeBugReportAttachment(req.body?.screenshot || null);
    } catch (error) {
      const status = /3 MB or smaller/.test(error.message) ? 413 : 400;
      return res.status(status).json({ error: error.message });
    }

    const reportId = crypto.randomUUID();
    if (attachment) {
      const attachmentPath = `${user.id}/${reportId}/${attachment.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUG_REPORT_BUCKET)
        .upload(attachmentPath, attachment.buffer, {
          contentType: attachment.mimeType,
          upsert: false,
        });
      if (uploadError) {
        return res.status(400).json({ error: `Screenshot upload failed: ${uploadError.message}` });
      }
      uploadedPath = attachmentPath;
    }

    const { data, error } = await submissionWriteWithFallback(req, (client) =>
      client.from('bug_reports').insert({
        id: reportId,
        reporter_id: user.id,
        reporter_role: profile.role,
        reporter_name: profile.name,
        reporter_email: profile.email || user.email || null,
        description,
        attachment_path: uploadedPath,
        attachment_name: attachment?.name || null,
        attachment_mime_type: attachment?.mimeType || null,
        attachment_size: attachment?.size || null,
        route: String(req.body?.route || '').slice(0, 500) || null,
        context: req.body?.context && typeof req.body.context === 'object'
          ? req.body.context
          : {},
      }).select().single()
    );
    if (error) {
      if (uploadedPath) {
        await supabase.storage.from(BUG_REPORT_BUCKET).remove([uploadedPath]);
      }
      return res.status(isRlsDenial(error) ? 403 : 400).json({ error: error.message });
    }
    res.json({ report: data });
  } catch (error) {
    if (uploadedPath) {
      try {
        await supabase.storage.from(BUG_REPORT_BUCKET).remove([uploadedPath]);
      } catch {
        // Preserve the original request error; orphan cleanup can be retried operationally.
      }
    }
    res.status(500).json({ error: 'The report could not be saved.' });
  }
});

app.get('/api/admin/bug-reports', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ reports: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/bug-reports/:id/attachment', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const { data: report, error } = await supabase
      .from('bug_reports')
      .select('attachment_path')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    if (!report.attachment_path) return res.status(404).json({ error: 'This report has no screenshot.' });

    const { data, error: signedUrlError } = await supabase.storage
      .from(BUG_REPORT_BUCKET)
      .createSignedUrl(report.attachment_path, 300);
    if (signedUrlError) return res.status(400).json({ error: signedUrlError.message });
    res.json({ url: data.signedUrl, expiresIn: 300 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/bug-reports/:id', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const allowedStatuses = new Set(['open', 'in_progress', 'resolved', 'closed']);
    const allowedPriorities = new Set(['low', 'normal', 'high', 'urgent']);
    const patch = {};
    if (req.body?.status !== undefined) {
      const status = String(req.body.status).toLowerCase();
      if (!allowedStatuses.has(status)) return res.status(400).json({ error: 'Invalid report status.' });
      patch.status = status;
      patch.resolved_at = ['resolved', 'closed'].includes(status) ? new Date().toISOString() : null;
    }
    if (req.body?.priority !== undefined) {
      const priority = String(req.body.priority).toLowerCase();
      if (!allowedPriorities.has(priority)) return res.status(400).json({ error: 'Invalid report priority.' });
      patch.priority = priority;
    }
    if (req.body?.adminNotes !== undefined) {
      patch.admin_notes = String(req.body.adminNotes).slice(0, 5000);
    }
    const { data, error } = await supabase
      .from('bug_reports')
      .update(patch)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Report not found.' });
    res.json({ report: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/test', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    if (!canSendNotificationEmails()) {
      return res.status(400).json({ error: 'Email notifications are disabled. Set RESEND_API_KEY and NOTIFY_FROM_EMAIL.' });
    }
    if (!user.email) return res.status(400).json({ error: 'Your account has no email address to test.' });
    const result = await sendEmail({
      to: user.email,
      subject: 'praxis email test',
      html: '<div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#1d2a44;"><p>This is a praxis email test. If you received this, notification email delivery is configured.</p></div>',
      text: 'This is a praxis email test. If you received this, notification email delivery is configured.',
      idempotencyKey: makeIdempotencyKey(['notification-test', user.id, new Date().toISOString()]),
    });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/diagnose-submission', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });

    const assignmentId = String(req.query.assignmentId || '').trim();
    const studentId = String(req.query.studentId || '').trim();
    if (!assignmentId || !studentId) {
      return res.status(400).json({ error: 'assignmentId and studentId are required.' });
    }

    const readClient = getRequestScopedSupabase(req);
    const assignment = await ensureTeacherOwnsAssignment(assignmentId, user.id, readClient);
    if (!assignment) return res.status(403).json({ error: 'You can only diagnose your own assignments.' });

    const { data: classRow, error: classError } = await supabase
      .from('classes')
      .select('id, name, teacher_id')
      .eq('id', assignment.class_id)
      .maybeSingle();
    if (classError) return res.status(400).json({ error: classError.message });

    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*, profiles(id, name)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (submissionError) return res.status(400).json({ error: submissionError.message });

    const emailMap = await getAuthUserEmailMap([studentId, classRow?.teacher_id].filter(Boolean));
    const studentEmail = emailMap.get(studentId) || '';
    const teacherEmail = classRow?.teacher_id ? emailMap.get(classRow.teacher_id) || '' : '';
    const review = submission?.teacher_review || {};
    const submittedAt = submission?.submitted_at || submission?.submittedAt || '';
    const gradeSavedAt = getTeacherReviewSavedAt(review);

    const teacherSubmissionKey = makeIdempotencyKey([
      'student-submitted',
      assignment.id,
      studentId,
      submittedAt || submission?.updated_at || new Date().toISOString(),
    ]);
    const gradeKey = makeIdempotencyKey([
      'grade-published',
      assignment.id,
      studentId,
      gradeSavedAt,
    ]);
    const reopenKey = makeIdempotencyKey([
      'submission-reopened',
      assignment.id,
      studentId,
      submission?.updated_at || new Date().toISOString(),
    ]);

    res.json({
      checkedAt: new Date().toISOString(),
      config: buildEmailConfigDiagnostic(),
      assignment: {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        classId: assignment.class_id,
      },
      class: classRow ? {
        id: classRow.id,
        name: classRow.name,
        teacherId: classRow.teacher_id,
      } : null,
      submission: submission ? {
        id: submission.id,
        studentId: submission.student_id,
        studentName: submission.profiles?.name || '',
        status: submission.status,
        submittedAt,
        updatedAt: submission.updated_at,
        teacherReview: {
          status: review.status || null,
          savedAt: gradeSavedAt || null,
          finalScore: review.finalScore ?? review.final_score ?? null,
          finalNotesLength: String(review.finalNotes || review.final_notes || '').length,
        },
      } : null,
      recipients: {
        teacher: {
          id: classRow?.teacher_id || null,
          hasEmail: Boolean(teacherEmail),
          email: maskEmail(teacherEmail),
        },
        student: {
          id: studentId,
          hasEmail: Boolean(studentEmail),
          email: maskEmail(studentEmail),
        },
      },
      decisions: {
        teacherSubmission: {
          wouldAttempt: Boolean(canSendNotificationEmails() && assignment?.class_id && submission?.student_id && teacherEmail),
          idempotencyKey: teacherSubmissionKey,
        },
        studentGrade: {
          wouldAttemptIfPreviousEmpty: Boolean(canSendNotificationEmails() && assignment?.id && submission?.student_id && studentEmail && teacherReviewWasNewlySaved(null, review)),
          wouldAttemptIfPreviousSame: Boolean(canSendNotificationEmails() && assignment?.id && submission?.student_id && studentEmail && teacherReviewWasNewlySaved(review, review)),
          currentReviewWouldTriggerFromEmpty: teacherReviewWasNewlySaved(null, review),
          idempotencyKey: gradeKey,
        },
        studentReopen: {
          wouldAttemptIfPreviousGraded: Boolean(canSendNotificationEmails() && assignment?.id && submission?.student_id && studentEmail && submissionWasReopened({ status: 'graded' }, submission)),
          currentStatusWouldTriggerFromGraded: submissionWasReopened({ status: 'graded' }, submission),
          idempotencyKey: reopenKey,
        },
      },
    });
  } catch (error) {
    console.error('Email notification diagnostic failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user profile
app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const profile = await getProfile(user.id);
    if (!profile) return res.status(409).json({ error: ACCOUNT_SETUP_INCOMPLETE_MESSAGE });
    res.json({ profile: sanitizeProfileForClient(profile) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Classes endpoints ────────────────────────────────────────

function normalizeClassInviteCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function generateClassInviteCode() {
  // Avoid ambiguous characters while retaining about 40 bits of entropy.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 8 },
    () => alphabet[crypto.randomInt(0, alphabet.length)]
  ).join('');
}

async function createClassWithUniqueInviteCode(client, classData) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = generateClassInviteCode();
    const { data, error } = await client
      .from('classes')
      .insert({ ...classData, invite_code: inviteCode })
      .select()
      .single();

    if (!error) return { data, error: null };
    if (error.code !== '23505') return { data: null, error };
  }

  return { data: null, error: new Error('Could not generate a unique course access code.') };
}

// Get teacher's classes
app.get('/api/classes', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });

    // Authorization is established above and teacher_id scopes the result.
    // Use the server client so profile RLS does not erase nested roster names.
    const { data, error } = await supabase
      .from('classes')
      .select('*, class_members(student_id, status, profiles(id, name, email))')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ classes: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a class
app.post('/api/classes', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'A course name is required.' });
    const classData = {
      name,
      teacher_id: user.id,
      description: String(req.body?.description || '').trim() || null,
      semester: String(req.body?.semester || '').trim() || null,
      is_published: req.body?.isPublished !== false,
      archived: false,
    };
    const { data, error } = await writeWithRequestScopedFallback(
      req,
      (client) => createClassWithUniqueInviteCode(
        client,
        classData
      )
    );
    if (error) return res.status(400).json({ error: error.message });
    res.json({ class: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join a published course using its durable access code.
app.post('/api/classes/join-by-code', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const profile = await getProfile(user.id);
    if (profile?.role !== 'student') {
      return res.status(403).json({ error: 'Only student accounts can join courses.' });
    }

    const now = Date.now();
    const ip = getClientIp(req);
    const studentKey = `${ip}:${user.id}`;
    cleanupRateBucket(joinCodeRateLimiter, now, JOIN_CODE_RATE_WINDOW_MS);
    cleanupRateBucket(joinCodeIpRateLimiter, now, JOIN_CODE_RATE_WINDOW_MS);
    const studentRate = evaluateRateBucket(joinCodeRateLimiter, studentKey, now, {
      windowMs: JOIN_CODE_RATE_WINDOW_MS,
      maxAttempts: JOIN_CODE_RATE_MAX_FAILURES,
      blockMs: JOIN_CODE_RATE_BLOCK_MS,
    });
    const ipRate = evaluateRateBucket(joinCodeIpRateLimiter, ip, now, {
      windowMs: JOIN_CODE_RATE_WINDOW_MS,
      maxAttempts: JOIN_CODE_IP_RATE_MAX_FAILURES,
      blockMs: JOIN_CODE_RATE_BLOCK_MS,
    });
    const joinRate = studentRate.blocked ? studentRate : ipRate;
    if (joinRate.blocked) {
      res.set('Retry-After', String(joinRate.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many incorrect course-code attempts. Please wait and try again.',
        retryAfterSeconds: joinRate.retryAfterSeconds,
      });
    }

    const inviteCode = normalizeClassInviteCode(req.body?.code);
    if (!inviteCode) return res.status(400).json({ error: 'Please enter a valid course code.' });

    const { data: classRow, error: classError } = await supabase
      .from('classes')
      .select('id, name, invite_code, description, semester, is_published, archived, teacher_id')
      .ilike('invite_code', inviteCode)
      .maybeSingle();

    if (classError) return res.status(400).json({ error: classError.message });
    if (!classRow) {
      registerRateFailure(joinCodeRateLimiter, studentKey, now, {
        windowMs: JOIN_CODE_RATE_WINDOW_MS,
        maxAttempts: JOIN_CODE_RATE_MAX_FAILURES,
        blockMs: JOIN_CODE_RATE_BLOCK_MS,
      });
      registerRateFailure(joinCodeIpRateLimiter, ip, now, {
        windowMs: JOIN_CODE_RATE_WINDOW_MS,
        maxAttempts: JOIN_CODE_IP_RATE_MAX_FAILURES,
        blockMs: JOIN_CODE_RATE_BLOCK_MS,
      });
      return res.status(404).json({ error: 'Invalid course code. Please check the code provided by your instructor.' });
    }
    if (classRow.archived || classRow.is_published === false) {
      return res.status(409).json({ error: 'This course is currently unavailable. Please contact your instructor.' });
    }

    const { data: membership, error: membershipError } = await writeWithRequestScopedFallback(
      req,
      (client) => client
        .from('class_members')
        .upsert(
          { class_id: classRow.id, student_id: user.id, status: 'approved' },
          { onConflict: 'class_id,student_id' }
        )
        .select('class_id, student_id, status')
        .single()
    );
    if (membershipError) return res.status(400).json({ error: membershipError.message });

    clearRateBucketEntry(joinCodeRateLimiter, studentKey);
    res.json({ ok: true, class: classRow, membership });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/classes/:classId', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) {
      return res.status(403).json({ error: 'You can only update your own classes.' });
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'A course name is required.' });
      patch.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
      patch.description = String(req.body.description || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'semester')) {
      patch.semester = String(req.body.semester || '').trim() || null;
    }
    if (typeof req.body?.isPublished === 'boolean') {
      patch.is_published = req.body.isPublished;
    }
    if (typeof req.body?.archived === 'boolean') {
      patch.archived = req.body.archived;
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'No supported course changes were provided.' });
    }

    const { data, error } = await writeWithRequestScopedFallback(
      req,
      (client) => client
        .from('classes')
        .update(patch)
        .eq('id', req.params.classId)
        .eq('teacher_id', user.id)
        .select()
        .single()
    );
    if (error) return res.status(400).json({ error: error.message });
    res.json({ class: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add student to class
app.post('/api/classes/:classId/members', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) return res.status(403).json({ error: 'You can only add students to your own classes.' });
    const { studentEmail } = req.body;
    // Find student by email
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.users.find(u => u.email === studentEmail);
    if (!authUser) return res.status(404).json({ error: 'No student found with that email' });
    const studentProfile = await getProfile(authUser.id);
    if (!studentProfile || studentProfile.role !== 'student') {
      return res.status(404).json({ error: 'No student found with that email' });
    }
    const { error } = await writeWithRequestScopedFallback(req, (client) => client
      .from('class_members')
      .upsert(
        { class_id: req.params.classId, student_id: authUser.id, status: 'approved' },
        { onConflict: 'class_id,student_id' }
      ));
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email a course invitation without enrolling the recipient automatically.
app.post('/api/classes/:classId/invitations', async (req, res) => {
  try {
    const { user, profile, error: teacherError, status } =
      await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });

    const studentEmail = String(req.body?.studentEmail || '')
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
      return res.status(400).json({ error: 'Enter a valid student email address.' });
    }

    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(
      req.params.classId,
      user.id,
      readClient
    );
    if (!ownedClass) {
      return res.status(403).json({ error: 'You can only invite students to your own courses.' });
    }

    const { data: course, error: courseError } = await readClient
      .from('classes')
      .select('id, name, invite_code, semester, is_published, archived')
      .eq('id', req.params.classId)
      .single();
    if (courseError) throw courseError;
    if (course.archived === true) {
      return res.status(400).json({ error: 'Restore this course before inviting students.' });
    }
    if (course.is_published === false) {
      return res.status(400).json({ error: 'Publish this course before inviting students.' });
    }

    const courseName = course.name || 'your course';
    const instructorName = profile?.name || 'Your instructor';
    const accessCode = String(course.invite_code || '').trim().toUpperCase();
    const joinUrl = `${getRequestBaseUrl(req)}/join?code=${encodeURIComponent(accessCode)}`;
    const safeCourseName = escapeHtmlEmail(courseName);
    const safeInstructorName = escapeHtmlEmail(instructorName);
    const safeAccessCode = escapeHtmlEmail(accessCode);
    const safeJoinUrl = escapeHtmlEmail(joinUrl);
    const emailResult = await sendEmail({
      to: studentEmail,
      subject: `You're invited to join ${courseName} on Praxis`,
      text: [
        `You are invited to join ${courseName} on Praxis.`,
        '',
        `Instructor: ${instructorName}`,
        `Access code: ${accessCode}`,
        `Join here: ${joinUrl}`,
        '',
        'Sign in to your Praxis account, or create an account, then follow the link to join the course.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a;line-height:1.6;">
          <h1 style="font-size:24px;margin-bottom:8px;">You're invited to join ${safeCourseName}</h1>
          <p>${safeInstructorName} invited you to join a course on Praxis.</p>
          <div style="margin:24px 0;padding:18px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff;">
            <p style="margin:0 0 6px;"><strong>Course:</strong> ${safeCourseName}</p>
            <p style="margin:0;"><strong>Access code:</strong> ${safeAccessCode}</p>
          </div>
          <a href="${safeJoinUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:700;">Join course on Praxis</a>
          <p style="margin-top:22px;font-size:13px;color:#64748b;">Sign in or create a student account, then Praxis will continue your invitation.</p>
        </div>
      `,
      idempotencyKey: `course-invite:${course.id}:${studentEmail}:${Date.now()}`,
    });

    if (emailResult?.skipped) {
      return res.status(503).json({ error: 'Email delivery is not configured on this server.' });
    }

    return res.json({ ok: true, recipient: studentEmail });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'The invitation could not be sent.' });
  }
});

app.delete('/api/classes/:classId', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) return res.status(403).json({ error: 'You can only delete your own classes.' });
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('class_id', req.params.classId);
    const assignmentIds = (assignments || []).map(a => a.id);
    if (assignmentIds.length) {
      const { data: submissionsToArchive, error: fetchError } = await supabase
        .from('submissions')
        .select('*')
        .in('assignment_id', assignmentIds);
      if (fetchError) return res.status(400).json({ error: fetchError.message });
      // Preserve de-identified keystroke/writing-process data before the hard delete.
      await archiveSubmissionsForDeletion(submissionsToArchive, {
        reason: 'class_deleted',
        classId: req.params.classId,
      });
      const submissionIds = (submissionsToArchive || [])
        .map((submission) => submission.id)
        .filter(Boolean);
      if (submissionIds.length) {
        const { error: submissionRevisionError } = await supabase
          .from('submission_revisions')
          .delete()
          .in('submission_id', submissionIds);
        if (submissionRevisionError) {
          return res.status(400).json({ error: submissionRevisionError.message });
        }
      }
      const { error: submissionDeleteError } = await supabase
        .from('submissions')
        .delete()
        .in('assignment_id', assignmentIds);
      if (submissionDeleteError) {
        return res.status(400).json({ error: submissionDeleteError.message });
      }
      const { error: assignmentRevisionError } = await supabase
        .from('assignment_revisions')
        .delete()
        .in('assignment_id', assignmentIds);
      if (assignmentRevisionError) {
        return res.status(400).json({ error: assignmentRevisionError.message });
      }
      const { error: assignmentDeleteError } = await supabase
        .from('assignments')
        .delete()
        .in('id', assignmentIds);
      if (assignmentDeleteError) {
        return res.status(400).json({ error: assignmentDeleteError.message });
      }
    }
    const { error: membershipDeleteError } = await supabase
      .from('class_members')
      .delete()
      .eq('class_id', req.params.classId);
    if (membershipDeleteError) {
      return res.status(400).json({ error: membershipDeleteError.message });
    }
    const { error } = await supabase.from('classes').delete().eq('id', req.params.classId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/classes/:classId/members/:studentId', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) return res.status(403).json({ error: 'You can only remove students from your own classes.' });
    const { error } = await writeWithRequestScopedFallback(req, (client) => client
      .from('class_members')
      .delete()
      .eq('class_id', req.params.classId)
      .eq('student_id', req.params.studentId));
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/classes/:classId/members/:studentId', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) return res.status(403).json({ error: 'You can only rename students in your own classes.' });
    const enrolledStudent = await ensureStudentBelongsToClass(req.params.classId, req.params.studentId, readClient);
    if (!enrolledStudent) return res.status(404).json({ error: 'That student is not enrolled in this class.' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'A student name is required.' });

    const { data, error } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', req.params.studentId)
      .select('id, name, role');
    if (error) return res.status(400).json({ error: error.message });
    const profile = Array.isArray(data) ? data[0] : data;
    if (!profile) return res.status(404).json({ error: 'Student profile not found after rename.' });
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve a pending student who joined via the class invite link
app.post('/api/classes/:classId/members/:studentId/approve', async (req, res) => {
  try {
    const guard = await requireOwnedClassMember(req, {
      ownershipError: 'You can only approve students for your own classes.',
    });
    if (guard.error) return res.status(guard.status).json({ error: guard.error });
    const { error } = await writeWithRequestScopedFallback(req, (client) => client
      .from('class_members')
      .update({ status: 'approved' })
      .eq('class_id', req.params.classId)
      .eq('student_id', req.params.studentId));
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get classes for a student
app.get('/api/student/classes', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const readClient = getRequestScopedSupabase(req);
    const { data: memberships, error: membershipError } = await readClient
      .from('class_members')
      .select('class_id, status')
      .eq('student_id', user.id);
    if (membershipError) return res.status(400).json({ error: membershipError.message });

    // The membership query above is evaluated with the student's JWT/RLS and
    // therefore proves exactly which class IDs this user may access. Load only
    // those verified classes with the server client so a missing/narrow class
    // SELECT policy cannot silently turn an existing membership into
    // `classes: null`.
    const classIds = Array.from(
      new Set((memberships || []).map((entry) => entry.class_id).filter(Boolean))
    );
    if (!classIds.length) {
      return res.json({ classes: [], pendingClasses: [] });
    }

    const { data: classRows, error: classError } = await supabase
      .from('classes')
      .select('id, name, teacher_id, invite_code, description, semester, is_published, archived, profiles(name)')
      .in('id', classIds);
    if (classError) return res.status(400).json({ error: classError.message });

    const classesById = new Map(
      (classRows || []).map((classRow) => [String(classRow.id), classRow])
    );
    const rows = (memberships || [])
      .map((membership) => ({
        ...membership,
        classes: classesById.get(String(membership.class_id)) || null,
      }))
      .filter((entry) => entry.classes);

    res.json({
      classes: rows.filter((entry) => entry.status !== 'pending').map((entry) => entry.classes),
      pendingClasses: rows.filter((entry) => entry.status === 'pending').map((entry) => entry.classes),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join class via invite token
app.get('/api/classes/:classId/invite', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('name, profiles(name)')
      .eq('id', req.params.classId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Class not found' });
    res.json({
      className: data.name,
      teacherName: data.profiles?.name || "",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-join class after signup
app.post('/api/classes/:classId/join', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const profile = await getProfile(user.id);
    if (profile?.role !== 'student') {
      return res.status(403).json({ error: 'Only student accounts can join classes.' });
    }
    const { error } = await writeWithRequestScopedFallback(req, (client) => client
      .from('class_members')
      .insert({ class_id: req.params.classId, student_id: user.id, status: 'pending' })
      .select('class_id, student_id')
      .single());
    if (error?.code === '23505') {
      return res.json({ ok: true, alreadyJoined: true });
    }
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true, pending: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/classes/:classId/members', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) return res.status(403).json({ error: 'You can only view rosters for your own classes.' });
    // Ownership is verified before this server-side roster/profile read.
    const { data, error } = await supabase
      .from('class_members')
      .select('student_id, status, profiles(id, name, email)')
      .eq('class_id', req.params.classId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({
      members: data
        .filter((entry) => entry.student_id !== user.id && entry.profiles)
        .map((entry) => ({ ...entry.profiles, status: entry.status || 'approved' })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send a teacher-authored email to one or all approved students in a course.
app.post('/api/classes/:classId/messages', async (req, res) => {
  try {
    const { user, profile, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    if (!canSendNotificationEmails()) {
      return res.status(503).json({
        error: 'Email delivery is not configured. Set SMTP credentials or RESEND_API_KEY and NOTIFY_FROM_EMAIL.',
      });
    }

    const recipientMode = req.body?.recipientMode === 'individual' ? 'individual' : 'all';
    const { data: classRow, error: classError } = await supabase
      .from('classes')
      .select('id, name, teacher_id, is_published, archived')
      .eq('id', req.params.classId)
      .eq('teacher_id', user.id)
      .maybeSingle();
    if (classError) return res.status(400).json({ error: classError.message });
    if (!classRow) return res.status(403).json({ error: 'You can only message students in your own course.' });
    const studentId = String(req.body?.studentId || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    const requestId = String(req.body?.requestId || crypto.randomUUID())
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 120);

    const { data: existingMessage, error: existingMessageError } = await supabase
      .from('course_messages')
      .select('*')
      .eq('teacher_id', user.id)
      .eq('provider_request_id', requestId)
      .maybeSingle();
    if (existingMessageError) throw existingMessageError;
    if (existingMessage) {
      return res.status(existingMessage.status === 'queued' || existingMessage.status === 'sending' ? 202 : 200).json({
        ok: true,
        queued: existingMessage.status === 'queued' || existingMessage.status === 'sending',
        replayed: true,
        message: existingMessage,
        courseId: existingMessage.class_id,
        recipientMode: existingMessage.recipient_mode,
        recipientCount: Array.isArray(existingMessage.recipient_emails)
          ? existingMessage.recipient_emails.length
          : 0,
        deliveredCount: existingMessage.delivered_count || 0,
        failedCount: existingMessage.failed_count || 0,
        sentAt: existingMessage.sent_at || null,
      });
    }

    if (!subject || subject.length > 180) {
      return res.status(400).json({ error: 'Enter a subject of 180 characters or fewer.' });
    }
    if (!body || body.length > 20000) {
      return res.status(400).json({ error: 'Enter a message of 20,000 characters or fewer.' });
    }
    if (recipientMode === 'individual' && !studentId) {
      return res.status(400).json({ error: 'Select an enrolled student.' });
    }
    let membershipQuery = supabase
      .from('class_members')
      .select('student_id, status, profiles(id, name, email)')
      .eq('class_id', classRow.id)
      .eq('status', 'approved');
    if (recipientMode === 'individual') {
      membershipQuery = membershipQuery.eq('student_id', studentId);
    }

    const membershipResult = await membershipQuery;
    if (membershipResult.error) {
      return res.status(400).json({ error: membershipResult.error.message });
    }
    const memberships = membershipResult.data || [];
    if (!memberships.length) {
      return res.status(400).json({
        error: recipientMode === 'individual'
          ? 'That student is not enrolled in this course.'
          : 'This course has no enrolled students with approved access.',
      });
    }
    if (memberships.length > 200) {
      return res.status(400).json({ error: 'Course messages are limited to 200 recipients at a time.' });
    }

    const missingEmailIds = memberships
      .filter((entry) => !normalizeEmail(entry.profiles?.email))
      .map((entry) => entry.student_id);
    const authEmailMap = missingEmailIds.length
      ? await getAuthUserEmailMap(missingEmailIds)
      : new Map();
    const recipients = memberships
      .map((entry) => ({
        id: entry.student_id,
        name: entry.profiles?.name || 'Student',
        email: normalizeEmail(entry.profiles?.email || authEmailMap.get(entry.student_id)),
      }))
      .filter((entry) => entry.email);

    if (!recipients.length) {
      return res.status(400).json({ error: 'No deliverable student email addresses were found.' });
    }

    const messageRecord = {
      teacher_id: user.id,
      class_id: classRow.id,
      recipient_mode: recipientMode,
      recipient_student_id: recipientMode === 'individual' ? recipients[0].id : null,
      recipient_emails: recipients.map((recipient) => recipient.email),
      subject,
      body,
      status: 'queued',
      delivered_count: 0,
      failed_count: 0,
      provider_request_id: requestId,
      updated_at: new Date().toISOString(),
    };
    const { data: storedMessage, error: messageStoreError } =
      await writeWithRequestScopedFallback(req, (client) =>
        client.from('course_messages')
          .upsert(messageRecord, { onConflict: 'teacher_id,provider_request_id' })
          .select()
          .single()
      );
    if (messageStoreError) {
      throw messageStoreError;
    }

    await enqueueDomainEvent({
      eventType: 'course_message',
      aggregateType: 'course_message',
      aggregateId: storedMessage.id,
      idempotencyKey: `course-message:${user.id}:${requestId}`,
      payload: {
        recipients,
        teacherName: profile?.name || 'Your instructor',
        courseName: classRow.name || 'your course',
      },
    });
    processNotificationOutbox().catch((deliveryError) => {
      console.error('Course message outbox processing failed:', deliveryError);
    });

    res.status(202).json({
      ok: true,
      queued: true,
      message: storedMessage,
      courseId: classRow.id,
      recipientMode,
      recipientCount: recipients.length,
      deliveredCount: 0,
      failedCount: 0,
      queuedAt: new Date().toISOString(),
      recipient: recipientMode === 'individual'
        ? { id: recipients[0].id, name: recipients[0].name }
        : null,
    });
  } catch (error) {
    console.error('Teacher course message failed:', errorClassForLog(error));
    res.status(500).json({ error: 'The course message could not be sent.' });
  }
});

app.get('/api/course-messages', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const client = getRequestScopedSupabase(req);
    const { data, error: readError } = await client
      .from('course_messages')
      .select('*, classes(name, invite_code)')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });
    if (readError) return res.status(400).json({ error: readError.message });
    res.json({ messages: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/course-messages/drafts', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const classId = String(req.body?.classId || '').trim();
    const ownedClass = await ensureTeacherOwnsClass(classId, user.id, getRequestScopedSupabase(req));
    if (!ownedClass) return res.status(403).json({ error: 'You can only save messages for your own course.' });
    const payload = {
      teacher_id: user.id,
      class_id: classId,
      recipient_mode: req.body?.recipientMode === 'individual' ? 'individual' : 'all',
      recipient_student_id: req.body?.studentId || null,
      recipient_emails: Array.isArray(req.body?.recipientEmails) ? req.body.recipientEmails : [],
      subject: String(req.body?.subject || ''),
      body: String(req.body?.body || ''),
      status: 'draft',
      updated_at: new Date().toISOString(),
    };
    const draftId = String(req.body?.id || '').trim();
    const result = draftId
      ? await writeWithRequestScopedFallback(req, (client) => client.from('course_messages')
          .update(payload).eq('id', draftId).eq('teacher_id', user.id).eq('status', 'draft').select().single())
      : await writeWithRequestScopedFallback(req, (client) => client.from('course_messages')
          .insert(payload).select().single());
    if (result.error) return res.status(400).json({ error: result.error.message });
    res.json({ message: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/course-messages/:id', async (req, res) => {
  try {
    const { user, error, status } = await requireTeacherProfile(req);
    if (error) return res.status(status).json({ error });
    const { error: deleteError } = await writeWithRequestScopedFallback(req, (client) =>
      client.from('course_messages').delete().eq('id', req.params.id).eq('teacher_id', user.id)
    );
    if (deleteError) return res.status(400).json({ error: deleteError.message });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Assignments endpoints ────────────────────────────────────

const ASSIGNMENT_ALLOWED_FIELDS = new Set([
  'title',
  'prompt',
  'brief',
  'focus',
  'assignment_type',
  'language_level',
  'word_count_min',
  'word_count_max',
  'idea_request_limit',
  'feedback_request_limit',
  'chat_time_limit',
  'student_focus',
  'rubric',
  'status',
  'deadline',
  'uploaded_rubric_text',
  'auto_outline_from_chat',
  'class_id',
]);

async function saveAssignmentRevision(assignment, userId, changeType) {
  if (!assignment?.id) return;
  const revisionNumber = Number(assignment.version || 1);

  if (USE_POSTGRES_APP_DB) {
    await db.query(
      `INSERT INTO public.assignment_revisions
        (assignment_id, revision_number, snapshot, change_type, created_by)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (assignment_id, revision_number) DO NOTHING`,
      [
        assignment.id,
        revisionNumber,
        JSON.stringify(assignment),
        changeType || 'autosave',
        userId || null,
      ]
    );
    return;
  }

  const { error } = await supabase.from('assignment_revisions').upsert({
    assignment_id: assignment.id,
    revision_number: revisionNumber,
    snapshot: assignment,
    change_type: changeType,
    created_by: userId || null,
  }, { onConflict: 'assignment_id,revision_number', ignoreDuplicates: true });

  if (error) throw error;
}

async function saveSubmissionRevision(submission, userId, changeType) {
  if (!submission?.id) return;
  const revisionNumber = Number(submission.version || 1);

  if (USE_POSTGRES_APP_DB) {
    await db.query(
      `INSERT INTO public.submission_revisions
        (submission_id, revision_number, snapshot, change_type, created_by)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (submission_id, revision_number) DO NOTHING`,
      [
        submission.id,
        revisionNumber,
        JSON.stringify(submission),
        changeType || 'autosave',
        userId || null,
      ]
    );
    return;
  }

  const { error } = await supabase.from('submission_revisions').upsert({
    submission_id: submission.id,
    revision_number: revisionNumber,
    snapshot: submission,
    change_type: changeType,
    created_by: userId || null,
  }, { onConflict: 'submission_id,revision_number', ignoreDuplicates: true });

  if (error) throw error;
}

async function enqueueDomainEvent({
  eventType,
  aggregateType,
  aggregateId,
  idempotencyKey,
  payload,
}) {
  if (USE_POSTGRES_APP_DB) {
    await db.query(
      `INSERT INTO public.notification_outbox
        (event_type, aggregate_type, aggregate_id, idempotency_key, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        eventType,
        aggregateType,
        aggregateId,
        idempotencyKey,
        JSON.stringify(payload || {}),
      ]
    );
    return;
  }

  const { error } = await supabase.from('notification_outbox').upsert({
    event_type: eventType,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    idempotency_key: idempotencyKey,
    payload: payload || {},
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true });

  if (error) throw error;
}

function getIdempotencyKey(req) {
  return String(req.get('Idempotency-Key') || '').trim().slice(0, 200);
}

async function getIdempotentResponse(userId, operation, idempotencyKey) {
  if (!idempotencyKey) return null;

  if (USE_POSTGRES_APP_DB) {
    const { rows } = await db.query(
      `SELECT response_status, response_body
         FROM public.api_idempotency_keys
        WHERE user_id = $1
          AND operation = $2
          AND idempotency_key = $3
          AND expires_at > NOW()
        LIMIT 1`,
      [userId, operation, idempotencyKey]
    );

    return rows[0] || null;
  }

  const { data, error } = await supabase
    .from('api_idempotency_keys')
    .select('response_status, response_body')
    .eq('user_id', userId)
    .eq('operation', operation)
    .eq('idempotency_key', idempotencyKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function saveIdempotentResponse({
  userId,
  operation,
  idempotencyKey,
  resourceType,
  resourceId,
  responseStatus,
  responseBody,
}) {
  if (!idempotencyKey) return;

  if (USE_POSTGRES_APP_DB) {
    await db.query(
      `INSERT INTO public.api_idempotency_keys
        (
          user_id,
          operation,
          idempotency_key,
          resource_type,
          resource_id,
          response_status,
          response_body
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (user_id, operation, idempotency_key)
       DO UPDATE SET
         resource_type = EXCLUDED.resource_type,
         resource_id = EXCLUDED.resource_id,
         response_status = EXCLUDED.response_status,
         response_body = EXCLUDED.response_body`,
      [
        userId,
        operation,
        idempotencyKey,
        resourceType || null,
        resourceId || null,
        responseStatus || null,
        JSON.stringify(responseBody ?? null),
      ]
    );
    return;
  }

  const { error } = await supabase.from('api_idempotency_keys').upsert({
    user_id: userId,
    operation,
    idempotency_key: idempotencyKey,
    resource_type: resourceType,
    resource_id: resourceId,
    response_status: responseStatus,
    response_body: responseBody,
  }, { onConflict: 'user_id,operation,idempotency_key' });

  if (error) throw error;
}

function sanitizePayload(payload = {}, allowedFields = new Set()) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([key, value]) => allowedFields.has(key) && value !== undefined)
  );
}

function sanitizeAssignmentPayload(payload = {}) {
  return sanitizePayload(payload, ASSIGNMENT_ALLOWED_FIELDS);
}

async function assignmentWriteWithFallback(req, writeFn) {
  return writeWithRequestScopedFallback(req, writeFn);
}

async function submissionWriteWithFallback(req, writeFn) {
  return writeWithRequestScopedFallback(req, writeFn);
}

async function writeWithRequestScopedFallback(req, writeFn) {
  const requestScopedSupabase = getRequestScopedSupabase(req);
  const candidates = [];
  if (requestScopedSupabase && requestScopedSupabase !== supabase) {
    candidates.push({ client: requestScopedSupabase, label: 'authenticated session' });
  }
  candidates.push({ client: supabase, label: 'server key' });

  let lastResult = { data: null, error: null, label: '' };
  for (const candidate of candidates) {
    const { data, error } = await writeFn(candidate.client);
    lastResult = { data, error, label: candidate.label };
    if (!error) return lastResult;
    if (!/row-level security policy/i.test(error.message || '')) break;
  }
  return lastResult;
}

async function queryAssignmentsForClass(req, classId, accessRole) {
  const requestScopedSupabase = getRequestScopedSupabase(req);
  const candidates = [];
  if (requestScopedSupabase && requestScopedSupabase !== supabase) {
    candidates.push(requestScopedSupabase);
  }
  candidates.push(supabase);

  let lastError = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const client = candidates[index];
    let query = client
      .from('assignments')
      .select('*')
      .eq('class_id', classId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (accessRole === 'student') {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;
    if (error) {
      lastError = error;
      continue;
    }

    if (Array.isArray(data) && data.length > 0) {
      return { data, error: null };
    }

    const isLastCandidate = index === candidates.length - 1;
    if (accessRole !== 'teacher' || isLastCandidate) {
      return { data: data || [], error: null };
    }
  }

  return { data: [], error: lastError };
}

// Get assignments for a class
app.get('/api/classes/:classId/assignments', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const readClient = getRequestScopedSupabase(req);
    const access = await ensureUserCanAccessClass(req.params.classId, user.id, readClient);
    if (!access) return res.status(403).json({ error: 'You do not have access to this class.' });
    const { data, error } = await queryAssignmentsForClass(req, req.params.classId, access.role);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ assignments: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create assignment
app.post('/api/classes/:classId/assignments', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) return res.status(403).json({ error: 'You can only add assignments to your own classes.' });
    const idempotencyKey = getIdempotencyKey(req);
    const replay = await getIdempotentResponse(user.id, 'create_assignment', idempotencyKey);
    if (replay?.response_body) {
      return res.status(replay.response_status || 200).json(replay.response_body);
    }
    const payload = sanitizeAssignmentPayload(req.body);
    const { data, error, label } = await assignmentWriteWithFallback(req, (client) => client
      .from('assignments')
      .insert({ ...payload, class_id: req.params.classId })
      .select()
      .single());
    if (error) {
      if (/row-level security policy/i.test(error.message || "")) {
        return res.status(400).json({
         error: SUPABASE_SERVER_KEY
            ? 'Assignment save is blocked by Supabase RLS. The teacher session and server key were rejected - check the assignments INSERT policy in your Supabase dashboard.'
            : 'Assignment save failed: SUPABASE_SERVICE_ROLE_KEY is missing from server environment. Add it to your .env file or hosting platform settings.'
        });
      }
      return res.status(400).json({ error: error.message });
    }
    if (label && label !== 'server key') {
      console.info(`Assignment created with ${label} after teacher ownership verification.`);
    }
    await saveAssignmentRevision(data, user.id, 'created');
    if (data?.status === 'published') {
      await enqueueDomainEvent({
        eventType: 'assignment_published',
        aggregateType: 'assignment',
        aggregateId: data.id,
        idempotencyKey: `assignment-published:${data.id}:${data.version}`,
        payload: { assignmentId: data.id, classId: data.class_id, version: data.version },
      });
      processNotificationOutbox().catch((notifyError) => {
        console.error('Assignment publish outbox processing failed:', notifyError);
      });
    }
    const responseBody = { assignment: data };
    await saveIdempotentResponse({
      userId: user.id,
      operation: 'create_assignment',
      idempotencyKey,
      resourceType: 'assignment',
      resourceId: data.id,
      responseStatus: 200,
      responseBody,
    });
    res.json(responseBody);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update assignment
app.patch('/api/assignments/:id', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedAssignment = await ensureTeacherOwnsAssignment(req.params.id, user.id, readClient);
    if (!ownedAssignment) return res.status(403).json({ error: 'You can only update assignments in your own classes.' });
    const expectedVersion = Number(req.body?.expected_version || ownedAssignment.version || 1);
    if (Number(ownedAssignment.version || 1) !== expectedVersion) {
      return res.status(409).json({
        error: 'Assignment was modified elsewhere. Refresh before saving again.',
        conflict: true,
        version: ownedAssignment.version,
      });
    }
    const payload = {
      ...sanitizeAssignmentPayload(req.body),
      version: expectedVersion + 1,
    };
    const { data, error, label } = await assignmentWriteWithFallback(req, (client) => client
      .from('assignments')
      .update(payload)
      .eq('id', req.params.id)
      .eq('version', expectedVersion)
      .is('deleted_at', null)
      .select()
      .maybeSingle());
    if (error) {
      if (/row-level security policy/i.test(error.message || "")) {
        return res.status(400).json({
          error: SUPABASE_SERVER_KEY
            ? 'Assignment update is blocked by Supabase RLS. The teacher session and server key were rejected - check the assignments UPDATE policy in your Supabase dashboard.'
            : 'Assignment update failed: SUPABASE_SERVICE_ROLE_KEY is missing from server environment. Add it to your .env file or hosting platform settings.'
        });
      }
      return res.status(400).json({ error: error.message });
    }
    if (!data) {
      return res.status(409).json({
        error: 'Assignment was modified elsewhere. Refresh before saving again.',
        conflict: true,
      });
    }
    if (label && label !== 'server key') {
      console.info(`Assignment updated with ${label} after teacher ownership verification.`);
    }
    if (ownedAssignment.status !== 'published' && data?.status === 'published') {
      await enqueueDomainEvent({
        eventType: 'assignment_published',
        aggregateType: 'assignment',
        aggregateId: data.id,
        idempotencyKey: `assignment-published:${data.id}:${data.version}`,
        payload: { assignmentId: data.id, classId: data.class_id, version: data.version },
      });
      processNotificationOutbox().catch((notifyError) => {
        console.error('Assignment publish outbox processing failed:', notifyError);
      });
    }
    await saveAssignmentRevision(
      data,
      user.id,
      ownedAssignment.status !== 'published' && data.status === 'published'
        ? 'published'
        : 'updated'
    );
    res.json({ assignment: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete assignment
app.delete('/api/assignments/:id', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedAssignment = await ensureTeacherOwnsAssignment(req.params.id, user.id, readClient);
    if (!ownedAssignment) return res.status(403).json({ error: 'You can only delete assignments in your own classes.' });

    const deletedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('assignments')
      .update({
        deleted_at: deletedAt,
        status: 'archived',
        version: Number(ownedAssignment.version || 1) + 1,
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await saveAssignmentRevision(data, user.id, 'archived');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Submissions endpoints ────────────────────────────────────

async function querySubmissionsForAssignments(
  assignmentIds,
  client = supabase,
  { includeAttempts = true } = {}
) {
  const { data, error } = await client
    .from('submissions')
    .select([
      'id',
      'assignment_id',
      'student_id',
      'status',
      'draft_text',
      'final_text',
      'reflections',
      'self_assessment',
      'teacher_review',
      'submitted_at',
      'started_at',
      'created_at',
      'updated_at',
      'version',
      'deleted_at',
      'profiles(id, name, email)',
    ].join(','))
    .in('assignment_id', assignmentIds);
  if (error) return { data: [], error };

  if (!includeAttempts) {
    return {
      data: (data || []).map((submission) => ({
        ...submission,
        detail_loaded: false,
      })),
      error: null,
    };
  }

  const submissionIds = (data || []).map((submission) => submission.id).filter(Boolean);
  let revisions = [];
  if (submissionIds.length) {
    const { data: revisionRows, error: revisionError } = await supabase
      .from('submission_revisions')
      .select('submission_id, revision_number, snapshot, change_type, created_at')
      .in('submission_id', submissionIds)
      .in('change_type', ['submitted', 'reviewed'])
      .order('revision_number', { ascending: true });
    if (revisionError) return { data: [], error: revisionError };
    revisions = revisionRows || [];
  }

  const attempts = buildSubmissionAttemptList(data || [], revisions);
  return {
    data: attempts.map((submission) => ({
      ...submission,
      detail_loaded: submission.detail_loaded === true,
    })),
    error: null,
  };
}


// Get all submissions for every assignment in a class (teacher) — single
// round-trip replacement for the old per-assignment N+1 pattern.
app.get('/api/classes/:classId/submissions', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    const ownedClass = await ensureTeacherOwnsClass(req.params.classId, user.id, readClient);
    if (!ownedClass) return res.status(403).json({ error: 'You can only view submissions for your own classes.' });

    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('id')
      .eq('class_id', req.params.classId);
    if (assignError) return res.status(400).json({ error: assignError.message });

    const assignmentIds = (assignments || []).map((a) => a.id).filter(Boolean);
    if (!assignmentIds.length) return res.json({ submissions: [] });

    const { data, error } = await querySubmissionsForAssignments(assignmentIds);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ submissions: data });
  } catch (error) {
    console.error('Unexpected class submissions failure:', safeLogError(error));
    res.status(500).json({ error: 'Could not load submissions right now. Please refresh and try again.' });
  }
});

// Get all submissions across the authenticated teacher's classes in one
// request. This supports low-cost near-real-time review updates without an
// N+1 request for every course.
app.get('/api/teacher/submissions', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);

    const { data: classes, error: classError } = await readClient
      .from('classes')
      .select('id')
      .eq('teacher_id', user.id);
    if (classError) return res.status(400).json({ error: classError.message });

    const classIds = (classes || []).map((entry) => entry.id).filter(Boolean);
    if (!classIds.length) return res.json({ submissions: [] });

    const { data: assignments, error: assignmentError } = await readClient
      .from('assignments')
      .select('id')
      .in('class_id', classIds);
    if (assignmentError) {
      return res.status(400).json({ error: assignmentError.message });
    }

    const assignmentIds = (assignments || []).map((entry) => entry.id).filter(Boolean);
    if (!assignmentIds.length) return res.json({ submissions: [] });

    // Authorization and assignment scope are established above with the
    // request-scoped client. Use the trusted server client for the final read
    // so profile RLS does not erase the nested student identity. Without it,
    // the polling response contains a valid student_id but profiles: null.
    const { data, error } = await querySubmissionsForAssignments(
      assignmentIds,
      supabase,
      { includeAttempts: false }
    );
    if (error) return res.status(400).json({ error: error.message });

    res.json({ submissions: data });
  } catch (error) {
    console.error('Unexpected teacher submissions failure:', safeLogError(error));
    res.status(500).json({ error: 'Could not refresh submissions right now.' });
  }
});

// Get all submissions for an assignment (teacher)
app.get('/api/assignments/:assignmentId/submissions', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });
    const readClient = getRequestScopedSupabase(req);
    let ownedAssignment = null;
    try {
      ownedAssignment = await ensureTeacherOwnsAssignment(req.params.assignmentId, user.id, readClient);
    } catch (accessError) {
      console.error('Could not verify teacher assignment access:', {
        assignmentRef: safeLogId(req.params.assignmentId),
        userRef: safeLogId(user.id),
        reason: safeLogError(accessError),
      });
      return res.status(400).json({ error: 'Could not verify access to this assignment. Please refresh and try again.' });
    }
    if (!ownedAssignment) return res.status(403).json({ error: 'You can only view submissions for your own assignments.' });
    // Ownership is verified above. The trusted read is required here because
    // teachers cannot directly select another user's profile through profile
    // RLS, even when that user submitted to the teacher's assignment.
    const { data, error: fetchError } = await querySubmissionsForAssignments(
      [req.params.assignmentId],
      supabase
    );
    if (fetchError) {
      console.error('Could not load assignment submissions:', {
        assignmentRef: safeLogId(req.params.assignmentId),
        reason: safeLogError(fetchError),
      });
      return res.status(400).json({ error: 'Could not load submissions for this assignment. Please refresh and try again.' });
    }
    res.json({ submissions: data });
  } catch (error) {
    console.error('Unexpected submissions list failure:', safeLogError(error));
    res.status(500).json({ error: 'Could not load submissions right now. Please refresh and try again.' });
  }
});

// Get the authenticated student's existing submissions without creating new rows
app.get('/api/student/submissions', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const readClient = getRequestScopedSupabase(req);

    const requestedAssignmentIds = String(req.query.assignmentIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const { data: memberships, error: membershipError } = await readClient
      .from('class_members')
      .select('class_id')
      .eq('student_id', user.id);
    if (membershipError) return res.status(400).json({ error: membershipError.message });

    const classIds = Array.from(new Set((memberships || []).map((entry) => entry.class_id).filter(Boolean)));
    if (!classIds.length) return res.json({ submissions: [] });

    let assignmentQuery = readClient
      .from('assignments')
      .select('id')
      .in('class_id', classIds)
      .eq('status', 'published');
    if (requestedAssignmentIds.length) {
      assignmentQuery = assignmentQuery.in('id', requestedAssignmentIds);
    }

    const { data: assignments, error: assignmentError } = await assignmentQuery;
    if (assignmentError) return res.status(400).json({ error: assignmentError.message });

    const assignmentIds = Array.from(new Set((assignments || []).map((assignment) => assignment.id).filter(Boolean)));
    if (!assignmentIds.length) return res.json({ submissions: [] });

    if (String(req.query.summary || '') === '1') {
      const { data: summaryRows, error: summaryError } = await readClient
        .from('submissions')
        .select([
          'id',
          'assignment_id',
          'student_id',
          'status',
          'teacher_review',
          'submitted_at',
          'updated_at',
          'version',
        ].join(','))
        .eq('student_id', user.id)
        .in('assignment_id', assignmentIds);
      if (summaryError) return res.status(400).json({ error: summaryError.message });
      return res.json({
        submissions: (summaryRows || []).map((submission) => ({
          ...normalizeStudentVisibleSubmission(submission),
          detail_loaded: false,
        })),
      });
    }

    const { data, error } = await readClient
      .from('submissions')
      .select([
        'id',
        'assignment_id',
        'student_id',
        'status',
        'draft_text',
        'final_text',
        'outline',
        'chat_history',
        'feedback_history',
        'self_assessment',
        'teacher_review',
        'chat_started_at',
        'chat_skipped_at',
        'chat_expired_at',
        'chat_elapsed_ms',
        'started_at',
        'submitted_at',
        'created_at',
        'updated_at',
        'version',
      ].join(','))
      .eq('student_id', user.id)
      .in('assignment_id', assignmentIds);
    if (error) return res.status(400).json({ error: error.message });

    const submissionIds = (data || []).map((submission) => submission.id).filter(Boolean);
    let revisions = [];
    if (submissionIds.length) {
      const { data: revisionRows, error: revisionError } = await supabase
        .from('submission_revisions')
        .select('submission_id, revision_number, snapshot, change_type, created_at')
        .in('submission_id', submissionIds)
        .in('change_type', ['submitted', 'reviewed'])
        .order('revision_number', { ascending: true });
      if (revisionError) return res.status(400).json({ error: revisionError.message });
      revisions = revisionRows || [];
    }

    const attempts = buildSubmissionAttemptList(data || [], revisions);
    res.json({ submissions: attempts.map(normalizeStudentVisibleSubmission) });
  } catch (error) {
    console.error('Unexpected student submissions failure:', safeLogError(error));
    res.status(500).json({ error: 'Could not load your submissions right now. Please refresh and try again.' });
  }
});

// Get or create student's own submission
app.get('/api/assignments/:assignmentId/my-submission', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const readClient = getRequestScopedSupabase(req);
    const accessibleAssignment = await ensureStudentCanAccessAssignment(req.params.assignmentId, user.id, readClient);
    if (!accessibleAssignment) {
      return res.status(403).json({ error: 'You do not have access to this assignment.' });
    }
    const submissionClient = readClient;
    let { data, error } = await submissionClient
      .from('submissions')
      .select('*')
      .eq('assignment_id', req.params.assignmentId)
      .eq('student_id', user.id)
      .single();
    if (error && error.code === 'PGRST116') {
      if (accessibleAssignment.classArchived === true) {
        return res.status(409).json({
          error: 'This course is archived. Previous work remains available, but new work cannot be started.',
        });
      }
      // No submission yet - create one using the student's authenticated session when available.
      const { data: newData, error: createError } = await submissionWriteWithFallback(req, (client) => client
        .from('submissions')
        .insert({
          assignment_id: req.params.assignmentId,
          student_id: user.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single());
      if (createError) return res.status(400).json({ error: createError.message });
      data = newData;
      await saveSubmissionRevision(data, user.id, 'started');
    } else if (error) {
      return res.status(isRlsDenial(error) ? 403 : 400).json({ error: error.message });
    }
    res.json({ submission: normalizeStudentVisibleSubmission(data) });
  } catch (error) {
    console.error('Unexpected my-submission failure:', safeLogError(error));
    res.status(500).json({ error: 'Could not load your submission right now. Please refresh and try again.' });
  }
});

function summarizeSubmissionForDebug(submission = null) {
  if (!submission) return null;
  const review = submission.teacher_review || submission.teacherReview || {};
  const rowScores = Array.isArray(review.rowScores || review.row_scores) ? (review.rowScores || review.row_scores) : [];
  const annotations = Array.isArray(review.annotations) ? review.annotations : [];
  return {
    id: submission.id || null,
    assignment_id: submission.assignment_id || submission.assignmentId || null,
    student_id: submission.student_id || submission.studentId || null,
    status: submission.status || null,
    submitted_at: submission.submitted_at || submission.submittedAt || null,
    updated_at: submission.updated_at || submission.updatedAt || null,
    teacher_review: {
      status: review.status || null,
      savedAt: review.savedAt || review.saved_at || null,
      finalScore: review.finalScore ?? review.final_score ?? null,
      finalNotesLength: String(review.finalNotes || review.final_notes || '').length,
      rowScoresCount: rowScores.length,
      annotationsCount: annotations.length,
    },
    finalTextLength: String(submission.final_text || submission.finalText || '').length,
    draftTextLength: String(submission.draft_text || submission.draftText || '').length,
  };
}

app.get('/api/debug/submission-state', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const profile = await getProfile(user.id);
    if (!profile) return res.status(409).json({ error: ACCOUNT_SETUP_INCOMPLETE_MESSAGE });

    const assignmentId = String(req.query.assignmentId || '').trim();
    if (!assignmentId) return res.status(400).json({ error: 'assignmentId required' });

    const readClient = getRequestScopedSupabase(req);
    let targetStudentId = String(req.query.studentId || '').trim();
    let assignment = null;

    if (profile.role === 'student') {
      targetStudentId = user.id;
      assignment = await ensureStudentCanAccessAssignment(assignmentId, targetStudentId, readClient);
      if (!assignment) return res.status(403).json({ error: 'You do not have access to this assignment.' });
    } else if (profile.role === 'teacher' || profile.role === 'admin') {
      if (!targetStudentId) return res.status(400).json({ error: 'studentId required for teacher debug' });
      assignment = await ensureTeacherOwnsAssignment(assignmentId, user.id, readClient);
      if (!assignment) return res.status(403).json({ error: 'You can only debug submissions for your own assignments.' });
    } else {
      return res.status(403).json({ error: 'Unsupported role for debug endpoint.' });
    }

    const scopedResult = await readClient
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', targetStudentId)
      .maybeSingle();

    const rawResult = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', targetStudentId)
      .maybeSingle();

    if (scopedResult.error) return res.status(400).json({ error: scopedResult.error.message });
    if (rawResult.error) return res.status(400).json({ error: rawResult.error.message });

    res.json({
      checkedAt: new Date().toISOString(),
      viewer: {
        id: user.id,
        role: profile.role,
      },
      assignment: {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        class_id: assignment.class_id,
      },
      targetStudentId,
      requestScoped: summarizeSubmissionForDebug(scopedResult.data),
      rawServer: summarizeSubmissionForDebug(rawResult.data),
      studentVisibleNormalized: summarizeSubmissionForDebug(normalizeStudentVisibleSubmission(rawResult.data)),
    });
  } catch (error) {
    console.error('Debug submission-state failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit student's own work atomically
app.post('/api/assignments/:assignmentId/submit', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const readClient = getRequestScopedSupabase(req);
    const accessibleAssignment = await ensureStudentCanModifyAssignment(req.params.assignmentId, user.id, readClient);
    if (!accessibleAssignment) {
      return res.status(409).json({
        error: 'This assignment is unavailable for new work. The course may be archived.',
      });
    }
    const idempotencyKey = getIdempotencyKey(req);
    const replay = await getIdempotentResponse(user.id, 'submit_assignment', idempotencyKey);
    if (replay?.response_body) {
      return res.status(replay.response_status || 200).json(replay.response_body);
    }

    const payload = sanitizeStudentSubmissionPayload(req.body);
    const submittedAt = new Date().toISOString();
    let nextPayload = {
      ...payload,
      status: 'submitted',
      submitted_at: submittedAt,
      teacher_review: createOpenTeacherReview(),
      updated_at: new Date().toISOString(),
    };

    const submissionClient = readClient;
    const { data: existing, error: existingError } = await submissionClient
      .from('submissions')
      .select('id, version, writing_events, keystroke_log')
      .eq('assignment_id', req.params.assignmentId)
      .eq('student_id', user.id)
      .maybeSingle();
    if (existingError) return res.status(isRlsDenial(existingError) ? 403 : 400).json({ error: existingError.message });

    if (existing?.id) {
      nextPayload = preserveProcessHistoryOnSubmit(nextPayload, existing);
      nextPayload.version = Number(existing.version || 1) + 1;
      const { data, error } = await submissionWriteWithFallback(req, (client) => client
        .from('submissions')
        .update(nextPayload)
        .eq('id', existing.id)
        .select('*, profiles(id, name)')
        .single());
      if (error) return res.status(isRlsDenial(error) ? 403 : 400).json({ error: error.message });
      await saveSubmissionRevision(data, user.id, 'submitted');
      await enqueueDomainEvent({
        eventType: 'submission_received',
        aggregateType: 'submission',
        aggregateId: data.id,
        idempotencyKey: `submission-received:${data.id}:${data.version}`,
        payload: {
          submissionId: data.id,
          assignmentId: data.assignment_id,
          studentId: data.student_id,
          version: data.version,
        },
      });
      processNotificationOutbox().catch((notifyError) => {
        console.error('Submission outbox processing failed:', notifyError);
      });
      const responseBody = { submission: data };
      await saveIdempotentResponse({
        userId: user.id,
        operation: 'submit_assignment',
        idempotencyKey,
        resourceType: 'submission',
        resourceId: data.id,
        responseStatus: 200,
        responseBody,
      });
      return res.json(responseBody);
    }

    const { data, error } = await submissionWriteWithFallback(req, (client) => client
      .from('submissions')
      .insert({
        assignment_id: req.params.assignmentId,
        student_id: user.id,
        started_at: nextPayload.started_at || new Date().toISOString(),
        ...nextPayload,
      })
      .select('*, profiles(id, name)')
      .single());
    if (error) return res.status(isRlsDenial(error) ? 403 : 400).json({ error: error.message });
    await saveSubmissionRevision(data, user.id, 'submitted');
    await enqueueDomainEvent({
      eventType: 'submission_received',
      aggregateType: 'submission',
      aggregateId: data.id,
      idempotencyKey: `submission-received:${data.id}:${data.version}`,
      payload: {
        submissionId: data.id,
        assignmentId: data.assignment_id,
        studentId: data.student_id,
        version: data.version,
      },
    });
    processNotificationOutbox().catch((notifyError) => {
      console.error('Submission outbox processing failed:', notifyError);
    });
    const responseBody = { submission: data };
    await saveIdempotentResponse({
      userId: user.id,
      operation: 'submit_assignment',
      idempotencyKey,
      resourceType: 'submission',
      resourceId: data.id,
      responseStatus: 200,
      responseBody,
    });
    res.json(responseBody);
  } catch (error) {
    console.error('Unexpected submit failure:', errorClassForLog(error));
    res.status(500).json({ error: 'Could not submit your work right now. Please try again.' });
  }
});

// Upsert a submission shell for teacher review/status updates
app.put('/api/assignments/:assignmentId/students/:studentId/submission', async (req, res) => {
  try {
    const { user, error: teacherError, status } = await requireTeacherProfile(req);
    if (teacherError) return res.status(status).json({ error: teacherError });

    const assignmentId = req.params.assignmentId;
    const studentId = req.params.studentId;
    const readClient = getRequestScopedSupabase(req);
    const ownedAssignment = await ensureTeacherOwnsAssignment(assignmentId, user.id, readClient);
    if (!ownedAssignment) return res.status(403).json({ error: 'You can only review submissions for your own assignments.' });
    const enrolledStudent = await ensureStudentBelongsToClass(ownedAssignment.class_id, studentId, readClient);
    if (!enrolledStudent) return res.status(400).json({ error: 'That student is not enrolled in this class.' });
    const payload = submissionPayloadWithGradedStatus({
      ...sanitizeTeacherSubmissionPayload(req.body),
      updated_at: new Date().toISOString(),
    });

    const submissionClient = readClient;
    let { data, error } = await submissionClient
      .from('submissions')
      .select('id, status, teacher_review')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });

    if (data?.id) {
      const { data: updated, error: updateError } = await submissionWriteWithFallback(req, (client) => client
        .from('submissions')
        .update(payload)
        .eq('id', data.id)
        .select('*, profiles(id, name)')
        .single());
      if (updateError) return res.status(400).json({ error: updateError.message });
      await enqueueSubmissionStatusNotifications(data, updated);
      processNotificationOutbox().catch((notifyError) => {
        console.error('Student review outbox processing failed:', notifyError);
      });
      return res.json({ submission: updated });
    }

    const { data: created, error: createError } = await submissionWriteWithFallback(req, (client) => client
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        started_at: payload.started_at || null,
        ...payload,
      })
      .select('*, profiles(id, name)')
      .single());

    if (createError) return res.status(400).json({ error: createError.message });
    await enqueueSubmissionStatusNotifications(null, created);
    processNotificationOutbox().catch((notifyError) => {
      console.error('Student review outbox processing failed:', notifyError);
    });
    res.json({ submission: created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Load heavy process data only when a student or owning teacher opens one
// submission. Class/assignment lists deliberately exclude event and chat arrays.
app.get('/api/submissions/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const readClient = getRequestScopedSupabase(req);
    const existing = await getSubmissionRecord(req.params.id, readClient);
    if (!existing) return res.status(404).json({ error: 'Submission not found' });

    if (existing.student_id !== user.id) {
      const ownedAssignment = await ensureTeacherOwnsAssignment(
        existing.assignment_id,
        user.id,
        readClient
      );
      if (!ownedAssignment) {
        return res.status(403).json({ error: 'You do not have permission to view this submission.' });
      }
    }

    const { data, error } = await readClient
      .from('submissions')
      .select('*, profiles(id, name)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) return res.status(isRlsDenial(error) ? 403 : 400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Submission not found' });
    res.json({ submission: { ...data, detail_loaded: true } });
  } catch (error) {
    console.error('Unexpected submission detail failure:', errorClassForLog(error));
    res.status(500).json({ error: 'Could not load this submission right now. Please try again.' });
  }
});

// Update submission
app.patch('/api/submissions/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const readClient = getRequestScopedSupabase(req);
    const submission = await getSubmissionRecord(req.params.id, readClient);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    let ownedAssignment = null;
    if (submission.student_id !== user.id) {
      ownedAssignment = await ensureTeacherOwnsAssignment(submission.assignment_id, user.id, readClient);
      if (!ownedAssignment) {
        return res.status(403).json({ error: 'You do not have permission to update this submission.' });
      }
    }
    const expectedUpdatedAt = req.body?.expected_updated_at;
    if (expectedUpdatedAt && submission.updated_at && expectedUpdatedAt !== submission.updated_at) {
      return res.status(409).json({
        error: 'Submission was modified by someone else. Please refresh and try again.',
        conflict: true,
        updated_at: submission.updated_at,
      });
    }
    const isStudentOwner = submission.student_id === user.id;
    if (isStudentOwner) {
      const editableAssignment = await ensureStudentCanModifyAssignment(
        submission.assignment_id,
        user.id,
        readClient
      );
      if (!editableAssignment) {
        return res.status(409).json({
          error: 'This course is archived. Previous work is read-only.',
        });
      }
    }
    let payload;
    if (isStudentOwner) {
      const built = await buildStudentPatchPayload(req.body, submission, readClient);
      if (built.conflict) {
        return res.status(409).json({
          error: 'Submission was modified by someone else. Please refresh and try again.',
          conflict: true,
          updated_at: submission.updated_at,
        });
      }
      payload = {
        ...built.payload,
        version: Number(submission.version || 1) + 1,
      };
    } else {
      payload = submissionPayloadWithGradedStatus({
        ...sanitizeTeacherSubmissionPayload(req.body),
        version: Number(submission.version || 1) + 1,
        updated_at: new Date().toISOString(),
      });
    }

    const responseSelection = isStudentOwner
      ? 'id, assignment_id, student_id, status, version, updated_at, submitted_at'
      : '*, profiles(id, name)';
    const { data, error } = await submissionWriteWithFallback(req, (client) => client
      .from('submissions')
      .update(payload)
      .eq('id', req.params.id)
      .eq('version', Number(submission.version || 1))
      .select(responseSelection)
      .maybeSingle());
    if (error) return res.status(isRlsDenial(error) ? 403 : 400).json({ error: error.message });
    if (!data) {
      return res.status(409).json({
        error: 'Submission was modified elsewhere. Refresh before saving again.',
        conflict: true,
      });
    }
    // The current submissions row and the browser recovery copy preserve every
    // autosave. Historical snapshots are reserved for meaningful milestones;
    // duplicating the growing process log on every keystroke pause caused
    // revision storage and read egress to grow quadratically.
    if (!isStudentOwner) {
      await saveSubmissionRevision(data, user.id, 'reviewed');
    }
    if (ownedAssignment) {
      if (teacherReviewWasNewlySaved(submission.teacher_review, data.teacher_review)) {
        await enqueueDomainEvent({
          eventType: 'submission_reviewed',
          aggregateType: 'submission',
          aggregateId: data.id,
          idempotencyKey: `submission-reviewed:${data.id}:${data.version}`,
          payload: { previousTeacherReview: submission.teacher_review || {} },
        });
      }
      if (submissionWasReopened(submission, data)) {
        await enqueueDomainEvent({
          eventType: 'submission_reopened',
          aggregateType: 'submission',
          aggregateId: data.id,
          idempotencyKey: `submission-reopened:${data.id}:${data.version}`,
          payload: { previousSubmission: submission },
        });
      }
      processNotificationOutbox().catch((notifyError) => {
        console.error('Student review outbox processing failed:', notifyError);
      });
    }
    res.json({ submission: data });
  } catch (error) {
    console.error('Unexpected submission PATCH failure:', errorClassForLog(error));
    res.status(500).json({ error: 'Could not save submission right now. Please try again.' });
  }
});

app.get('/api/submissions/:id/process-analysis', async (req, res) => {
  try {
    const context = await getProcessAnalysisContext(req, req.params.id);
    if (context.error) return res.status(context.status).json({ error: context.error });
    const result = sanitizeProcessAnalysisForViewer(
      await computeAndStoreProcessAnalysis(context, { store: true }),
      context.viewerProfile
    );
    res.json({
      analysis: result.analysis,
      stored: result.stored,
      inputHash: result.inputHash,
      storageWarning: result.storageError || '',
    });
  } catch (error) {
    console.error('Process analysis endpoint failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/submissions/:id/process-analysis/recompute', async (req, res) => {
  try {
    const context = await getProcessAnalysisContext(req, req.params.id);
    if (context.error) return res.status(context.status).json({ error: context.error });
    if (context.viewerProfile.role !== 'teacher' && context.viewerProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher access required' });
    }
    const result = sanitizeProcessAnalysisForViewer(
      await computeAndStoreProcessAnalysis(context, { store: true }),
      context.viewerProfile
    );
    res.json({
      analysis: result.analysis,
      stored: result.stored,
      inputHash: result.inputHash,
      storageWarning: result.storageError || '',
    });
  } catch (error) {
    console.error('Process analysis recompute failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/submissions/:id/process-label', async (req, res) => {
  try {
    const context = await getProcessAnalysisContext(req, req.params.id);
    if (context.error) return res.status(context.status).json({ error: context.error });
    if (context.viewerProfile.role !== 'teacher' && context.viewerProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher access required' });
    }

    const label = String(req.body?.label || '').trim().slice(0, 80);
    const notes = String(req.body?.notes || '').trim().slice(0, 2000);
    if (!label) return res.status(400).json({ error: 'label is required' });

    const analysisResult = await computeAndStoreProcessAnalysis(context, { store: true });
    const { data, error } = await supabase
      .from('submission_process_labels')
      .insert({
        submission_id: context.submission.id,
        analysis_id: analysisResult.stored?.id || null,
        reviewer_id: context.user.id,
        label,
        notes,
        excluded_from_training: Boolean(req.body?.excludedFromTraining),
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({
      label: data,
      analysis: sanitizeProcessAnalysisForViewer(analysisResult, context.viewerProfile).analysis,
      storageWarning: analysisResult.storageError || '',
    });
  } catch (error) {
    console.error('Process label save failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Admin endpoints ──────────────────────────────────────────

async function requireAdmin(req, res) {
  const user = await getUser(req);
  if (!user) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  const profile = await getProfile(user.id);
  if (profile?.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return null; }
  return user;
}

function isMissingProfileFlagColumn(error) {
  return Boolean(error?.message && /is_test_account|column .* does not exist/i.test(error.message));
}

function addDefaultProfileFlags(profile) {
  if (!profile) return profile;
  return {
    ...profile,
    is_test_account: Boolean(profile.is_test_account),
  };
}

function isStudentProfile(profile) {
  return String(profile?.role || '').trim().toLowerCase() === 'student';
}

app.get('/api/admin/writing-process/benchmarks', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const readClient = getRequestScopedSupabase(req);

    // Get all assignments with language level
    const { data: assignments, error: assignError } = await readClient
      .from('assignments')
      .select('id, language_level, class_id');
    if (assignError) return res.status(400).json({ error: assignError.message });

    // Get all submissions with writing events
    const assignmentIds = (assignments || []).map(a => a.id);
    if (!assignmentIds.length) return res.json({ byLevel: {} });

    const { data: submissions, error: subError } = await readClient
      .from('submissions')
      .select('id, assignment_id, student_id, writing_events, keystroke_log, teacher_review, final_text, draft_text, updated_at, submitted_at, started_at')
      .in('assignment_id', assignmentIds);
    if (subError) return res.status(400).json({ error: subError.message });

    // Exclude test accounts and consent-excluded students from the benchmark
    // pool. Read via the service role: exclude_from_writing_behavior is not
    // readable with a user token (consent stays invisible outside the server).
    let { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, is_test_account, exclude_from_writing_behavior')
      .or('is_test_account.eq.true,exclude_from_writing_behavior.eq.true');
    if (profError && isMissingProfileFlagColumn(profError)) {
      profiles = [];
      profError = null;
    }
    if (profError) return res.status(400).json({ error: profError.message });

    const excludedStudentIds = new Set((profiles || []).map(p => p.id));

    // Build assignment lookups for the shared writing-process analyzer.
    const assignmentById = {};
    for (const a of (assignments || [])) {
      assignmentById[a.id] = a;
    }

    // Group included submission metrics by CEFR level
    const byLevel = groupBenchmarkMetricsByLevel(submissions, assignmentById, excludedStudentIds);

    // Compute medians and ranges per level
    const median = arr => {
      if (!arr.length) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const round1 = v => v !== null ? Math.round(v * 10) / 10 : null;

    const result = {};
    for (const [level, data] of Object.entries(byLevel)) {
      result[level] = {
        level,
        total: data.total,
        included: data.included,
        excluded: data.excluded,
        measured: {
          typingRate: round1(median(data.typingRates)),
          longPausesPer100w: round1(median(data.longPausesPer100w)),
          localRevisionsPer100w: round1(median(data.localRevisionsPer100w)),
          productProcessRatio: round1(median(data.productProcessRatios)),
          pasteShare: round1(median(data.pasteShares)),
        },
      };
    }

    res.json({ byLevel: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/teachers', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const readClient = getRequestScopedSupabase(req);
    let { data, error } = await readClient
      .from('profiles')
      .select('id, name, role, created_at, is_test_account')
      .in('role', ['teacher', 'admin'])
      .order('created_at', { ascending: false });
    if (error && isMissingProfileFlagColumn(error)) {
      const retry = await readClient
        .from('profiles')
        .select('id, name, role, created_at')
        .in('role', ['teacher', 'admin'])
        .order('created_at', { ascending: false });
      data = (retry.data || []).map(addDefaultProfileFlags);
      error = retry.error;
    }
    if (error) return res.status(400).json({ error: error.message });
    // Get class counts per teacher
    const { data: classes } = await readClient
      .from('classes')
      .select('id, teacher_id, name');
    const { data: assignments } = await readClient
      .from('assignments')
      .select('id, class_id, status');
    const { data: members } = await readClient
      .from('class_members')
      .select('class_id, student_id');
    const teachers = (data || []).map(teacher => {
      const teacherClasses = (classes || []).filter(c => c.teacher_id === teacher.id);
      const classIds = teacherClasses.map(c => c.id);
      const teacherAssignments = (assignments || []).filter(a => classIds.includes(a.class_id));
      const teacherStudents = new Set((members || []).filter(m => classIds.includes(m.class_id)).map(m => m.student_id));
      return {
        ...teacher,
        classCount: teacherClasses.length,
        assignmentCount: teacherAssignments.length,
        publishedCount: teacherAssignments.filter(a => a.status === 'published').length,
        studentCount: teacherStudents.size,
        classes: teacherClasses,
      };
    });
    res.json({ teachers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/teachers/:teacherId/classes', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const readClient = getRequestScopedSupabase(req);
    let { data: classes, error } = await readClient
      .from('classes')
      .select('*, class_members(student_id, profiles(id, name, role, is_test_account))')
      .eq('teacher_id', req.params.teacherId)
      .order('created_at', { ascending: false });
    if (error && isMissingProfileFlagColumn(error)) {
      const retry = await readClient
        .from('classes')
        .select('*, class_members(student_id, profiles(id, name, role))')
        .eq('teacher_id', req.params.teacherId)
        .order('created_at', { ascending: false });
      classes = (Array.isArray(retry.data) ? retry.data : []).map((cls) => ({
        ...cls,
        class_members: (Array.isArray(cls.class_members) ? cls.class_members : []).map((member) => ({
          ...member,
          profiles: addDefaultProfileFlags(member.profiles),
        })),
      }));
      error = retry.error;
    }
    if (error) return res.status(400).json({ error: error.message });
    classes = (Array.isArray(classes) ? classes : []).map((cls) => ({
      ...cls,
      class_members: (Array.isArray(cls.class_members) ? cls.class_members : [])
        .filter((member) => isStudentProfile(member.profiles)),
    }));
    res.json({ classes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/classes/:classId/detail', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const readClient = getRequestScopedSupabase(req);
    const assignPromise = readClient.from('assignments').select('*').eq('class_id', req.params.classId).order('created_at', { ascending: false });
    let memberPromise = readClient.from('class_members').select('student_id, profiles(id, name, role, is_test_account)').eq('class_id', req.params.classId);
    let [assignData, memberData] = await Promise.all([
      assignPromise,
      memberPromise
    ]);
    if (memberData.error && isMissingProfileFlagColumn(memberData.error)) {
      memberData = await readClient.from('class_members').select('student_id, profiles(id, name, role)').eq('class_id', req.params.classId);
      memberData.data = (Array.isArray(memberData.data) ? memberData.data : []).map((member) => ({
        ...member,
        profiles: addDefaultProfileFlags(member.profiles),
      }));
    }
    if (assignData.error) return res.status(400).json({ error: assignData.error.message });
    if (memberData.error) return res.status(400).json({ error: memberData.error.message });
    const assignments = assignData.data || [];
    let members = (memberData.data || []).map(m => m.profiles).filter(isStudentProfile);
    // Merge the research-consent flag via the service role (the column is not
    // readable with a user token) so the admin UI can show/toggle it.
    if (members.length) {
      const { data: consentFlags } = await supabase
        .from('profiles')
        .select('id, exclude_from_writing_behavior')
        .in('id', members.map((member) => member.id));
      const consentById = new Map((consentFlags || []).map((row) => [row.id, Boolean(row.exclude_from_writing_behavior)]));
      members = members.map((member) => ({
        ...member,
        exclude_from_writing_behavior: consentById.get(member.id) || false,
      }));
    }
    // Get submissions for all assignments in this class
    const assignmentIds = assignments.map(a => a.id);
    let submissions = [];
    if (assignmentIds.length) {
      const { data: subs } = await querySubmissionsForAssignments(assignmentIds, readClient);
      submissions = subs || [];
    }
    res.json({ assignments, members, submissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/students/:studentId/flags', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const updates = {};
    if (req.body?.isTestAccount !== undefined) updates.is_test_account = Boolean(req.body.isTestAccount);
    // Research-consent exclusion (IRB): set by the PI for non-consenting
    // students. Admin-only — it is stripped from every other profile payload.
    if (req.body?.excludeFromWritingBehavior !== undefined) {
      updates.exclude_from_writing_behavior = Boolean(req.body.excludeFromWritingBehavior);
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No student flags provided.' });
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.studentId)
      .eq('role', 'student')
      .select('id, name, role, is_test_account, exclude_from_writing_behavior')
      .maybeSingle();
    if (error) {
      if (isMissingProfileFlagColumn(error)) {
        return res.status(400).json({
          error: 'Admin test-account flags are not active yet. Apply the latest profile admin flags migration, then try again.',
          needsMigration: true,
          migration: '20260507_profile_admin_flags.sql',
        });
      }
      return res.status(400).json({ error: error.message });
    }
    if (!data) return res.status(404).json({ error: 'Student profile not found.' });
    res.json({ profile: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Research exports & withdrawal (IRB pilot) ────────────────
// The research surveys are a deliberately separate, unlinkable channel.
// Never build any join between survey codes and app accounts.

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function rowsToCsv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

// Streams one of the v_research_* views as a CSV download. The views already
// exclude test accounts, consent-excluded students, and analytics-excluded
// analyses, and key rows by the stable salted pseudonym (never name/email/id).
async function sendResearchViewCsv(res, viewName, filename) {
  const { data, error } = await supabase
    .from(viewName)
    .select('*')
    .order('class_name', { ascending: true })
    .order('submitted_at', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  const rows = data || [];
  if (rows.some((row) => !row.student_pseudonym)) {
    return res.status(500).json({
      error: 'Research pseudonym salt is missing (research_config.pseudonym_salt). Export aborted so identities are never exposed.',
    });
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(rowsToCsv(rows));
}

app.get('/api/admin/research/process-metrics.csv', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    await sendResearchViewCsv(res, 'v_research_process_metrics', 'praxis-research-process-metrics.csv');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/research/reflections.csv', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    await sendResearchViewCsv(res, 'v_research_reflections', 'praxis-research-reflections.csv');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Withdrawal deletion (IRB): hard-deletes a withdrawing student's submissions,
// process analyses, and class memberships while the data is still identifiable,
// deliberately bypassing the research archive. Logs only the fact, date, and
// row counts — never which student or which admin.
app.delete('/api/admin/research/students/:studentId/data', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const studentId = req.params.studentId;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', studentId)
      .maybeSingle();
    if (profileError) return res.status(400).json({ error: profileError.message });
    if (profile?.role !== 'student') {
      return res.status(404).json({ error: 'Student profile not found.' });
    }
    if (/^P1-S\d/i.test(String(profile.name || '').trim())) {
      return res.status(400).json({ error: 'P1-S accounts are the retained pseudonymized Phase 1 dataset and must not be deleted.' });
    }

    const [subsResult, analysesResult, membershipsResult] = await Promise.all([
      supabase.from('submissions').select('id').eq('student_id', studentId),
      supabase.from('submission_process_analyses').select('id').eq('student_id', studentId),
      supabase.from('class_members').select('id').eq('student_id', studentId),
    ]);
    const countError = subsResult.error || analysesResult.error || membershipsResult.error;
    if (countError) return res.status(400).json({ error: countError.message });

    // Deleting submissions cascades to analyses and labels; the explicit
    // analyses delete catches any row whose submission was already gone.
    const submissionDelete = await supabase.from('submissions').delete().eq('student_id', studentId);
    if (submissionDelete.error) return res.status(400).json({ error: submissionDelete.error.message });
    const analysisDelete = await supabase.from('submission_process_analyses').delete().eq('student_id', studentId);
    if (analysisDelete.error) return res.status(400).json({ error: analysisDelete.error.message });
    const membershipDelete = await supabase.from('class_members').delete().eq('student_id', studentId);
    if (membershipDelete.error) return res.status(400).json({ error: membershipDelete.error.message });

    const counts = {
      submissions_deleted: (subsResult.data || []).length,
      analyses_deleted: (analysesResult.data || []).length,
      memberships_deleted: (membershipsResult.data || []).length,
    };
    const { error: logError } = await supabase.from('research_deletion_log').insert(counts);
    if (logError) console.error('Research deletion log write failed:', logError.message);
    res.json({ ok: true, deleted: counts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Assignment types (shared org-wide list, admin-managed) ───

function isMissingAssignmentTypesTable(error) {
  const msg = String(error?.message || '');
  return /assignment_types/.test(msg) && /(does not exist|schema cache|could not find|relation)/i.test(msg);
}

async function listAssignmentTypes() {
  const { data } = await supabase
    .from('assignment_types')
    .select('id, value')
    .order('value', { ascending: true });
  return data || [];
}

// Any authenticated user can read the shared list (teachers need it to build
// assignments). Returns an empty list rather than erroring if the migration
// has not been applied yet, so the built-in types still work.
app.get('/api/assignment-types', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { data, error } = await supabase
      .from('assignment_types')
      .select('id, value')
      .order('value', { ascending: true });
    if (error) {
      if (isMissingAssignmentTypesTable(error)) return res.json({ types: [] });
      return res.status(400).json({ error: error.message });
    }
    res.json({ types: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/assignment-types', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const value = String(req.body?.value || '').trim().toLowerCase().slice(0, 40);
    if (value.length < 2) {
      return res.status(400).json({ error: 'Enter an assignment type of at least 2 characters.' });
    }
    if (BASE_ASSIGNMENT_TYPES.includes(value)) {
      return res.status(400).json({ error: `"${value}" is already a built-in assignment type.` });
    }
    const { error } = await supabase
      .from('assignment_types')
      .upsert({ value, created_by: user.id }, { onConflict: 'value', ignoreDuplicates: true });
    if (error) {
      if (isMissingAssignmentTypesTable(error)) {
        return res.status(400).json({
          error: 'Assignment types are not set up yet. Apply the 20260603_assignment_types migration, then try again.',
          needsMigration: true,
          migration: '20260603_assignment_types.sql',
        });
      }
      return res.status(400).json({ error: error.message });
    }
    res.json({ types: await listAssignmentTypes() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/assignment-types/:id', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const { error } = await supabase
      .from('assignment_types')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ types: await listAssignmentTypes() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/process-analytics/recompute-stale', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const result = await recomputeStaleProcessAnalyses({
      limit: req.body?.limit || req.query?.limit || 50,
    });
    res.json({ result });
  } catch (error) {
    const message = error.message || String(error);
    res.status(500).json({
      error: message,
      needsMigration: /submission_process_analyses/i.test(message),
    });
  }
});

app.get('/api/admin/process-analytics', async (req, res) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const { data: analyses, error } = await supabase
      .from('submission_process_analyses')
      .select('id, submission_id, assignment_id, class_id, student_id, analysis_version, process_status, excluded_from_analytics, exclusion_sources, calculated_at');
    if (error) {
      return res.status(400).json({
        error: error.message,
        needsMigration: /submission_process_analyses/i.test(error.message || ''),
      });
    }

    const rows = analyses || [];
    const summary = {
      totalAnalyses: rows.length,
      includedAnalyses: rows.filter((row) => !row.excluded_from_analytics).length,
      excludedAnalyses: rows.filter((row) => row.excluded_from_analytics).length,
      versions: {},
      statuses: {},
      exclusionSources: {},
      cohortSampleSize: rows.filter((row) => !row.excluded_from_analytics).length,
    };

    rows.forEach((row) => {
      const version = row.analysis_version || 'unknown';
      const status = row.process_status || 'unknown';
      summary.versions[version] = (summary.versions[version] || 0) + 1;
      summary.statuses[status] = (summary.statuses[status] || 0) + 1;
      (Array.isArray(row.exclusion_sources) ? row.exclusion_sources : []).forEach((source) => {
        summary.exclusionSources[source] = (summary.exclusionSources[source] || 0) + 1;
      });
    });

    res.json({ summary, analyses: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Teacher AI submission review endpoint ─────────────────────────────

function buildTeacherAiReviewPrompt({
  assignmentTitle,
  studentEmail,
  studentText,
  wordCount,
  rubricCriteria = [],
  rubricTotal,
  integritySignals = {},
}) {
  const rubricText =
    Array.isArray(rubricCriteria) && rubricCriteria.length > 0
      ? rubricCriteria
          .map((criterion, index) => {
            const bands = Array.isArray(criterion.bands)
              ? criterion.bands
                  .map(
                    (band) =>
                      `- ${band.label}: ${band.points} pts — ${
                        band.description || ""
                      }`
                  )
                  .join("\n")
              : "";

            return `${index + 1}. ${criterion.name} (${criterion.points} pts)
${criterion.description || ""}
${bands}`;
          })
          .join("\n\n")
      : "No rubric was provided. Suggest a general score out of 100.";

  return `
You are helping a teacher review a student writing submission.

Important rules:
- You are NOT the final grader.
- Give suggestions only.
- The teacher must review and decide.
- Be fair, concise, and rubric-based.
- Do not accuse the student of cheating.
- Integrity signals are context only, not automatic grades.
- Return ONLY valid JSON. No markdown.

Assignment:
${assignmentTitle || "Untitled assignment"}

Student:
${studentEmail || "Unknown student"}

Word count:
${wordCount || "Unknown"}

Integrity context:
Paste attempts: ${integritySignals.pasteAttemptCount || 0}
Focus loss / tab switching: ${integritySignals.focusLossCount || 0}
AI/external flags: ${integritySignals.aiFlagCount || 0}
Student AI feedback checks used: ${integritySignals.feedbackChecksUsed || 0}

Rubric:
${rubricText}

Student submission:
"""
${studentText}
"""

Return JSON in this exact shape:
{
  "summary": "short teacher-facing summary",
  "suggestedFeedback": "student-facing feedback the teacher may choose to use",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "criteria": [
    {
      "criterionId": "criterion id from rubric",
      "criterionName": "criterion name",
      "score": 0,
      "bandLabel": "selected rubric level",
      "comment": "short reason"
    }
  ],
  "finalScore": 0
}
`;
}

function extractJsonFromAiText(text = "") {
  const clean = String(text || "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI response was not valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

app.post("/api/teacher/ai-review-submission", async (req, res) => {
    const skipAiAuthForTest =
    (
      process.env.DEV_SKIP_AI_AUTH === "true" &&
      isLocalDevRequest(req)
    ) ||
    isTrustedDemoRequest(req);

  const user = skipAiAuthForTest
    ? {
        id: "demo-ai-teacher-review-user",
      }
    : await getUser(req);

  if (!user) {
    return res.status(401).json({
      error: "Not authenticated",
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not configured on the backend.",
    });
  }

  const {
    submissionId,
    assignmentId,
    assignmentTitle,
    studentEmail,
    studentText,
    wordCount,
    rubricCriteria = [],
    rubricTotal,
    integritySignals = {},
  } = req.body || {};

  if (!studentText || !String(studentText).trim()) {
    return res.status(400).json({
      error: "Student text is required.",
    });
  }

  const prompt = buildTeacherAiReviewPrompt({
    assignmentTitle,
    studentEmail,
    studentText,
    wordCount,
    rubricCriteria,
    rubricTotal,
    integritySignals,
  });

  if (aiInputCharCount(prompt, [], "") > MAX_AI_INPUT_CHARS) {
    return res.status(413).json({
      error: "This submission is too large for AI review.",
    });
  }

  if (aiRequestsInFlight >= AI_MAX_CONCURRENT) {
    return res.status(429).json({
      error: "AI is busy right now. Please try again in a moment.",
      retryable: true,
    });
  }

  const velocity = checkAiVelocity(user.id);

  if (!velocity.allowed) {
    res.set("Retry-After", String(velocity.retryAfter));
    return res.status(429).json({
      error: "Too many AI requests in a short time. Please wait and try again.",
    });
  }

  aiRequestsInFlight += 1;

  try {
    const aiAbortController = new AbortController();
    const aiTimeoutId = setTimeout(
      () => aiAbortController.abort(),
      AI_TIMEOUT_MS
    );

    let response;

    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
          max_tokens: 1400,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
        signal: aiAbortController.signal,
      });
    } finally {
      clearTimeout(aiTimeoutId);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (
        response.status === 429 ||
        response.status === 503 ||
        response.status === 529
      ) {
        return res.status(429).json({
          error: "AI is busy right now. Please try again in a moment.",
          retryable: true,
        });
      }

      return res.status(response.status).json({
        error: data?.error?.message || "AI review request failed.",
      });
    }

    const text = data?.content?.[0]?.text || "";

    if (!text.trim()) {
      return res.status(502).json({
        error: "AI returned an empty response.",
      });
    }

    const parsed = extractJsonFromAiText(text);

    return res.json({
      submissionId,
      assignmentId,
      review: parsed,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "AI review timed out. Please try again.",
      });
    }

    console.error("Teacher AI review error:", errorClassForLog(error));

    return res.status(500).json({
      error: error.message || "Teacher AI review failed.",
    });
  } finally {
    aiRequestsInFlight -= 1;
  }
});

// Register Sentry after every route so handled Express failures are reported.
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  if (canSendNotificationEmails()) {
    getBackendSetupStatus()
      .then((setupStatus) => {
        if (
          !setupStatus.assignmentsTableReady ||
          !setupStatus.notificationOutboxTableReady ||
          !setupStatus.notificationDeliveriesTableReady ||
          !setupStatus.courseMessagesTableReady
        ) {
          console.log('Email notification jobs skipped: required persistence tables are not ready yet.');
          return;
        }

        processUpcomingDeadlineReminders().catch((error) => {
          console.error('Initial deadline reminder check failed:', error);
        });
        processNotificationOutbox().catch((error) => {
          console.error('Initial notification outbox check failed:', error);
        });
        if (deadlineReminderJob) clearInterval(deadlineReminderJob);
        deadlineReminderJob = setInterval(() => {
          processUpcomingDeadlineReminders().catch((error) => {
            console.error('Scheduled deadline reminder check failed:', error);
          });
        }, DEADLINE_REMINDER_POLL_MS);
        if (notificationOutboxJob) clearInterval(notificationOutboxJob);
        notificationOutboxJob = setInterval(() => {
          processNotificationOutbox().catch((error) => {
            console.error('Scheduled notification outbox check failed:', error);
          });
        }, 30_000);
      })
      .catch((error) => {
        console.error('Deadline reminder setup check failed:', error);
      });
  } else {
    console.log('Email notifications are disabled. Set RESEND_API_KEY and NOTIFY_FROM_EMAIL to enable publish/deadline emails.');
  }
});
