import { AppError } from "../errors/app-error.js";
import { getRedis } from "../config/redis.js";

export function rateLimit({ windowSeconds, max, keyPrefix }) {
    return async (request, response, next) => {
        try {
            const redis = getRedis();
            const identifier = request.ip || request.socket.remoteAddress || "unknown";
            const key = `ratelimit:${keyPrefix}:${identifier}`;
            const count = await redis.incr(key);
            if (count === 1) await redis.expire(key, windowSeconds);
            if (count > max) {
                throw new AppError(429, "RATE_LIMITED", "Too many requests. Please wait before trying again.");
            }
            next();
        } catch (error) {
            next(error);
        }
    };
}
