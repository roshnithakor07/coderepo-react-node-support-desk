import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getRedis } from "../src/shared/config/redis.js";
import { api } from "./helpers/api.js";

async function clearRegisterLimit() {
    const keys = await getRedis().keys("ratelimit:register:*");
    if (keys.length > 0) await getRedis().del(...keys);
}

function request(path, { method = "GET", origin, headers = {} } = {}) {
    return fetch(`${process.env.TEST_API_URL}${path}`, { method, headers: { ...(origin ? { Origin: origin } : {}), ...headers } });
}

describe("registration rate limit", () => {
    beforeAll(clearRegisterLimit);
    afterAll(clearRegisterLimit);

    test("the 11th registration attempt within 10 minutes is refused", async () => {
        const attempt = () => api("/auth/register", { method: "POST", body: { name: "", email: "not-an-email", password: "short" } });
        for (let index = 0; index < 10; index += 1) expect((await attempt()).status).toBe(400);
        const limited = await attempt();
        expect(limited.status).toBe(429);
        expect(limited.body.error.code).toBe("RATE_LIMITED");
    });
});

describe("CORS", () => {
    test("allows the configured frontend origin", async () => {
        const response = await request("/health", { origin: "http://localhost:3000" });
        expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    });

    test("does not allow other origins", async () => {
        const response = await request("/health", { origin: "https://evil.example" });
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("a preflight from another origin gets no CORS permission", async () => {
        const response = await request("/tickets", {
            method: "OPTIONS",
            origin: "https://evil.example",
            headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
        });
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
});

describe("security headers", () => {
    const expected = {
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
        "cross-origin-resource-policy": "same-site",
    };

    for (const path of ["/health", "/tickets", "/no-such-route"]) {
        test(`are sent on ${path}`, async () => {
            const response = await request(path);
            for (const [header, value] of Object.entries(expected)) expect(response.headers.get(header)).toBe(value);
            expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
            expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
            expect(response.headers.get("x-powered-by")).toBeNull();
        });
    }
});
