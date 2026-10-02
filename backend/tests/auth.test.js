import { describe, expect, test } from "bun:test";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { RevokedToken } from "../src/features/auth/revoked-token.model.js";
import { User } from "../src/features/auth/user.model.js";
import { api } from "./helpers/api.js";

function newAccount(label) {
    return { name: `Registration ${label}`, email: `registration.${label}@example.com`, password: "Password123" };
}

describe("registration", () => {
    test("creates a customer account that is signed in immediately", async () => {
        const account = newAccount("customer");
        const { status, body } = await api("/auth/register", { method: "POST", body: account });
        expect(status).toBe(201);
        expect(body.data.user).toMatchObject({ email: account.email, role: "customer" });

        const me = await api("/auth/me", { token: body.data.token });
        expect(me.status).toBe(200);
        expect(me.body.data.role).toBe("customer");
    });

    for (const role of ["admin", "agent", "customer"]) {
        test(`rejects a self-assigned "${role}" role and creates no account`, async () => {
            const account = newAccount(`self-assigned-${role}`);
            const { status, body } = await api("/auth/register", { method: "POST", body: { ...account, role } });
            expect(status).toBe(400);
            expect(body.error.code).toBe("VALIDATION_ERROR");
            expect(await User.countDocuments({ email: account.email })).toBe(0);
        });
    }

    test("a newly registered customer cannot reach admin-only routes", async () => {
        const { body } = await api("/auth/register", { method: "POST", body: newAccount("no-admin-access") });
        const analytics = await api("/analytics", { token: body.data.token });
        expect(analytics.status).toBe(403);
        expect(analytics.body.error.code).toBe("FORBIDDEN");
    });
});

describe("sign out", () => {
    test("revokes the token, so it is refused on the next request", async () => {
        const { body } = await api("/auth/register", { method: "POST", body: newAccount("sign-out") });
        const token = body.data.token;
        expect((await api("/auth/me", { token })).status).toBe(200);
        expect((await api("/auth/logout", { method: "POST", token })).status).toBe(200);
        const after = await api("/auth/me", { token });
        expect(after.status).toBe(401);
        expect(after.body.error.code).toBe("INVALID_TOKEN");
    });
});

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function authenticateInNewProcess(token) {
    const result = Bun.spawnSync(["bun", "tests/helpers/authenticate-in-new-process.js"], {
        cwd: backendDirectory,
        env: { ...process.env, TOKEN_TO_CHECK: token },
        stdout: "pipe",
        stderr: "pipe",
    });
    return result.stdout.toString().trim();
}

describe("signed-out tokens are kept in MongoDB", () => {
    test("a signed-out token is still refused by a freshly started process (nothing held in memory)", async () => {
        const { body } = await api("/auth/register", { method: "POST", body: newAccount("sign-out-restart") });
        const token = body.data.token;
        expect(authenticateInNewProcess(token)).toBe("accepted");

        expect((await api("/auth/logout", { method: "POST", token })).status).toBe(200);
        expect(authenticateInNewProcess(token)).toBe("401 INVALID_TOKEN");
    });

    test("only a hash of the token is stored, and it expires when the token would have", async () => {
        const { body } = await api("/auth/register", { method: "POST", body: newAccount("sign-out-stored") });
        const token = body.data.token;
        await api("/auth/logout", { method: "POST", token });

        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const stored = await RevokedToken.findOne({ tokenHash }).lean();
        const { exp } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        expect(stored.expiresAt.getTime()).toBe(exp * 1000);
        expect(await RevokedToken.countDocuments({ tokenHash: token })).toBe(0);

        const indexes = await RevokedToken.collection.indexes();
        expect(indexes.find((index) => index.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
    });
});
