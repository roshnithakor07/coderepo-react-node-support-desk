import { beforeAll, describe, expect, test } from "bun:test";
import { api, loginAs } from "./helpers/api.js";

let admin;

beforeAll(async () => {
    admin = await loginAs("admin");
});

function expectCleanError(response, status, code) {
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(JSON.stringify(response.body)).not.toMatch(/stack|at .+\.js:\d+|CastError|BSON/);
}

describe("malformed ids in the URL", () => {
    const requests = [
        ["GET", "/tickets/not-an-id"],
        ["PUT", "/tickets/not-an-id", { status: "open" }],
        ["POST", "/tickets/not-an-id/replies", { body: "Hello" }],
        ["POST", "/tickets/not-an-id/assign", { agentId: "000000000000000000000000" }],
        ["GET", "/tickets/not-an-id/audit"],
        ["PATCH", "/agents/not-an-id/status", { isActive: true }],
        ["DELETE", "/canned-responses/not-an-id"],
    ];

    for (const [method, path, body] of requests) {
        test(`${method} ${path} returns 400 INVALID_ID`, async () => {
            expectCleanError(await api(path, { method, token: admin.token, body }), 400, "INVALID_ID");
        });
    }

    test("a well-formed id that does not exist still returns 404", async () => {
        expectCleanError(await api("/tickets/000000000000000000000000", { token: admin.token }), 404, "TICKET_NOT_FOUND");
    });
});

describe("malformed ids in the query string", () => {
    test("filtering tickets by a malformed assignee id returns 400", async () => {
        expectCleanError(await api("/tickets?assignedTo=not-an-id", { token: admin.token }), 400, "INVALID_ID");
    });
});

describe("request bodies", () => {
    test("malformed JSON returns 400 INVALID_JSON", async () => {
        expectCleanError(await api("/auth/login", { method: "POST", body: '{"email":' }), 400, "INVALID_JSON");
    });

    test("a body over the 100 KB limit returns 413 PAYLOAD_TOO_LARGE", async () => {
        const body = JSON.stringify({ email: "a".repeat(120_000) });
        expectCleanError(await api("/auth/login", { method: "POST", body }), 413, "PAYLOAD_TOO_LARGE");
    });
});
