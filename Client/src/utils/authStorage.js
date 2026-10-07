/** Authentication session storage. */

const TOKEN_KEY = "ricozspend.auth.token";
const USER_KEY = "ricozspend.auth.user";

/** Event fired when the API reports an expired/invalid session (see api/client.js). */
export const SESSION_EXPIRED_EVENT = "ricozspend:session-expired";

const storage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const getToken = () => {
  const store = storage();

  if (!store) return null;

  try {
    return store.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getStoredUser = () => {
  const store = storage();

  if (!store) return null;

  try {
    const raw = store.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Corrupted value: drop it instead of breaking the app on boot.
    clearSession();
    return null;
  }
};

export const saveSession = ({ token, user }) => {
  const store = storage();

  if (!store || !token) return;

  try {
    store.setItem(TOKEN_KEY, token);
    if (user) store.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota / private-mode errors; the in-memory state still works.
  }
};

export const clearSession = () => {
  const store = storage();

  if (!store) return;

  try {
    store.removeItem(TOKEN_KEY);
    store.removeItem(USER_KEY);
  } catch {
    // Nothing else to do here.
  }
};
