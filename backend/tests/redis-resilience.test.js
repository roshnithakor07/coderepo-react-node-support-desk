import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getRedis } from "../src/shared/config/redis.js";
import { api, login, SEEDED_ACCOUNTS } from "./helpers/api.js";

async function waitForRedis(ready) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        if ((getRedis().status === "ready") === ready) return;
        await Bun.sleep(100);
    }
    throw new Error(`Redis did not become ${ready ? "ready" : "unavailable"} in time.`);
}

async function timed(promise) {
    const started = performance.now();
    const result = await promise;
    return { ...result, elapsed: performance.now() - started };
}

describe("with Redis unavailable", () => {
    let admin;

    beforeAll(async () => {
        getRedis().disconnect();
        await waitForRedis(false);
        const signIn = await login(SEEDED_ACCOUNTS.admin);
        expect(signIn.status).toBe(200);
        admin = signIn.body.data;
    });

    afterAll(async () => {
        await getRedis().connect();
        await waitForRedis(true);
    });

    test("health reports the API as degraded but serving, with Redis disconnected", async () => {
        const { status, body } = await api("/health");
        expect(status).toBe(200);
        expect(body.data).toEqual({ status: "degraded", database: "connected", redis: "disconnected" });
    });

    test("signed-in requests keep working, quickly", async () => {
        const response = await timed(api("/tickets?pageSize=5", { token: admin.token }));
        expect(response.status).toBe(200);
        expect(response.elapsed).toBeLessThan(1000);
    });

    test("analytics and settings are served without their cache", async () => {
        expect((await api("/analytics", { token: admin.token })).status).toBe(200);
        expect((await api("/settings", { token: admin.token })).status).toBe(200);
        const saved = await api("/settings", { method: "PUT", token: admin.token, body: { slaHours: { low: 24 } } });
        expect(saved.status).toBe(200);
    });

    test("signing out still revokes the token", async () => {
        const session = (await login(SEEDED_ACCOUNTS.customer)).body.data;
        expect((await api("/auth/me", { token: session.token })).status).toBe(200);
        expect((await api("/auth/logout", { method: "POST", token: session.token })).status).toBe(200);
        expect((await api("/auth/me", { token: session.token })).status).toBe(401);
    });

    test("rate limiting still applies", async () => {
        const attempt = () => api("/webhooks/email", { method: "POST", body: {} });
        const statuses = [];
        for (let index = 0; index < 31; index += 1) statuses.push((await attempt()).status);
        expect(statuses.at(-1)).toBe(429);
    });
});

describe("after Redis comes back", () => {
    test("health reports everything connected", async () => {
        const { status, body } = await api("/health");
        expect(status).toBe(200);
        expect(body.data).toEqual({ status: "ok", database: "connected", redis: "connected" });
    });
});
