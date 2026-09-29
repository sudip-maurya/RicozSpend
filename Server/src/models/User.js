const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const {
  EMAIL_PATTERN,
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
} = require("../utils/validation");

/** User roles. */
const ROLES = {
  ADMIN: "Admin",
  VIEWER: "Viewer",
};

const ROLE_VALUES = Object.values(ROLES);

/** Password hash cost factor. */
const SALT_ROUNDS = 10;

/** User schema. */
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
      // Excluded by default from queries
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
    // Organization identifier
    organizationId: {
      type: String,
      trim: true,
      default: "ricozspend-default",
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // SHA-256 token hash
    emailVerificationTokenHash: {
      type: String,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      select: false,
    },
    // Throttling timestamp
    emailVerificationSentAt: {
      type: Date,
      select: false,
    },
    // Account active status
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
        // Exclude password from serialized output
        delete ret.password;
        return ret;
      },
    },
  }
);

/** Hash password before save. */
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

/** Compare password against stored hash. */
userSchema.methods.matchPassword = function matchPassword(candidatePassword) {
  if (!this.password) {
    return Promise.resolve(false);
  }

  return bcrypt.compare(candidatePassword, this.password);
};

/** Safe user representation for API responses. */
userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    organizationId: this.organizationId || "ricozspend-default",
    isEmailVerified: Boolean(this.isEmailVerified),
    isActive: this.isActive !== false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

/** Set email verification token. */
userSchema.methods.setEmailVerificationToken = function setEmailVerificationToken({ hash, expiresAt }) {
  this.emailVerificationTokenHash = hash;
  this.emailVerificationExpiresAt = expiresAt;
  this.emailVerificationSentAt = new Date();

  return this.save();
};

/** Mark email as verified. */
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
