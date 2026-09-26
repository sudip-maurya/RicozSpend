/**
 * Revoked JWTs (server-side logout, P1-5).
 *
 * JWTs are stateless, so "logout" needs a denylist: when a user logs out, the
 * token's `jti` is stored here and `protect` rejects it on every later request.
 * The TTL index auto-deletes each entry when the token would have expired
 * anyway, so the collection stays tiny. Tokens issued before the `jti` claim
 * existed simply skip the check.
 */

const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false }
);

// Auto-remove each revocation when its token's natural expiry passes.
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RevokedToken =
  mongoose.models.RevokedToken || mongoose.model("RevokedToken", revokedTokenSchema);

module.exports = RevokedToken;
