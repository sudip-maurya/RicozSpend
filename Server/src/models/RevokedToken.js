/** Revoked JWT token denylist schema. */

const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false }
);

// TTL index to auto-delete expired entries
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RevokedToken =
  mongoose.models.RevokedToken || mongoose.model("RevokedToken", revokedTokenSchema);

module.exports = RevokedToken;
