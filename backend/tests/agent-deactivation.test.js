import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AuditLog } from "../src/features/audit-logs/audit-log.model.js";
import { User } from "../src/features/auth/user.model.js";
import { Notification } from "../src/features/notifications/notification.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, loginAs } from "./helpers/api.js";

// Deactivating an agent hands their open tickets on in the same action: to the least-loaded active agent
// who covers each one's category, or to the unassigned queue when nobody does. It is refused when they
// are the last active cover for a category that still has open work.

const OPEN = ["open", "in_progress", "pending"];

let admin;
let agent;
let customer;
let startedAt;

// Everything this file changes, put back exactly as it was so the shared database ends where it began.
const ticketSnapshots = new Map();
const userSnapshots = new Map();
const touchedTickets = new Set();
const createdTickets = [];
const createdUsers = [];

async function userByEmail(email) {
    const user = await User.findOne({ email }).lean();
    if (!userSnapshots.has(email)) userSnapshots.set(email, { categories: user.categories, isActive: user.isActive });
    return user;
}

async function snapshotTicketsOf(user) {
    const tickets = await Ticket.find({ assignedTo: user._id }).lean();
    for (const ticket of tickets) {
        ticketSnapshots.set(String(ticket._id), { assignedTo: ticket.assignedTo, unassignedNotifiedAt: ticket.unassignedNotifiedAt });
        touchedTickets.add(String(ticket._id));
    }
    return tickets;
}

function deactivate(user, token = admin.token) {
    return api(`/agents/${user._id}/status`, { method: "PATCH", token, body: { isActive: false } });
}

function reactivate(user) {
    return api(`/agents/${user._id}/status`, { method: "PATCH", token: admin.token, body: { isActive: true } });
}

function preview(user, token = admin.token) {
    return api(`/agents/${user._id}/deactivation-preview`, { token });
}

beforeAll(async () => {
    startedAt = new Date();
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
});

afterAll(async () => {
    for (const [id, snapshot] of ticketSnapshots) await Ticket.updateOne({ _id: id }, { $set: snapshot });
    for (const [email, snapshot] of userSnapshots) await User.updateOne({ email }, { $set: snapshot });
    const ids = [...touchedTickets, ...createdTickets];
    await Promise.all([
        AuditLog.deleteMany({ ticketId: { $in: ids }, createdAt: { $gte: startedAt } }),
        Notification.deleteMany({ ticketId: { $in: ids }, createdAt: { $gte: startedAt } }),
        Ticket.deleteMany({ _id: { $in: createdTickets } }),
        User.deleteMany({ _id: { $in: createdUsers } }),
    ]);
});

describe("the preview says what deactivating would do, and changes nothing", () => {
    test("only an admin can ask", async () => {
        const diego = await userByEmail("agent2@example.com");
        expect((await preview(diego, agent.token)).status).toBe(403);
        expect((await preview(diego, customer.token)).status).toBe(403);
    });

    test("it counts the open tickets and where each would go", async () => {
        const diego = await userByEmail("agent2@example.com");
        const open = await Ticket.countDocuments({ assignedTo: diego._id, status: { $in: OPEN } });
        expect(open).toBeGreaterThan(0);

        const { status, body } = await preview(diego);
        expect(status).toBe(200);
        expect(body.data.openTickets).toBe(open);
        expect(body.data.blocked).toEqual([]);
        expect(body.data.blockedReason).toBeNull();
        expect(body.data.reassignTo.reduce((sum, entry) => sum + entry.count, 0) + body.data.toQueue).toBe(open);
        // The people it names are real, active agents other than the one being deactivated.
        for (const entry of body.data.reassignTo) {
            expect(entry.agentId).not.toBe(String(diego._id));
            expect((await User.findById(entry.agentId).lean()).isActive).toBe(true);
        }
        // Looking is not doing.
        expect(await Ticket.countDocuments({ assignedTo: diego._id, status: { $in: OPEN } })).toBe(open);
        expect((await User.findById(diego._id).lean()).isActive).toBe(true);
    });

    test("a malformed or unknown agent id is a 400 or 404, never a 500", async () => {
        expect((await api("/agents/not-an-id/deactivation-preview", { token: admin.token })).status).toBe(400);
        expect((await api("/agents/0123456789abcdef01234567/deactivation-preview", { token: admin.token })).status).toBe(404);
    });
});

