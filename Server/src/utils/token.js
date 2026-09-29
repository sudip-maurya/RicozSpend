/** JWT token generation and verification helpers. */

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

/** Sign JWT with user ID, role, and jti claim. */
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

/** Verify JWT token. */
const verifyToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  DEFAULT_EXPIRES_IN,
  MissingJwtSecretError,
  getJwtSecret,
  getJwtExpiresIn,
  signToken,
  verifyToken,
};
