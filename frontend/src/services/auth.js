const SESSION_KEY = "auizero_session";
const PROFILE_KEY = "auizero_profile";

let session = JSON.parse(
  localStorage.getItem(SESSION_KEY) ||
  sessionStorage.getItem(SESSION_KEY) ||
  "null"
);

let profile = JSON.parse(
  localStorage.getItem(PROFILE_KEY) ||
  sessionStorage.getItem(PROFILE_KEY) ||
  "null"
);

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
  return session?.access_token || null;
}

export function clearSession() {
  session = null;
  profile = null;

  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);

 localStorage.removeItem(PROFILE_KEY);
 sessionStorage.removeItem(PROFILE_KEY);
}

/* ===========================
   Headers
=========================== */

export function authHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/* ===========================
   Generic API Request
=========================== */

export async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
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

  session = data.session;
  profile = data.profile;

  if (stayLoggedIn) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
} else {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

  return profile;
}

export async function signOut() {
  try {
    await fetch("/api/auth/signout", {
      method: "POST",
      headers: authHeaders(),
    });
  } finally {
    clearSession();
  }
}

export async function signUp(name, email, password, role) {
  const data = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
      role,
    }),
  }).then((r) => r.json());

  if (data.error) {
    throw new Error(data.error);
  }

  // Automatically sign in after successful signup
  return await signIn(email, password);
}


const AuthService = {
  getSession,
  getProfile,
  getToken,
  clearSession,
  authHeaders,
  apiFetch,
  signIn,
  signUp,
  signOut,
};

export default AuthService;