describe("deactivating an agent hands their open tickets on", () => {
    test("each goes to an active agent whose team covers its category, and finished tickets stay put", async () => {
        const diego = await userByEmail("agent2@example.com"); // technical + account, seeded days ago
        const before = await snapshotTicketsOf(diego);
        const openBefore = before.filter((ticket) => OPEN.includes(ticket.status));
        const finishedBefore = before.filter((ticket) => !OPEN.includes(ticket.status));
        expect(openBefore.length).toBeGreaterThan(0);
        expect(openBefore.every((ticket) => Date.now() - new Date(ticket.createdAt).getTime() > 60 * 60 * 1000 * 0.4)).toBe(true);

        const { status, body } = await deactivate(diego);
        expect(status).toBe(200);
        expect(body.data.isActive).toBe(false);
        expect(body.data.reassigned).toEqual({ moved: openBefore.length, queued: 0 });

        for (const old of openBefore) {
            const now = await Ticket.findById(old._id).lean();
            const holder = await User.findById(now.assignedTo).lean();
            expect(String(holder._id)).not.toBe(String(diego._id));
            expect(holder.isActive).toBe(true);
            expect(holder.categories).toContain(old.category);
            // Moving a ticket is not touching its clock or status.
            expect(now.status).toBe(old.status);
            expect(new Date(now.slaDeadline).getTime()).toBe(new Date(old.slaDeadline).getTime());
        }
        for (const old of finishedBefore) {
            expect(String((await Ticket.findById(old._id).lean()).assignedTo)).toBe(String(diego._id));
        }
    });

    test("every move is on the ticket's audit trail and the new holder is told", async () => {
        const diego = await userByEmail("agent2@example.com");
        const moved = await AuditLog.find({
            action: "assigned",
            createdAt: { $gte: startedAt },
            "changes.reason": /was deactivated/,
        }).lean();
        const count = await Ticket.countDocuments({
            _id: { $in: [...ticketSnapshots.keys()] },
            assignedTo: { $ne: diego._id },
            status: { $in: OPEN },
        });
        expect(moved.length).toBe(count);
        expect(moved[0].changes.reason).toBe(`${diego.name} was deactivated`);

        const told = await Notification.find({
            createdAt: { $gte: startedAt },
            type: "ticket_assigned",
            message: /because .* was deactivated/,
        }).lean();
        expect(told.length).toBe(count);
    });

    test("reactivating moves nothing back", async () => {
        const diego = await userByEmail("agent2@example.com");
        const holdersBefore = new Map(
            (await Ticket.find({ _id: { $in: [...ticketSnapshots.keys()] } }).lean()).map((ticket) => [
                String(ticket._id),
                String(ticket.assignedTo),
            ]),
        );

        const { status, body } = await reactivate(diego);
        expect(status).toBe(200);
        expect(body.data.reassigned).toEqual({ moved: 0, queued: 0 });
        for (const ticket of await Ticket.find({ _id: { $in: [...ticketSnapshots.keys()] } }).lean()) {
            expect(String(ticket.assignedTo)).toBe(holdersBefore.get(String(ticket._id)));
        }
    });
});

