const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const {
  EMAIL_PATTERN,
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
} = require("../utils/validation");

/** Application roles (Part 2: Admin / Viewer only). */
const ROLES = {
  ADMIN: "Admin",
  VIEWER: "Viewer",
};

const ROLE_VALUES = Object.values(ROLES);

/** bcrypt cost factor used when hashing passwords. */
const SALT_ROUNDS = 10;

/**
 * User document stored in the existing MongoDB Atlas database.
 * Field names follow the Part 2 spec: name, email, password, role + timestamps.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [NAME_MIN_LENGTH, `Name must be at least ${NAME_MIN_LENGTH} characters long.`],
      maxlength: [NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters long.`],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_PATTERN, "Please enter a valid email address."],
    },
    password: {
      // Stored as a bcrypt hash only. `select: false` keeps it out of normal queries.
      type: String,
      required: [true, "Password is required."],
      minlength: [PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ROLE_VALUES,
        message: `Role must be one of: ${ROLE_VALUES.join(", ")}.`,
      },
      default: ROLES.VIEWER,
      required: true,
    },
    /**
     * Workspace the account belongs to. Ownership of spend data is the
     * workspace (DATA OWNERSHIP = COMPANY/WORKSPACE); the user id on a
     * record is audit information only (AUDIT = CREATED BY USER).
     * Single-workspace deployment: every account shares the default org, and
     * every spend query is filtered by it so no company can see another's data.
     */
    organizationId: {
      type: String,
      trim: true,
      default: "ricozspend-default",
      index: true,
    },
    // Part 2 - email verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    /** SHA-256 hash of the verification token (the raw token only lives in the email link). */
    emailVerificationTokenHash: {
      type: String,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      select: false,
    },
    /** Used to throttle "resend verification email" requests. */
    emailVerificationSentAt: {
      type: Date,
      select: false,
    },
    /**
     * Account status for Admin user management (MVP).
     * true = active (can log in / call APIs), false = deactivated (blocked).
     * Additive only - existing documents without this field are treated as active.
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        // Never leak the password hash, whatever the caller asked to select.
        delete ret.password;
        return ret;
      },
    },
  }
);

/** Hash the password with bcrypt whenever it is set/changed. */
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

/** Compare a plain-text candidate password against the stored bcrypt hash. */
userSchema.methods.matchPassword = function matchPassword(candidatePassword) {
  if (!this.password) {
    return Promise.resolve(false);
  }

  return bcrypt.compare(candidatePassword, this.password);
};

/** Whitelisted, safe representation used by every auth API response. */
userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    organizationId: this.organizationId || "ricozspend-default",
    isEmailVerified: Boolean(this.isEmailVerified),
    // Missing (legacy) documents are treated as active.
    isActive: this.isActive !== false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

/** Store a new verification token hash + expiry and remember when it was sent. */
userSchema.methods.setEmailVerificationToken = function setEmailVerificationToken({ hash, expiresAt }) {
  this.emailVerificationTokenHash = hash;
  this.emailVerificationExpiresAt = expiresAt;
  this.emailVerificationSentAt = new Date();

  return this.save();
};

/** Mark the email as verified and remove the one-time token. */
userSchema.methods.markEmailVerified = function markEmailVerified() {
  this.isEmailVerified = true;
  this.emailVerificationTokenHash = undefined;
  this.emailVerificationExpiresAt = undefined;

  return this.save();
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.ROLE_VALUES = ROLE_VALUES;
module.exports.SALT_ROUNDS = SALT_ROUNDS;
