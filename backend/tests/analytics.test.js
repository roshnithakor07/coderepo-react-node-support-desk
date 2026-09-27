import { beforeAll, describe, expect, test } from "bun:test";
import { api, loginAs } from "./helpers/api.js";

let admin;
let customer;

function isoDate(daysAgo = 0) {
    return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

async function dashboard(query = "") {
    const { status, body } = await api(`/analytics${query}`, { token: admin.token });
    expect(status).toBe(200);
    return body.data;
}

function createTicket(title) {
    return api("/tickets", {
        method: "POST",
        token: customer.token,
        body: { title, description: "Created by the analytics test suite.", priority: "medium" },
    });
}

beforeAll(async () => {
    [admin, customer] = await Promise.all([loginAs("admin"), loginAs("customer")]);
    // Guarantees at least one ticket created today, whatever time the suite runs.
    expect((await createTicket("Analytics range check")).status).toBe(201);
});

describe("date range", () => {
    test("a range ending today includes tickets created today", async () => {
        const today = await dashboard(`?dateFrom=${isoDate()}&dateTo=${isoDate()}`);
        expect(today.totalTickets).toBeGreaterThan(0);
    });

    test("the last 7 days include every seeded ticket, matching all time", async () => {
        const allTime = await dashboard();
        const lastWeek = await dashboard(`?dateFrom=${isoDate(7)}&dateTo=${isoDate()}`);
        expect(lastWeek.totalTickets).toBe(allTime.totalTickets);
    });

    for (const [label, query] of [
        ["a non-date start", "?dateFrom=not-a-date"],
        ["an impossible calendar date", "?dateTo=2026-02-30"],
        ["a start after the end", `?dateFrom=${isoDate()}&dateTo=${isoDate(3)}`],
    ]) {
        test(`${label} returns 400`, async () => {
            const { status, body } = await api(`/analytics${query}`, { token: admin.token });
            expect(status).toBe(400);
            expect(body.error.code).toBe("VALIDATION_ERROR");
        });
    }
});

describe("cache invalidation", () => {
    test("a new ticket shows up immediately, not after the cache expires", async () => {
        const before = await dashboard();
        expect((await createTicket("Analytics cache check")).status).toBe(201);
        const after = await dashboard();
        expect(after.totalTickets).toBe(before.totalTickets + 1);
    });

    test("resolving a ticket updates the resolved count immediately", async () => {
        const before = await dashboard();
        const { body } = await api("/tickets?status=open&pageSize=1", { token: admin.token });
        const resolved = await api(`/tickets/${body.data.tickets[0]._id}`, {
            method: "PUT",
            token: admin.token,
            body: { status: "resolved" },
        });
        expect(resolved.status).toBe(200);
        const after = await dashboard();
        expect(after.resolvedCount).toBe(before.resolvedCount + 1);
    });
});
