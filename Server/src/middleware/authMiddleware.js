/**
 * Authentication + role based authorization middleware (Part 2).
 *
 * The client sends the JWT in the `Authorization: Bearer <token>` header, which
 * is attached automatically by Client/src/api/client.js.
 */

const User = require("../models/User");
const { MissingJwtSecretError, verifyToken } = require("../utils/token");
const RevokedToken = require("../models/RevokedToken");

const UNAUTHORIZED_MESSAGE = "Authentication required. Please log in.";
const EXPIRED_MESSAGE = "Your session has expired. Please log in again.";
const INVALID_MESSAGE = "Invalid authentication token. Please log in again.";
const FORBIDDEN_MESSAGE = "You do not have permission to access this resource.";
const DEACTIVATED_MESSAGE = "Your account has been deactivated. Please contact an administrator.";
const REVOKED_MESSAGE = "Your session has been revoked. Please log in again.";

/** Extract the bearer token from the Authorization header. */
const extractToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || "";

  if (typeof header === "string" && header.trim()) {
    const [scheme, value] = header.trim().split(/\s+/);
    if (/^bearer$/i.test(scheme) && value) {
      return value;
    }
    // Tolerate a raw token being sent without the "Bearer" prefix.
    if (!value && scheme) {
      return scheme;
    }
  }

  return null;
};

/**
 * Require a valid JWT and attach the current user to `req.user`.
 * Missing / invalid / expired tokens all answer 401 with a generic message.
 */
const protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
  }

  try {
    const decoded = verifyToken(token);

    // P1-5: reject tokens revoked via POST /api/auth/logout. Tokens issued
    // before the `jti` claim existed skip this check gracefully.
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

    // Deactivated accounts lose all API access (missing field = active).
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

/**
 * Reusable role guard, e.g. `requireRole("Admin")`.
 * Must be used after `protect`. Answers 401 without a user and 403 for a
 * valid user whose role is not allowed.
 */
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
