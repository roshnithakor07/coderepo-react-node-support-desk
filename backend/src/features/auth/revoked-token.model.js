import mongoose from "mongoose";

// A signed-out session token, stored only as a SHA-256 hash. MongoDB deletes the entry once the
// token would have expired anyway (TTL index on expiresAt).
const revokedTokenSchema = new mongoose.Schema(
    {
        tokenHash: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false },
);

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedToken = mongoose.model("RevokedToken", revokedTokenSchema);
