/** Authentication and role authorization middleware. */

const User = require("../models/User");
const { MissingJwtSecretError, verifyToken } = require("../utils/token");
const RevokedToken = require("../models/RevokedToken");

const UNAUTHORIZED_MESSAGE = "Authentication required. Please log in.";
const EXPIRED_MESSAGE = "Your session has expired. Please log in again.";
const INVALID_MESSAGE = "Invalid authentication token. Please log in again.";
const FORBIDDEN_MESSAGE = "You do not have permission to access this resource.";
const DEACTIVATED_MESSAGE = "Your account has been deactivated. Please contact an administrator.";
const REVOKED_MESSAGE = "Your session has been revoked. Please log in again.";

/** Extract bearer token from Authorization header. */
const extractToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || "";

  if (typeof header === "string" && header.trim()) {
    const [scheme, value] = header.trim().split(/\s+/);
    if (/^bearer$/i.test(scheme) && value) {
      return value;
    }
    if (!value && scheme) {
      return scheme;
    }
  }

  return null;
};

/** Verify JWT and attach user to req.user. */
const protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
  }

  try {
    const decoded = verifyToken(token);

    // Check token revocation denylist
    if (decoded.jti) {
      const revoked = await RevokedToken.findOne({ jti: decoded.jti }).lean();
      if (revoked) {
        return res.status(401).json({ message: REVOKED_MESSAGE });
      }
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: INVALID_MESSAGE });
    }

    // Reject deactivated accounts
    if (user.isActive === false) {
      return res.status(403).json({ message: DEACTIVATED_MESSAGE });
    }

    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    if (error instanceof MissingJwtSecretError) {
      console.error("[auth] JWT_SECRET is missing from the server environment.");
      return res.status(500).json({ message: "Server authentication is not configured." });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: EXPIRED_MESSAGE });
    }

    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
      return res.status(401).json({ message: INVALID_MESSAGE });
    }

    console.error("[auth] Unexpected authentication error:", error.message);
    return res.status(401).json({ message: INVALID_MESSAGE });
  }
};

/** Role-based access control guard. */
const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
    }

    const allowed = allowedRoles
      .flat()
      .filter(Boolean)
      .map((role) => String(role).toLowerCase());

    if (!allowed.includes(String(req.user.role).toLowerCase())) {
      return res.status(403).json({ message: FORBIDDEN_MESSAGE });
    }

    return next();
  };

module.exports = {
  protect,
  requireRole,
  extractToken,
  UNAUTHORIZED_MESSAGE,
  EXPIRED_MESSAGE,
  INVALID_MESSAGE,
  FORBIDDEN_MESSAGE,
  DEACTIVATED_MESSAGE,
  REVOKED_MESSAGE,
};
