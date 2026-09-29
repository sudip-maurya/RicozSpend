/** Email verification token utilities. */

const crypto = require("crypto");

const DEFAULT_EXPIRY = "1h";
const DEFAULT_RESEND_COOLDOWN = "60s";

const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parse duration string into milliseconds. */
const parseDurationMs = (value, fallbackValue) => {
  const match = String(value || fallbackValue).trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);

  if (!match) {
    return UNIT_MS[fallbackValue.slice(-1)] * Number(fallbackValue.slice(0, -1));
  }

  const amount = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();

  return amount * UNIT_MS[unit];
};

const getVerificationExpiryMs = () =>
  parseDurationMs(process.env.EMAIL_VERIFICATION_EXPIRES_IN, DEFAULT_EXPIRY);

const getResendCooldownMs = () =>
  parseDurationMs(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN, DEFAULT_RESEND_COOLDOWN);

/** Human-readable expiry label. */
const getVerificationExpiryLabel = () => {
  const minutes = Math.max(1, Math.round(getVerificationExpiryMs() / 60_000));

  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
};

/** Check if email verification is enabled. */
const isVerificationRequired = () => String(process.env.REQUIRE_EMAIL_VERIFICATION || "true").toLowerCase() !== "false";

const hashVerificationToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

/** Generate verification token, SHA-256 hash, and expiry. */
const generateVerificationToken = () => {
  const token = crypto.randomBytes(32).toString("hex");

  return {
    token,
    hash: hashVerificationToken(token),
    expiresAt: new Date(Date.now() + getVerificationExpiryMs()),
  };
};

/** Build verification link URL. */
const buildVerificationUrl = (token) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
};

const isVerificationTokenExpired = (expiresAt) => !expiresAt || new Date(expiresAt).getTime() < Date.now();

module.exports = {
  DEFAULT_EXPIRY,
  DEFAULT_RESEND_COOLDOWN,
  parseDurationMs,
  getVerificationExpiryMs,
  getVerificationExpiryLabel,
  getResendCooldownMs,
  isVerificationRequired,
  hashVerificationToken,
  generateVerificationToken,
  buildVerificationUrl,
  isVerificationTokenExpired,
};
