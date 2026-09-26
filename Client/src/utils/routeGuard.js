/**
 * Pure route-guard decision logic (Part 2).
 *
 * Kept separate from the component so it can be unit-tested without a browser:
 * ProtectedRoute maps the returned result onto a redirect / loading / page.
 *
 * NOTE: this is UI-only. The backend middleware is the real security boundary.
 */

export const GUARD_RESULT = {
  /** Session is still being restored from the stored token. */
  LOADING: "loading",
  /** No authenticated user -> send to the Login page. */
  REDIRECT_TO_LOGIN: "redirect-to-login",
  /** Authenticated but missing the required role -> send to the Dashboard. */
  REDIRECT_TO_DASHBOARD: "redirect-to-dashboard",
  /** Allowed to render the protected page. */
  ALLOW: "allow",
};

export const resolveRouteGuard = ({ user = null, isRestoring = false, allowedRoles = null } = {}) => {
  if (isRestoring) {
    return GUARD_RESULT.LOADING;
  }

  if (!user) {
    return GUARD_RESULT.REDIRECT_TO_LOGIN;
  }

  if (allowedRoles?.length) {
    const allowed = allowedRoles.map((role) => String(role).toLowerCase());
    const currentRole = String(user.role || "").toLowerCase();

    if (!allowed.includes(currentRole)) {
      return GUARD_RESULT.REDIRECT_TO_DASHBOARD;
    }
  }

  return GUARD_RESULT.ALLOW;
};
