import { withRedis } from "../config/redis.js";
import { AppError } from "../errors/app-error.js";

// Fixed-window counters kept in this process for when Redis is unavailable.
const memoryWindows = new Map();

function countInMemory(key, windowSeconds) {
    const now = Date.now();
    if (memoryWindows.size > 10_000) {
        for (const [storedKey, window] of memoryWindows) if (window.resetAt <= now) memoryWindows.delete(storedKey);
    }
    const window = memoryWindows.get(key);
    if (!window || window.resetAt <= now) {
        memoryWindows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return 1;
    }
    window.count += 1;
    return window.count;
}

export function rateLimit({ windowSeconds, max, keyPrefix }) {
    return async (request, response, next) => {
        try {
            const identifier = request.ip || request.socket.remoteAddress || "unknown";
            const key = `ratelimit:${keyPrefix}:${identifier}`;
            const redisCount = await withRedis(async (redis) => {
                const count = await redis.incr(key);
                if (count === 1) await redis.expire(key, windowSeconds);
                return count;
            }, null);
            const count = redisCount ?? countInMemory(key, windowSeconds);
            if (count > max) {
                throw new AppError(429, "RATE_LIMITED", "Too many requests. Please wait before trying again.");
            }
            next();
        } catch (error) {
            next(error);
        }
    };
}
