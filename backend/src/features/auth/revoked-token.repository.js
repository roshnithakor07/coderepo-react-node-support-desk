import { RevokedToken } from "./revoked-token.model.js";

export const revokedTokenRepository = {
    revoke: (tokenHash, expiresAt) => RevokedToken.updateOne({ tokenHash }, { $set: { expiresAt } }, { upsert: true }),
    isRevoked: async (tokenHash) => Boolean(await RevokedToken.exists({ tokenHash })),
};
