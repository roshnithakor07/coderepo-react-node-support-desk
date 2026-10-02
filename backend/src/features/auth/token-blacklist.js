// Signed-out tokens are kept in this process until they would have expired anyway.
const revokedTokens = new Map();

function prune(now) {
    for (const [token, expiresAt] of revokedTokens) if (expiresAt <= now) revokedTokens.delete(token);
}

export const tokenBlacklist = {
    revoke(token, ttlSeconds) {
        const now = Date.now();
        prune(now);
        revokedTokens.set(token, now + ttlSeconds * 1000);
    },

    isRevoked(token) {
        const expiresAt = revokedTokens.get(token);
        return Boolean(expiresAt && expiresAt > Date.now());
    },
};
