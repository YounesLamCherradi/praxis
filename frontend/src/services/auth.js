let session = null;

let profile = null;
let refreshPromise = null;
const API_TIMEOUT_MS = 20_000;
const API_RETRY_DELAYS_MS = [300, 900];

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function canRetryRequest(method, response, error) {
  if (String(method || "GET").toUpperCase() !== "GET") return false;
  if (error?.name === "AbortError") return false;
  if (error) return true;
  return [429, 502, 503, 504].includes(Number(response?.status || 0));
}

async function fetchWithPolicy(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  let lastError = null;

  for (let attempt = 0; attempt <= API_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = options.signal ? null : new AbortController();
    const timeoutId = controller
      ? globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
      : null;

    try {
      const response = await fetch(path, {
        ...options,
        signal: options.signal || controller.signal,
      });
      if (
        canRetryRequest(method, response, null) &&
        attempt < API_RETRY_DELAYS_MS.length
      ) {
        await wait(API_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (
        !canRetryRequest(method, null, error) ||
        attempt >= API_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }
      await wait(API_RETRY_DELAYS_MS[attempt]);
    } finally {
      if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Request failed.");
}

/* ===========================
   Session Helpers
=========================== */

export function getSession() {
  return session;
}

export function getProfile() {
  return profile;
}

export function getToken() {
  return null;
}

export function clearSession() {
  session = null;
  profile = null;

}

/* ===========================
   Headers
=========================== */

export function authHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

async function tryRefreshSession() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshSessionRequest();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshSessionRequest() {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));

    return response.ok && !data.error;
  } catch {
    return false;
  }
}

async function authenticatedResponse(path, options = {}) {
  const requestOptions = {
    ...options,
    credentials: "include",
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  };
  let response = await fetchWithPolicy(path, requestOptions);

  if (response.status === 401 && path !== "/api/auth/refresh") {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await fetchWithPolicy(path, requestOptions);
    }
  }

  return response;
}

/* ===========================
   Generic API Request
=========================== */

export async function apiFetch(path, options = {}) {
  const response = await authenticatedResponse(path, options);

  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text,
    };
  }
}

export async function requestJson(path, options = {}, {
  errorPrefix = "Request failed",
} = {}) {
  const response = await authenticatedResponse(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error || `${errorPrefix} (${response.status}).`);
    error.status = response.status;
    error.conflict = response.status === 409 || data.conflict === true;
    error.retryable = data.retryable === true;
    error.updatedAt = data.updated_at || null;
    throw error;
  }
  return data;
}

/* ===========================
   Authentication
=========================== */
export async function signIn(
  email,
  password,
  stayLoggedIn = true
) {
  const data = await fetch("/api/auth/signin", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      stayLoggedIn,
    }),
  }).then((r) => r.json());

  if (data.error) {
    throw new Error(data.error);
  }

  // Validate the returned profile
  if (!data.profile?.id || !data.profile?.role) {
    clearSession();
    throw new Error(
      "Your account setup is incomplete. Please contact your instructor or administrator."
    );
  }

  session = { mode: "cookie" };
  profile = data.profile;

  return profile;
}

export async function signOut() {
  try {
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
    });
  } finally {
    clearSession();
  }
}

export async function requestSignupCode(email, name = "") {
  const data = await fetch("/api/auth/signup/request-code", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, name }),
  }).then((r) => r.json());

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function signUp(name, email, password, role, otpCode = "") {
  if (!otpCode) {
    throw new Error("Verification code is required.");
  }
  return signUpWithCode(name, email, password, role, otpCode);
}

export async function signUpWithCode(name, email, password, role, otpCode) {
  const data = await fetch("/api/auth/signup", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
      role,
      otpCode,
    }),
  }).then((r) => r.json());

  if (data.error) {
    throw new Error(data.error);
  }

  // Automatically sign in after successful signup
  return await signIn(email, password);
}

export async function requestPasswordResetCode(email) {
  const data = await fetch("/api/auth/forgot-password", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  }).then((r) => r.json());

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function resetPasswordWithCode(email, code, password) {
  const data = await fetch("/api/auth/forgot-password/reset", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code, password }),
  }).then((r) => r.json());

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function restoreSession() {
  let data = await fetch("/api/auth/me", {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((r) => r.json());

  if (data.error) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      data = await fetch("/api/auth/me", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }).then((r) => r.json());
    }
  }

  if (data.error || !data.profile?.id || !data.profile?.role) {
    clearSession();
    return null;
  }

  profile = data.profile;
  session = { mode: "cookie" };
  return profile;
}


const AuthService = {
  getSession,
  getProfile,
  getToken,
  clearSession,
  authHeaders,
  apiFetch,
  requestJson,
  signIn,
  signUp,
  signUpWithCode,
  signOut,
  requestSignupCode,
  requestPasswordResetCode,
  resetPasswordWithCode,
  restoreSession,
};

export default AuthService;
