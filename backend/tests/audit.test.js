import { beforeAll, describe, expect, test } from "bun:test";
import { api, loginAs } from "./helpers/api.js";

let admin;

beforeAll(async () => {
    admin = await loginAs("admin");
});

describe("ticket audit trail", () => {
    test("returns the trail for an existing ticket", async () => {
        const { body: list } = await api("/tickets?pageSize=1", { token: admin.token });
        const { status, body } = await api(`/tickets/${list.data.tickets[0]._id}/audit`, { token: admin.token });
        expect(status).toBe(200);
        expect(body.data.map((entry) => entry.action)).toContain("created");
    });

    test("returns 404 for a well-formed id that matches no ticket", async () => {
        const { status, body } = await api("/tickets/000000000000000000000000/audit", { token: admin.token });
        expect(status).toBe(404);
        expect(body.error.code).toBe("TICKET_NOT_FOUND");
    });
});

describe("activity log (all tickets)", () => {
    test("admins get every entry, newest first, with the ticket and who did it", async () => {
        const admin = await loginAs("admin");
        const { status, body } = await api("/audit-logs?page=1&pageSize=5", { token: admin.token });
        expect(status).toBe(200);
        expect(body.data.entries).toHaveLength(5);
        expect(body.data.total).toBeGreaterThanOrEqual(40);
        const times = body.data.entries.map((entry) => new Date(entry.createdAt).getTime());
        expect([...times].sort((a, b) => b - a)).toEqual(times);
        expect(body.data.entries[0].ticketId).toHaveProperty("title");
    });

    test("agents and customers cannot read it", async () => {
        for (const role of ["agent", "customer"]) {
            const { token } = await loginAs(role);
            expect((await api("/audit-logs", { token })).status).toBe(403);
        }
    });

    test("seeded assignment entries name the agent, like entries the app records", async () => {
        const admin = await loginAs("admin");
        const { body } = await api("/audit-logs?page=1&pageSize=100", { token: admin.token });
        const assigned = body.data.entries.filter((entry) => entry.action === "assigned");
        expect(assigned.length).toBeGreaterThan(0);
        expect(assigned.filter((entry) => /^[a-f\d]{24}$/i.test(entry.changes.assignedTo))).toEqual([]);
    });
});
