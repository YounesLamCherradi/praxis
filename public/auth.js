// auth.js — loaded before app.js
const Auth = (() => {
  let session = null;
  let profile = null;
  const ACCOUNT_SETUP_INCOMPLETE_MESSAGE = "Your login worked, but your account setup is incomplete. Please ask your teacher (if you're a student) or contact support so we can finish setting up your account.";

  function getSession() { return session; }
  function getProfile() { return profile; }
  function getToken() {
    const token = String(session?.access_token || '').trim();
    return token && token.split('.').length === 3 ? token : '';
  }
  function clearStoredSession() {
    session = null;
    profile = null;
    localStorage.removeItem('auizero_session');
    sessionStorage.removeItem('auizero_session');
  }
  function assertUsableProfile(nextProfile) {
    if (!nextProfile?.id || !nextProfile?.role) {
      clearStoredSession();
      throw new Error(ACCOUNT_SETUP_INCOMPLETE_MESSAGE);
    }
    return nextProfile;
  }

  function authHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  async function apiFetch(path, options = {}) {
    let res = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    if (res.status === 401) {
      const restored = await restoreSession();
      if (restored) {
        res = await fetch(path, {
          ...options,
          credentials: 'include',
          headers: { ...authHeaders(), ...(options.headers || {}) }
        });
      }
    }
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { error: text || `Request failed (${res.status})` };
    }
  }

  async function signIn(email, password, stayLoggedIn = true) {
    const data = await fetch('/api/auth/signin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, stayLoggedIn })
    }).then(r => r.json());
    if (data.error) throw new Error(data.error);
    session = { mode: 'cookie' };
    profile = assertUsableProfile(data.profile);
   return profile;
  }
  async function signUp(email, password, name, role) {
    const data = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role })
    }).then(r => r.json());
    if (data.error) throw new Error(data.error);
    // Auto sign in after signup
    return signIn(email, password);
  }

  async function signOut() {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders()
    });
    clearStoredSession();
  }

  async function refreshToken() {
    try {
      const data = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(r => r.json());
      if (data.error || !data.ok) return false;
      session = { mode: 'cookie' };
      return true;
    } catch {
      return false;
    }
  }

  async function restoreSession() {
    try {
      let data = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: authHeaders()
      }).then(r => r.json());
      if (data.error) {
        const refreshed = await refreshToken();
        if (refreshed) {
          data = await fetch('/api/auth/me', {
            credentials: 'include',
            headers: authHeaders()
          }).then(r => r.json());
        }
      }
      if (data.error) {
        clearStoredSession();
        return null;
      }
      if (!data.profile?.id || !data.profile?.role) {
        clearStoredSession();
        return null;
      }
      profile = data.profile;
      session = { mode: 'cookie' };
      return profile;
    } catch {
      clearStoredSession();
      return null;
    }
  }

async function getInviteInfo(classId) {
    try {
      const res = await fetch(`/api/classes/${classId}/invite`);
      return await res.json();
    } catch { return null; }
  }

  async function joinClassIfInvited() {
    const params = new URLSearchParams(globalThis.location.search);
    const classId = params.get('join');
    // Clear the URL param immediately regardless
    if (classId) globalThis.history.replaceState({}, '', globalThis.location.pathname);
    if (!classId) return;
    try {
      const res = await fetch(`/api/classes/${classId}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders()
      });
      if (!res.ok) console.warn('Could not join class:', res.status);
    } catch(e) {
      console.warn('Join class error:', e.message);
    }
  }

  async function requestPasswordReset(email) {
    const redirectTo = `${globalThis.location.origin}/?reset=1`;
    const data = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo })
    }).then(r => r.json());
    if (data.error) throw new Error(data.error);
    return true;
  }

  async function consumeRecoverySessionFromUrl() {
    const hash = new URLSearchParams(globalThis.location.hash.replace(/^#/, ''));
    const type = hash.get('type');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (type !== 'recovery' || !accessToken) return false;
    session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: hash.get('token_type') || 'bearer',
    };
    globalThis.history.replaceState({}, '', `${globalThis.location.pathname}?reset=1`);
    return true;
  }

  async function updatePassword(password) {
    const data = await fetch('/api/auth/update-password', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: JSON.stringify({ password })
    }).then(r => r.json());
    if (data.error) throw new Error(data.error);
    return true;
  }

  return { getSession, getProfile, getToken, authHeaders, apiFetch, signIn, signUp, signOut, refreshToken, restoreSession, joinClassIfInvited, getInviteInfo, requestPasswordReset, consumeRecoverySessionFromUrl, updatePassword };
})();
