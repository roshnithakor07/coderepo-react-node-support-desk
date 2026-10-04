import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import bcrypt from "bcryptjs";
import { clearRateLimits } from "../src/shared/middleware/rate-limit.js";
import { login, SEEDED_ACCOUNTS } from "./helpers/api.js";

const GENERIC = { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." };

// Signing in with a deactivated account says so, but only to someone who knows its password: a wrong
// password or an unknown email gets the same answer as any other failed sign-in, and the password
// check runs every time, so neither the answer nor the time it takes reveals which emails exist.
describe("signing in with a deactivated account", () => {
    let compare;

    beforeAll(clearRateLimits);
    afterAll(clearRateLimits);
    afterEach(() => compare?.mockRestore());

    function watchPasswordChecks() {
        compare = spyOn(bcrypt, "compare");
        return compare;
    }

    test("the right password is told the account is deactivated (403)", async () => {
        const checks = watchPasswordChecks();
        const { status, body } = await login(SEEDED_ACCOUNTS.inactiveAgent);
        expect(status).toBe(403);
        expect(body.error).toEqual({
            code: "ACCOUNT_DEACTIVATED",
            message: "Your account has been deactivated. Contact your administrator.",
        });
        expect(body).not.toHaveProperty("data");
        expect(checks).toHaveBeenCalledTimes(1);
    });

    test("a wrong password gets the generic answer (401)", async () => {
        const checks = watchPasswordChecks();
        const { status, body } = await login(SEEDED_ACCOUNTS.inactiveAgent, "not-the-password");
        expect(status).toBe(401);
        expect(body.error).toEqual(GENERIC);
        expect(checks).toHaveBeenCalledTimes(1);
    });

    test("an unknown email gets the same generic answer (401), after a password check", async () => {
        const checks = watchPasswordChecks();
        const { status, body } = await login("nobody-here@example.com");
        expect(status).toBe(401);
        expect(body.error).toEqual(GENERIC);
        expect(checks).toHaveBeenCalledTimes(1);
    });

    test("an active account's wrong password still gets the generic answer", async () => {
        const checks = watchPasswordChecks();
        const { status, body } = await login(SEEDED_ACCOUNTS.agent, "not-the-password");
        expect(status).toBe(401);
        expect(body.error).toEqual(GENERIC);
        expect(checks).toHaveBeenCalledTimes(1);
    });
});
