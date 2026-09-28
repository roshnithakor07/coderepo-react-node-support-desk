import Redis from "ioredis";

let redisClient = null;
let lastReportedState = null;

// Log connection changes once instead of on every reconnect attempt.
function reportState(state, error) {
    if (state === lastReportedState) return;
    lastReportedState = state;
    if (state === "ready") console.log("Redis connected.");
    else console.error(`Redis unavailable (${error?.message || "connection closed"}); caching is off and limits fall back to memory.`);
}

// Commands fail immediately while Redis is unavailable, so callers fall back instead of waiting.
export function connectRedis(url) {
    redisClient = new Redis(url, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    redisClient.on("ready", () => reportState("ready"));
    redisClient.on("error", (error) => reportState("error", error));
    return redisClient;
}

export function getRedis() {
    if (!redisClient) throw new Error("Redis not connected. Call connectRedis() first.");
    return redisClient;
}

export function isRedisReady() {
    return redisClient?.status === "ready";
}

// Runs a Redis operation, or returns the fallback when Redis is unavailable or the command fails.
export async function withRedis(operation, fallback) {
    if (!isRedisReady()) return fallback;
    try {
        return await operation(redisClient);
    } catch (error) {
        reportState("error", error);
        return fallback;
    }
}

export async function disconnectRedis() {
    if (!redisClient) return;
    if (isRedisReady()) await redisClient.quit();
    else redisClient.disconnect();
}
