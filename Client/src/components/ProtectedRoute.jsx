import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/authContext";
import { GUARD_RESULT, resolveRouteGuard } from "../utils/routeGuard";

/** NOTE: UI-only guard - real security is the backend auth middleware. */
const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  const guardResult = resolveRouteGuard({ user, isRestoring, allowedRoles });

  if (guardResult === GUARD_RESULT.LOADING) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--loading" role="status">
          <div className="auth-spinner" aria-hidden="true" />
          <span>Restoring your session...</span>
        </div>
      </div>
    );
  }

  // Not authenticated -> back to Login, remembering where the user wanted to go.
  if (guardResult === GUARD_RESULT.REDIRECT_TO_LOGIN) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Authenticated but wrong role -> send them to their normal landing page.
  if (guardResult === GUARD_RESULT.REDIRECT_TO_DASHBOARD) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;

