/**
 * Authentication controllers (Part 2).
 *
 * Guarantees applied to every response:
 *  - passwords are never returned (only `toSafeObject()` is used)
 *  - `role` is never taken from the request body on signup (always Viewer)
 *  - internal errors are logged server-side and returned as generic messages
 */

const User = require("../models/User");
const { ROLES } = User;
const { MissingJwtSecretError, signToken, verifyToken } = require("../utils/token");
const RevokedToken = require("../models/RevokedToken");
const {
  EMAIL_PATTERN,
  normalizeEmail,
  normalizeName,
  validateSignup,
  validateLogin,
} = require("../utils/validation");
const {
  buildVerificationUrl,
  generateVerificationToken,
  getResendCooldownMs,
  getVerificationExpiryLabel,
  hashVerificationToken,
  isVerificationRequired,
  isVerificationTokenExpired,
} = require("../utils/verificationToken");
const { canExposeDevLink, sendVerificationEmail } = require("../services/emailService");

const DUPLICATE_KEY_ERROR = 11000;
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";
const RESEND_GENERIC_MESSAGE =
  "If an account with that email is waiting for verification, a new verification link has been sent.";

/**
 * Issue a fresh verification token, store its hash + expiry, and email the link.
 * Never throws: mail problems must not break signup/resend.
 */
const issueVerificationEmail = async (user) => {
  const { token, hash, expiresAt } = generateVerificationToken();
  await user.setEmailVerificationToken({ hash, expiresAt });

  const url = buildVerificationUrl(token);
  const result = await sendVerificationEmail({
    to: user.email,
    name: user.name,
    url,
    expiresInLabel: getVerificationExpiryLabel(),
  });

  return { url, ...result };
};

/** Map a Mongoose ValidationError to the same shape as our manual validation. */
const mongooseValidationErrors = (error) => {
  const errors = {};

  Object.values(error.errors || {}).forEach((fieldError) => {
    if (fieldError && fieldError.path) {
      errors[fieldError.path] = fieldError.message;
    }
  });

  return errors;
};

/**
 * POST /api/auth/signup
 * Public endpoint. Always creates a Viewer, never an Admin.
 */
