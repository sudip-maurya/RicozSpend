import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext } from "./authContext";
import { isAdminRole } from "../constants/roles";
import { fetchCurrentUser, login as loginRequest, signup as signupRequest, logout as logoutRequest } from "../services/authService";
import { SESSION_EXPIRED_EVENT, clearSession, getStoredUser, getToken, saveSession } from "../utils/authStorage";

/** Keep only the fields the UI is allowed to use (never the password). */
const toClientUser = (apiUser) =>
  apiUser
    ? {
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        role: apiUser.role,
        isEmailVerified: Boolean(apiUser.isEmailVerified),
        // Missing (legacy) field means active.
        isActive: apiUser.isActive !== false,
        createdAt: apiUser.createdAt,
        updatedAt: apiUser.updatedAt,
      }
    : null;

/**
 * Authentication state for the whole app (Part 2).
 *
 * - keeps the current user, role and token
 * - restores the session from the stored JWT after a refresh
 * - clears everything on logout or when the token expires
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => toClientUser(getStoredUser()));
  const [token, setToken] = useState(() => getToken());
  const [isRestoring, setIsRestoring] = useState(true);

  const clearAuthState = useCallback(() => {
    clearSession();
    setUser(null);
    setToken(null);
  }, []);

  // Restore the session on first render / browser refresh.
  useEffect(() => {
    let isActive = true;

    const restoreSession = async () => {
      const storedToken = getToken();

      if (!storedToken) {
        if (isActive) {
          setUser(null);
          setToken(null);
          setIsRestoring(false);
        }
        return;
      }

      try {
        const { data } = await fetchCurrentUser();

        if (!isActive) return;

        const freshUser = toClientUser(data?.user);
        setUser(freshUser);
        setToken(storedToken);
        saveSession({ token: storedToken, user: freshUser });
      } catch {
        // Token missing/expired/deleted user -> start over from Login.
        if (!isActive) return;
        clearSession();
        setUser(null);
        setToken(null);
      } finally {
        if (isActive) setIsRestoring(false);
      }
    };

    restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  // A 401 from any API call means the session is gone.
  useEffect(() => {
    const handleSessionExpired = () => clearAuthState();

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [clearAuthState]);

  const login = useCallback(async ({ email, password }) => {
    const { data } = await loginRequest({ email, password });
    const nextUser = toClientUser(data?.user);

    if (!data?.token || !nextUser) {
      throw new Error("Login response did not include a session.");
    }

    saveSession({ token: data.token, user: nextUser });
    setUser(nextUser);
    setToken(data.token);

    return nextUser;
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    const { data } = await signupRequest({ name, email, password });
    return data;
  }, []);

  const logout = useCallback(() => {
    // P1-5: revoke the JWT server-side; never let a failed request keep the
    // local session alive (offline logout must still work).
    logoutRequest().catch(() => {});
    clearAuthState();
  }, [clearAuthState]);

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user && token),
      isAdmin: isAdminRole(user?.role),
      isViewer: Boolean(user) && !isAdminRole(user?.role),
      isRestoring,
      login,
      signup,
      logout,
    }),
    [user, token, isRestoring, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
