function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Supabase returns ordinary authentication failures as `{ error }`, while
 * temporary DNS/socket/header timeouts throw. Retry only the thrown transport
 * failures so an invalid token is never treated differently.
 */
async function getAuthenticatedUser(
  authClient,
  token,
  { attempts = 2, retryDelayMs = 150 } = {}
) {
  if (!token) return null;

  let lastTransportError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const {
        data: { user } = {},
        error,
      } = await authClient.auth.getUser(token);

      if (error || !user) return null;
      return user;
    } catch (error) {
      lastTransportError = error;
      if (attempt + 1 < attempts && retryDelayMs > 0) {
        await wait(retryDelayMs);
      }
    }
  }

  throw lastTransportError;
}

module.exports = {
  getAuthenticatedUser,
};
