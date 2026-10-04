import { beforeAll, describe, expect, test } from "bun:test";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { User } from "../src/features/auth/user.model.js";
import { api, loginAs, SEEDED_ACCOUNTS } from "./helpers/api.js";

let admin;
let agent;
let customer;

function stats(token) {
    return api("/tickets/stats", { token });
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
});

describe("dashboard ticket counts", () => {
    test('"stats" is read as its own route, not as a ticket id', async () => {
        const { status, body } = await stats(admin.token);
        expect(status).toBe(200);
        expect(body.data).toMatchObject({
            total: expect.any(Number),
            open: expect.any(Number),
            resolved: expect.any(Number),
            breached: expect.any(Number),
        });
    });

    test("the counts cover every ticket the role may see, not one page of them", async () => {
        const [summary, firstPage] = await Promise.all([stats(admin.token), api("/tickets?pageSize=5", { token: admin.token })]);
        expect(summary.body.data.total).toBe(firstPage.body.data.total);
        expect(summary.body.data.total).toBeGreaterThan(firstPage.body.data.tickets.length);
    });

    test("open and resolved add up to the total", async () => {
        const { body } = await stats(admin.token);
        expect(body.data.open + body.data.resolved).toBe(body.data.total);
    });

    test("they match what the database holds for an admin", async () => {
        const { body } = await stats(admin.token);
        const [total, open, breached] = await Promise.all([
            Ticket.countDocuments(),
            Ticket.countDocuments({ status: { $in: ["open", "in_progress", "pending"] } }),
            Ticket.countDocuments({ slaBreached: true }),
        ]);
        expect(body.data).toMatchObject({ total, open, breached });
    });

    test("an agent is counted on their own assignments only", async () => {
        const { body } = await stats(agent.token);
        const agentRecord = await User.findOne({ email: SEEDED_ACCOUNTS.agent }).lean();
        const assigned = await Ticket.countDocuments({ assignedTo: agentRecord._id });
        expect(body.data.total).toBe(assigned);

        const adminSummary = await stats(admin.token);
        expect(body.data.total).toBeLessThan(adminSummary.body.data.total);
    });

    test("a customer is counted on the tickets they opened only", async () => {
        const { body } = await stats(customer.token);
        const customerRecord = await User.findOne({ email: SEEDED_ACCOUNTS.customer }).lean();
        const opened = await Ticket.countDocuments({ createdBy: customerRecord._id });
        expect(body.data.total).toBe(opened);
    });

    test("the counts ignore the filters applied to the ticket list", async () => {
        const [summary, filtered] = await Promise.all([
            stats(admin.token),
            api("/tickets?status=closed&pageSize=100", { token: admin.token }),
        ]);
        expect(filtered.body.data.total).toBeLessThan(summary.body.data.total);
        expect((await stats(admin.token)).body.data.total).toBe(summary.body.data.total);
    });

    test("SLA compliance is the share of tickets that never breached, for every role", async () => {
        for (const session of [admin, agent, customer]) {
            const { body } = await stats(session.token);
            const { total, breached, slaComplianceRate } = body.data;
            const expected = total > 0 ? Number((((total - breached) / total) * 100).toFixed(1)) : 100;
            expect(slaComplianceRate).toBe(expected);
        }
    });

    test("an admin's SLA compliance matches the database and the all-time Analytics figure", async () => {
        const [{ body }, analytics, total, breached] = await Promise.all([
            stats(admin.token),
            api("/analytics", { token: admin.token }),
            Ticket.countDocuments(),
            Ticket.countDocuments({ slaBreached: true }),
        ]);
        expect(body.data.slaComplianceRate).toBe(Number((((total - breached) / total) * 100).toFixed(1)));
        expect(body.data.slaComplianceRate).toBe(analytics.body.data.slaComplianceRate);
    });

    test("signing in is required", async () => {
        const { status } = await api("/tickets/stats");
        expect(status).toBe(401);
    });
});
