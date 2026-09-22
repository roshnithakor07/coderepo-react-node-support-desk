import Redis from "ioredis";

let redisClient = null;

export function connectRedis(url) {
    redisClient = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    redisClient.on("error", (error) => console.error(`Redis error: ${error.message}`));
    return redisClient;
}

export function getRedis() {
    if (!redisClient) throw new Error("Redis not connected. Call connectRedis() first.");
    return redisClient;
}

export async function disconnectRedis() {
    if (redisClient) await redisClient.quit();
}