const signup = async (req, res) => {
  const { name, email, password } = req.body || {};
  const { isValid, errors } = validateSignup({ name, email, password });

  if (!isValid) {
    return res.status(400).json({
      message: "Please check the highlighted fields and try again.",
      errors,
    });
  }

  const cleanName = normalizeName(name);
  const cleanEmail = normalizeEmail(email);

  try {
    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        errors: { email: "This email is already registered." },
      });
    }

    // `role` is intentionally ignored even if the client sends one: public
    // signup can only ever create a Viewer account.
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      role: ROLES.VIEWER,
      isEmailVerified: false,
    });

    const verification = await issueVerificationEmail(user);

    return res.status(201).json({
      message: "Account created successfully. Please check your email to verify your address.",
      user: user.toSafeObject(),
      emailVerification: {
        required: isVerificationRequired(),
        requiredBeforeLogin: isVerificationRequired(),
        emailSent: verification.delivered,
        deliveryMode: verification.mode,
        expiresIn: getVerificationExpiryLabel(),
        // Dev convenience only (no SMTP + not production): lets you verify without a mail server.
        devVerificationUrl: canExposeDevLink() ? verification.url : undefined,
      },
    });
  } catch (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        errors: { email: "This email is already registered." },
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Please check the highlighted fields and try again.",
        errors: mongooseValidationErrors(error),
      });
    }

    console.error("[auth] Signup failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * POST /api/auth/login
 * Verifies the bcrypt hash, then issues a JWT containing the user id + role.
 */
const login = async (req, res) => {
  const { email, password } = req.body || {};
  const { isValid, errors } = validateLogin({ email, password });

  if (!isValid) {
    return res.status(400).json({
      message: "Email and password are required.",
      errors,
    });
  }

  try {
    // `password` has `select: false`, so it must be asked for explicitly.
    const user = await User.findOne({ email: normalizeEmail(email) }).select("+password");

    // Same message for "no such user" and "wrong password" on purpose.
    if (!user) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    const isPasswordCorrect = await user.matchPassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    // MVP RBAC: deactivated accounts cannot log in (missing field = active).
    if (user.isActive === false) {
      return res.status(403).json({
        code: "ACCOUNT_DEACTIVATED",
        message: "Your account has been deactivated. Please contact an administrator.",
      });
    }

    // Part 2 - email verification gate (REQUIRE_EMAIL_VERIFICATION=false disables it).
    if (isVerificationRequired() && !user.isEmailVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Please verify your email address before logging in. Check your inbox for the verification link.",
        canResend: true,
      });
    }

    const token = signToken(user);

    return res.json({
      message: "Login successful.",
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    if (error instanceof MissingJwtSecretError) {
      console.error("[auth] Login failed:", error.message);
      return res.status(500).json({ message: "Server authentication is not configured." });
    }

    console.error("[auth] Login failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * GET /api/auth/me (protected)
 * Returns the safe profile of the currently authenticated user.
 */
const getCurrentUser = async (req, res) =>
  res.json({
    user: req.user.toSafeObject(),
  });

/**
 * POST /api/auth/verify-email  { token }
 * Consumes a one-time verification token (from the emailed link).
 */
const verifyEmail = async (req, res) => {
  const { token } = req.body || {};

  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({
      code: "MISSING_VERIFICATION_TOKEN",
      message: "A verification token is required.",
    });
  }

  try {
    const user = await User.findOne({
      emailVerificationTokenHash: hashVerificationToken(token.trim()),
    }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

    if (!user) {
      return res.status(400).json({
        code: "INVALID_VERIFICATION_TOKEN",
        message:
          "This verification link is invalid or has already been used. Please request a new one.",
        canResend: true,
      });
    }

    if (user.isEmailVerified) {
      return res.json({
        code: "ALREADY_VERIFIED",
        message: "Your email address is already verified. You can log in.",
        user: user.toSafeObject(),
      });
    }

    if (isVerificationTokenExpired(user.emailVerificationExpiresAt)) {
      return res.status(400).json({
        code: "VERIFICATION_TOKEN_EXPIRED",
        message: "This verification link has expired. Please request a new one.",
        canResend: true,
      });
    }

    await user.markEmailVerified();

    return res.json({
      message: "Email verified successfully. You can now log in.",
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("[auth] Email verification failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * POST /api/auth/resend-verification  { email }
 * Issues a new verification link (throttled) without leaking whether an account exists.
 */
const resendVerification = async (req, res) => {
  const { email } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  if (typeof email !== "string" || !cleanEmail || !EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({
      code: "INVALID_EMAIL",
      message: "Please enter a valid email address.",
      errors: { email: "Please enter a valid email address." },
    });
  }

  try {
    const user = await User.findOne({ email: cleanEmail }).select("+emailVerificationSentAt");

    // Same answer for unknown / already-verified accounts (no account enumeration).
    if (!user || user.isEmailVerified) {
      return res.json({ code: "RESEND_ACCEPTED", message: RESEND_GENERIC_MESSAGE });
    }

    const cooldownMs = getResendCooldownMs();
    const sentAt = user.emailVerificationSentAt ? new Date(user.emailVerificationSentAt).getTime() : 0;
    const elapsedMs = Date.now() - sentAt;

    if (sentAt && elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);

      return res.status(429).json({
        code: "RESEND_COOLDOWN",
        message: `Please wait ${retryAfterSeconds} second${
          retryAfterSeconds === 1 ? "" : "s"
        } before requesting another verification email.`,
        retryAfterSeconds,
      });
    }

    const verification = await issueVerificationEmail(user);

    return res.json({
      code: "RESEND_ACCEPTED",
      message: RESEND_GENERIC_MESSAGE,
      emailSent: verification.delivered,
      deliveryMode: verification.mode,
      expiresIn: getVerificationExpiryLabel(),
      devVerificationUrl: canExposeDevLink() ? verification.url : undefined,
    });
  } catch (error) {
    console.error("[auth] Resend verification failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * POST /api/auth/logout (protected)
 * Revokes the current JWT server-side by recording its `jti` in the
 * RevokedToken denylist (P1-5); the auth middleware rejects it afterwards.
 * The client still discards its own copy of the token.
 */
const logout = async (req, res) => {
  try {
    const decoded = verifyToken(req.token);
    if (decoded.jti && decoded.exp) {
      await RevokedToken.updateOne(
        { jti: decoded.jti },
        {
          $set: {
            userId: req.user._id,
            expiresAt: new Date(decoded.exp * 1000),
          },
        },
        { upsert: true }
      );
    }
    return res.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("[auth] Logout failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  verifyEmail,
  resendVerification,
  logout,
};