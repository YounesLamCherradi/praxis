export function getStoredAccessToken() {
  const possibleKeys = [
    "auizero_session",
    "supabase.auth.token",
    "sb-access-token",
  ];

  for (const key of possibleKeys) {
    try {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);

      const token =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token ||
        parsed?.data?.session?.access_token ||
        parsed?.user?.access_token;

      if (token) return token;
    } catch {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (raw && raw.split(".").length === 3) return raw;
    }
  }

  try {
    const allStorage = { ...localStorage, ...sessionStorage };

    for (const [key, value] of Object.entries(allStorage)) {
      if (!key.includes("auth-token") && !key.includes("supabase")) continue;

      const parsed = JSON.parse(value);

      const token =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token;

      if (token) return token;
    }
  } catch {
    // Missing token should not break local frontend testing.
  }

  return "";
}

export function buildAuthHeaders() {
  const token = getStoredAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}