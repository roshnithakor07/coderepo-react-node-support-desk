import { afterAll } from "bun:test";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/shared/config/database.js";
import { initConfig } from "../src/shared/config/index.js";
import { connectRedis, disconnectRedis, getRedis } from "../src/shared/config/redis.js";
import { captureSeedBaseline } from "./helpers/baseline.js";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mongodbUri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/support_desk_test";
const redisUrl = process.env.TEST_REDIS_URL || "redis://127.0.0.1:6379/1";

const databaseName = new URL(mongodbUri).pathname.slice(1);
if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${databaseName}": the test database name must end with "_test".`);
}

// Bun loads backend/.env automatically; the test database and Redis index always take precedence.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = mongodbUri;
process.env.REDIS_URL = redisUrl;
process.env.JWT_SECRET ||= "support-desk-test-secret";
process.env.JWT_EXPIRES_IN ||= "1h";
process.env.WEBHOOK_SECRET ||= "support-desk-test-webhook-secret";

const seed = Bun.spawnSync(["bun", "src/scripts/seed.js"], { cwd: backendDirectory, env: process.env, stdout: "pipe", stderr: "pipe" });
if (seed.exitCode !== 0) {
    throw new Error(`Seeding the test database failed:\n${seed.stderr.toString() || seed.stdout.toString()}`);
}

initConfig();
connectRedis(redisUrl);
try {
    // Commands do not queue while Redis connects, so wait until it is ready.
    await new Promise((resolve, reject) => {
        if (getRedis().status === "ready") return resolve();
        getRedis().once("ready", resolve);
        setTimeout(() => reject(new Error("timed out connecting")), 5000);
    });
    await getRedis().flushdb();
} catch (error) {
    throw new Error(`Redis is required for tests at ${redisUrl}: ${error.message}`);
}
await connectDatabase(mongodbUri);
await captureSeedBaseline();

const server = createApp().listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
process.env.TEST_API_URL = `http://127.0.0.1:${server.address().port}/api/v1`;

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    await disconnectRedis();
});
