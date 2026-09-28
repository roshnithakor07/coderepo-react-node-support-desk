// Starts an isolated API for the Playwright suite: its own database, Redis index and port,
// so browser tests never touch the development app or its data.
import Redis from "ioredis";
import path from "path";
import { fileURLToPath } from "url";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mongodbUri = process.env.E2E_MONGODB_URI || "mongodb://127.0.0.1:27017/support_desk_e2e";
const redisUrl = process.env.E2E_REDIS_URL || "redis://127.0.0.1:6379/2";

const databaseName = new URL(mongodbUri).pathname.slice(1);
if (!databaseName.endsWith("_e2e")) {
    throw new Error(`Refusing to start the e2e API on "${databaseName}": the database name must end with "_e2e".`);
}

// Bun loads backend/.env automatically; these values always take precedence.
process.env.MONGODB_URI = mongodbUri;
process.env.REDIS_URL = redisUrl;
process.env.PORT = process.env.E2E_API_PORT || "8100";
process.env.JWT_SECRET ||= "support-desk-e2e-secret";
process.env.WEBHOOK_SECRET ||= "support-desk-e2e-webhook-secret";

const seed = Bun.spawnSync(["bun", "src/scripts/seed.js"], { cwd: backendDirectory, env: process.env, stdout: "pipe", stderr: "pipe" });
if (seed.exitCode !== 0) {
    throw new Error(`Seeding the e2e database failed:\n${seed.stderr.toString() || seed.stdout.toString()}`);
}

// Clear login rate limits, logout blacklists and caches left by a previous run.
const redis = new Redis(redisUrl);
await redis.flushdb();
await redis.quit();

await import("../src/index.js");
