import { describe, expect, test } from "bun:test";
import { api, login, loginAs, SEEDED_ACCOUNTS } from "./helpers/api.js";

describe("health", () => {
    test("reports the API and MongoDB as up", async () => {
        const { status, body } = await api("/health");
        expect(status).toBe(200);
        expect(body.data).toEqual({ status: "ok", database: "connected" });
    });
});

describe("sign in", () => {
    for (const role of ["admin", "agent", "customer"]) {
        test(`seeded ${role} can sign in and load their session`, async () => {
            const session = await loginAs(role);
            expect(session.token).toBeString();
            expect(session.user).toMatchObject({ email: SEEDED_ACCOUNTS[role], role, isActive: true });
            expect(session.user).not.toHaveProperty("password");

            const me = await api("/auth/me", { token: session.token });
            expect(me.status).toBe(200);
            expect(me.body.data).toMatchObject({ email: SEEDED_ACCOUNTS[role], role });
        });
    }

    test("an inactive agent cannot sign in", async () => {
        const { status, body } = await login(SEEDED_ACCOUNTS.inactiveAgent);
        expect(status).toBe(403);
        expect(body.error.code).toBe("ACCOUNT_DEACTIVATED");
    });

    test("a wrong password is rejected without revealing which field was wrong", async () => {
        const { status, body } = await login(SEEDED_ACCOUNTS.admin, "not-the-password");
        expect(status).toBe(401);
        expect(body.error).toEqual({ code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    });

    test("protected routes require a token", async () => {
        const { status, body } = await api("/tickets");
        expect(status).toBe(401);
        expect(body.error.code).toBe("AUTH_REQUIRED");
    });
});