describe("the last cover for a category cannot be deactivated while it has open work", () => {
    test("the refusal names the category and the open tickets, and nothing moves", async () => {
        const noah = await userByEmail("agent4@example.com"); // the only active agent covering general
        const held = await snapshotTicketsOf(noah);
        const open = await Ticket.countDocuments({ category: "general", status: { $in: OPEN } });
        expect(open).toBeGreaterThan(0);

        const { status, body } = await deactivate(noah);
        expect(status).toBe(409);
        expect(body.error.code).toBe("AGENT_LAST_COVER");
        expect(body.error.message).toContain("General");
        expect(body.error.message).toContain(`${open} open ticket`);
        expect(body.error.message).toContain("Add another agent");
        expect(body.error.details.blocked).toEqual([expect.objectContaining({ category: "general", openTickets: open })]);

        expect((await User.findById(noah._id).lean()).isActive).toBe(true);
        for (const ticket of held) expect(String((await Ticket.findById(ticket._id).lean()).assignedTo)).toBe(String(noah._id));
    });

    test("the preview says so too, so the confirmation can show it before anyone clicks", async () => {
        const noah = await userByEmail("agent4@example.com");
        const { status, body } = await preview(noah);
        expect(status).toBe(200);
        expect(body.data.blocked).toEqual([expect.objectContaining({ category: "general", label: "General" })]);
        expect(body.data.blockedReason).toContain("only active agent covering General");
    });

    test("once another agent covers the category, the same deactivation goes through", async () => {
        const noah = await userByEmail("agent4@example.com");
        const priya = await userByEmail("agent1@example.com");
        const held = await snapshotTicketsOf(noah);
        const openHeld = held.filter((ticket) => OPEN.includes(ticket.status));
        expect(openHeld.length).toBeGreaterThan(0);

        expect(
            (
                await api(`/agents/${priya._id}/categories`, {
                    method: "PATCH",
                    token: admin.token,
                    body: { categories: ["billing", "technical", "general"] },
                })
            ).status,
        ).toBe(200);

        const { status, body } = await deactivate(noah);
        expect(status).toBe(200);
        expect(body.data.reassigned.moved).toBe(openHeld.length);
        for (const ticket of openHeld) expect(String((await Ticket.findById(ticket._id).lean()).assignedTo)).toBe(String(priya._id));
    });
});

describe("work nobody covers goes to the unassigned queue, not to an agent outside the team", () => {
    test("an agent from before teams existed, deactivated with a ticket nobody covers", async () => {
        const settings = (await api("/settings", { token: admin.token })).body.data;
        const original = settings.categories;
        expect(
            (await api("/settings", { method: "PUT", token: admin.token, body: { categories: [...original, "shipping"] } })).status,
        ).toBe(200);

        // An agent as the data looked before teams: no categories at all.
        const made = await api("/agents", {
            method: "POST",
            token: admin.token,
            body: { name: "Before Teams", email: "before.teams@example.com", password: "SupportDesk@2026", categories: ["billing"] },
        });
        expect(made.status).toBe(201);
        createdUsers.push(made.body.data.id);
        await User.updateOne({ _id: made.body.data.id }, { $set: { categories: [] } });

        // A ticket in a category nobody covers, which the rules would never have given them, as old data can.
        const ticket = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: {
                title: "Nobody covers shipping",
                description: "Opened by the deactivation test suite.",
                priority: "low",
                category: "shipping",
            },
        });
        expect(ticket.status).toBe(201);
        expect(ticket.body.data.assignedTo).toBeNull();
        createdTickets.push(ticket.body.data._id);
        await Ticket.updateOne({ _id: ticket.body.data._id }, { $set: { assignedTo: made.body.data.id, unassignedNotifiedAt: null } });

        const movedAt = new Date();
        const legacy = { _id: made.body.data.id };
        // No categories means nothing to block on, so this is allowed, and the ticket cannot go to anybody.
        expect((await preview(legacy)).body.data).toMatchObject({ openTickets: 1, toQueue: 1, blocked: [] });
        const { status, body } = await deactivate(legacy);
        expect(status).toBe(200);
        expect(body.data.reassigned).toEqual({ moved: 0, queued: 1 });

        const stored = await Ticket.findById(ticket.body.data._id).lean();
        expect(stored.assignedTo).toBeNull();
        expect(stored.unassignedNotifiedAt).toBeTruthy();

        // The admins are told, naming the category, and it sits in their queue.
        const admins = await User.find({ role: "admin", isActive: true }).lean();
        for (const person of admins) {
            const alerts = await Notification.find({
                userId: person._id,
                ticketId: stored._id,
                type: "ticket_unassigned",
                createdAt: { $gte: movedAt },
            }).lean();
            expect(alerts).toHaveLength(1);
            expect(alerts[0].message).toContain("Shipping");
        }
        const queue = await api("/tickets?view=unassigned&pageSize=100", { token: admin.token });
        expect(queue.body.data.tickets.map((entry) => entry.title)).toContain("Nobody covers shipping");

        // Settings back as they were: the category is no longer used by anyone, so it can be removed.
        await Ticket.deleteOne({ _id: stored._id });
        expect((await api("/settings", { method: "PUT", token: admin.token, body: { categories: original } })).status).toBe(200);
    });
});
