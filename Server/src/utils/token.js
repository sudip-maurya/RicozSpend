/**
 * JWT helpers (Part 2).
 *
 * The secret and expiration always come from environment variables
 * (Server/.env -> JWT_SECRET, JWT_EXPIRES_IN). No secret is ever hardcoded.
 */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const DEFAULT_EXPIRES_IN = "1d";

class MissingJwtSecretError extends Error {
  constructor() {
    super("JWT_SECRET is not configured. Add JWT_SECRET=<random string> to Server/.env and restart the server.");
    this.name = "MissingJwtSecretError";
  }
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new MissingJwtSecretError();
  }

  return secret;
};

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;

/**
 * Sign a token that identifies the user and carries the role used by the
 * role-based authorization middleware. A random `jti` lets the server revoke
 * individual tokens (see POST /api/auth/logout + models/RevokedToken.js).
 */
const signToken = (user) =>
  jwt.sign(
    {
      id: String(user._id || user.id),
      role: user.role,
      jti: crypto.randomBytes(16).toString("hex"),
    },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );

/** Verify a token. Throws (TokenExpiredError / JsonWebTokenError / ...) when invalid. */
const verifyToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  DEFAULT_EXPIRES_IN,
  MissingJwtSecretError,
  getJwtSecret,
  getJwtExpiresIn,
  signToken,
  verifyToken,
};
