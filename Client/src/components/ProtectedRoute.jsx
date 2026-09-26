import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/authContext";
import { GUARD_RESULT, resolveRouteGuard } from "../utils/routeGuard";

/**
 * Frontend route guard (Part 2).
 *
 * NOTE: this only controls navigation/UI. Real security is enforced by the
 * backend middleware (Server/src/middleware/authMiddleware.js).
 *
 * Props:
 *  - children:     the protected page
 *  - allowedRoles: optional list of roles, e.g. ["Admin"]
 */
const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  const guardResult = resolveRouteGuard({ user, isRestoring, allowedRoles });

  if (guardResult === GUARD_RESULT.LOADING) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--loading" role="status">
          Restoring your session...
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

