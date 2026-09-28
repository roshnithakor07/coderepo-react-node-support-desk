import { withRedis } from "../../shared/config/redis.js";

// Signed-out tokens are stored in Redis, with a copy in this process so signing out still
// revokes a token while Redis is unavailable.
const revokedInMemory = new Map();

function prune(now) {
    for (const [token, expiresAt] of revokedInMemory) if (expiresAt <= now) revokedInMemory.delete(token);
}

export const tokenBlacklist = {
    async revoke(token, ttlSeconds) {
        const now = Date.now();
        prune(now);
        revokedInMemory.set(token, now + ttlSeconds * 1000);
        await withRedis((redis) => redis.set(`token-blacklist:${token}`, "1", "EX", ttlSeconds), null);
    },

    async isRevoked(token) {
        const expiresAt = revokedInMemory.get(token);
        if (expiresAt && expiresAt > Date.now()) return true;
        return Boolean(await withRedis((redis) => redis.get(`token-blacklist:${token}`), null));
    },
};
