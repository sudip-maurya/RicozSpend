/** Authentication input validation helpers. */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN_LENGTH = 6;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 60;

/** Normalize email string. */
const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

const normalizeName = (name) => String(name ?? "").trim();

/** Validate signup payload. */
const validateSignup = ({ name, email, password } = {}) => {
  const errors = {};

  const cleanName = normalizeName(name);
  if (typeof name !== "string" || !cleanName) {
    errors.name = "Name is required.";
  } else if (cleanName.length < NAME_MIN_LENGTH) {
    errors.name = `Name must be at least ${NAME_MIN_LENGTH} characters long.`;
  } else if (cleanName.length > NAME_MAX_LENGTH) {
    errors.name = `Name must be at most ${NAME_MAX_LENGTH} characters long.`;
  }

  const cleanEmail = normalizeEmail(email);
  if (typeof email !== "string" || !cleanEmail) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(cleanEmail)) {
    errors.email = "Please enter a valid email address.";
  }

  const cleanPassword = typeof password === "string" ? password : "";
  if (!cleanPassword) {
    errors.password = "Password is required.";
  } else if (cleanPassword.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

/** Validate login payload. */
const validateLogin = ({ email, password } = {}) => {
  const errors = {};

  if (!normalizeEmail(email)) {
    errors.email = "Email is required.";
  }

  if (typeof password !== "string" || password.length === 0) {
    errors.password = "Password is required.";
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

module.exports = {
  EMAIL_PATTERN,
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  normalizeEmail,
  normalizeName,
  validateSignup,
  validateLogin,
};
