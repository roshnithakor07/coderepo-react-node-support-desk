import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AuditLog } from "../src/features/audit-logs/audit-log.model.js";
import { User } from "../src/features/auth/user.model.js";
import { Notification } from "../src/features/notifications/notification.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, loginAs } from "./helpers/api.js";

// Bulk assign and bulk status from the ticket list. All or nothing: every ticket is held to the rule
// the single action enforces, and if any breaks it nothing changes and the answer says which and why.

let admin;
let agent; // agent1: billing + technical
let customer;
let startedAt;

const created = [];
// Seeded tickets this file moves, put back afterwards so the shared database ends as it started.
const restore = new Map();

function bulkStatus(ticketIds, status, token = admin.token) {
    return api("/tickets/bulk/status", { method: "POST", token, body: { ticketIds, status } });
}

function bulkPriority(ticketIds, priority, token = admin.token) {
    return api("/tickets/bulk/priority", { method: "POST", token, body: { ticketIds, priority } });
}

function bulkAssign(ticketIds, agentId, token = admin.token) {
    return api("/tickets/bulk/assign", { method: "POST", token, body: { ticketIds, agentId } });
}

async function newTicket(title, category = "general") {
    const { status, body } = await api("/tickets", {
        method: "POST",
        token: customer.token,
        body: { title, description: "Opened by the bulk actions test suite.", priority: "low", category },
    });
    expect(status).toBe(201);
    created.push(body.data._id);
    return body.data;
}

// A ticket the team has answered, so it is in progress and can move on.
async function inProgressTicket(title) {
    const ticket = await newTicket(title);
    const reply = await api(`/tickets/${ticket._id}/replies`, {
        method: "POST",
        token: admin.token,
        body: { body: "We are on it.", isInternal: false },
    });
    expect(reply.status).toBe(201);
    return ticket;
}

async function statusOf(id) {
    return (await Ticket.findById(id).lean()).status;
}

async function seeded(title) {
    const ticket = await Ticket.findOne({ title }).lean();
    expect(ticket).not.toBeNull();
    if (!restore.has(title)) restore.set(title, ticket);
    return ticket;
}

beforeAll(async () => {
    startedAt = new Date();
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
});

afterAll(async () => {
    for (const ticket of restore.values()) {
        await Ticket.updateOne(
            { _id: ticket._id },
            {
                $set: {
                    assignedTo: ticket.assignedTo,
                    status: ticket.status,
                    priority: ticket.priority,
                    slaStartedAt: ticket.slaStartedAt,
                    slaDeadline: ticket.slaDeadline,
                    slaBreached: ticket.slaBreached,
                },
            },
        );
    }
    await Promise.all([
        AuditLog.deleteMany({
            ticketId: { $in: [...created, ...[...restore.values()].map((ticket) => ticket._id)] },
            createdAt: { $gte: startedAt },
        }),
        Notification.deleteMany({
            createdAt: { $gte: startedAt },
            ticketId: { $in: [...created, ...[...restore.values()].map((ticket) => ticket._id)] },
        }),
        Ticket.deleteMany({ _id: { $in: created } }),
    ]);
});

describe("bulk status moves several tickets in one action", () => {
    test("every ticket moves, is saved, and is recorded on its own audit trail", async () => {
        const tickets = [
            await inProgressTicket("Bulk status A"),
            await inProgressTicket("Bulk status B"),
            await inProgressTicket("Bulk status C"),
        ];
        const ids = tickets.map((ticket) => ticket._id);

        const { status, body } = await bulkStatus(ids, "pending");
        expect(status).toBe(200);
        expect(body.data).toEqual({ requested: 3, updated: 3, unchanged: 0 });
        for (const id of ids) expect(await statusOf(id)).toBe("pending");

        const trail = await AuditLog.find({ ticketId: { $in: ids }, action: "updated" }).lean();
        expect(trail.filter((entry) => entry.changes?.status?.to === "pending")).toHaveLength(3);
    });

    test("a ticket already in that status is left alone and counted as unchanged", async () => {
        const [first, second] = [await inProgressTicket("Bulk unchanged A"), await inProgressTicket("Bulk unchanged B")];
        expect((await bulkStatus([first._id], "pending")).status).toBe(200);

        const { status, body } = await bulkStatus([first._id, second._id], "pending");
        expect(status).toBe(200);
        expect(body.data).toEqual({ requested: 2, updated: 1, unchanged: 1 });
    });

    test("one illegal move refuses the whole action, and nothing changes", async () => {
        const ready = [await inProgressTicket("Bulk atomic A"), await inProgressTicket("Bulk atomic B")];
        const untouched = await newTicket("Bulk atomic C, still open");

        const { status, body } = await bulkStatus([ready[0]._id, ready[1]._id, untouched._id], "resolved");
        expect(status).toBe(422);
        expect(body.error.code).toBe("BULK_REJECTED");
        expect(body.error.message).toContain("Nothing was changed");
        expect(body.error.message).toContain("1 of 3 tickets");

        // The two that were fine did not move, because the whole action is one decision.
        expect(await statusOf(ready[0]._id)).toBe("in_progress");
        expect(await statusOf(ready[1]._id)).toBe("in_progress");
        expect(await statusOf(untouched._id)).toBe("open");

        // Take the failing one out and the same request goes through.
        const retry = await bulkStatus([ready[0]._id, ready[1]._id], "resolved");
        expect(retry.status).toBe(200);
        expect(retry.body.data.updated).toBe(2);
    });

    test("the answer lists every failing ticket with its title and the reason", async () => {
        const open = [await newTicket("Bulk reasons A"), await newTicket("Bulk reasons B")];
        const { status, body } = await bulkStatus(
            open.map((ticket) => ticket._id),
            "closed",
        );
        expect(status).toBe(422);

        const { rejections } = body.error.details;
        expect(rejections).toHaveLength(2);
        expect(rejections.map((entry) => entry.title).sort()).toEqual(["Bulk reasons A", "Bulk reasons B"]);
        for (const entry of rejections) {
            expect(entry.code).toBe("INVALID_TRANSITION");
            expect(entry.message).toContain("can't move straight to Closed");
        }
    });

    test("the lifecycle rules are the single move's, including the reply needed to resolve", async () => {
        const answered = await inProgressTicket("Bulk rules answered");
        const unanswered = await newTicket("Bulk rules unanswered");
        await api(`/tickets/${unanswered._id}`, { method: "PUT", token: admin.token, body: { status: "in_progress" } });

        const { status, body } = await bulkStatus([answered._id, unanswered._id], "resolved");
        expect(status).toBe(422);
        expect(body.error.details.rejections).toEqual([
            expect.objectContaining({ title: "Bulk rules unanswered", code: "RESOLUTION_REQUIRES_REPLY" }),
        ]);
    });

    test("a ticket that does not exist is reported with the others, never a 404 for the whole request", async () => {
        const real = await inProgressTicket("Bulk missing A");
        const { status, body } = await bulkStatus([real._id, "0123456789abcdef01234567"], "pending");
        expect(status).toBe(422);
        expect(body.error.details.rejections).toEqual([
            expect.objectContaining({ ticketId: "0123456789abcdef01234567", code: "TICKET_NOT_FOUND", title: null }),
        ]);
        expect(await statusOf(real._id)).toBe("in_progress");
    });

    test("it works on tickets seeded days ago, not only on new ones", async () => {
        const old = await seeded("Notification emails not arriving");
        expect(old.status).toBe("resolved");
        expect(Date.now() - new Date(old.createdAt).getTime()).toBeGreaterThan(12 * 60 * 60 * 1000);

        const { status, body } = await bulkStatus([old._id], "closed");
        expect(status).toBe(200);
        expect(body.data.updated).toBe(1);

        const stored = await Ticket.findById(old._id).lean();
        expect(stored.status).toBe("closed");
        // Closing keeps its resolve stamp and starts the reopen window, exactly as one ticket does.
        expect(stored.closedAt).toBeTruthy();
        expect(new Date(stored.resolvedAt).getTime()).toBe(new Date(old.resolvedAt).getTime());
        await Ticket.updateOne({ _id: old._id }, { $set: { closedAt: old.closedAt ?? null } });
    });
});

describe("bulk assign gives several tickets to one agent", () => {
    test("every ticket moves to the agent, who is told", async () => {
        const first = await seeded("Payment failed but I was charged");
        const second = await seeded("Invoice shows incorrect tax amount");
        // A billing agent who does not hold either ticket yet, so the move is a real one.
        const holders = new Set([String(first.assignedTo), String(second.assignedTo)]);
        const target = (await User.find({ role: "agent", isActive: true, categories: "billing" }).lean()).find(
            (user) => !holders.has(String(user._id)),
        );
        expect(target).toBeTruthy();
        const before = await Notification.countDocuments({ userId: target._id, type: "ticket_assigned" });

        const { status, body } = await bulkAssign([first._id, second._id], String(target._id));
        expect(status).toBe(200);
        expect(body.data).toEqual({ requested: 2, updated: 2, unchanged: 0 });

        for (const id of [first._id, second._id]) expect(String((await Ticket.findById(id).lean()).assignedTo)).toBe(String(target._id));
        expect(await Notification.countDocuments({ userId: target._id, type: "ticket_assigned" })).toBe(before + 2);
        // Matched by who it names rather than by when it was written: no seeded entry names this agent
        // for these tickets, so the count is exactly the two moves, whatever the clock says.
        expect(
            await AuditLog.countDocuments({
                ticketId: { $in: [first._id, second._id] },
                action: "assigned",
                "changes.assignedTo": target.name,
            }),
        ).toBe(2);
    });

    test("one ticket outside the agent's team refuses the whole action, naming the category", async () => {
        const inTeam = await seeded("Payment failed but I was charged");
        const outside = await seeded("App crashes on startup");
        expect(outside.category).toBe("technical");
        const target = await User.findOne({ email: "agent3@example.com" }).lean(); // billing + account
        const holder = String((await Ticket.findById(inTeam._id).lean()).assignedTo);

        const { status, body } = await bulkAssign([inTeam._id, outside._id], String(target._id));
        expect(status).toBe(422);
        expect(body.error.code).toBe("BULK_REJECTED");
        expect(body.error.details.rejections).toEqual([expect.objectContaining({ title: "App crashes on startup", code: "OUTSIDE_TEAM" })]);
        expect(body.error.details.rejections[0].message).toContain("Technical");

        // The billing ticket stayed with whoever held it.
        expect(String((await Ticket.findById(inTeam._id).lean()).assignedTo)).toBe(holder);
    });

    test("a closed ticket in the selection refuses the action", async () => {
        const open = await newTicket("Bulk assign beside a closed one", "billing");
        const holder = String(open.assignedTo._id);
        // Nobody seeded is closed in billing, so close one for the test; the afterAll puts it back.
        const toClose = await seeded("Duplicate charge on my card");
        await Ticket.updateOne({ _id: toClose._id }, { $set: { status: "closed" } });
        // Anyone but the current holder, so the move would be a real one if it went through.
        const target = (await User.find({ role: "agent", isActive: true, categories: "billing" }).lean()).find(
            (user) => String(user._id) !== holder,
        );

        const { status, body } = await bulkAssign([open._id, toClose._id], String(target._id));
        expect(status).toBe(422);
        expect(body.error.details.rejections).toEqual([expect.objectContaining({ code: "TICKET_CLOSED" })]);
        expect(String((await Ticket.findById(open._id).lean()).assignedTo)).toBe(holder);
    });

    test("tickets the agent already has are unchanged, not an error", async () => {
        const mine = await newTicket("Bulk assign already theirs", "billing");
        const target = await User.findById(mine.assignedTo._id).lean();
        const { status, body } = await bulkAssign([mine._id], String(target._id));
        expect(status).toBe(200);
        expect(body.data).toEqual({ requested: 1, updated: 0, unchanged: 1 });
    });

    test("an inactive agent or a non-agent is refused before any ticket is looked at", async () => {
        const ticket = await newTicket("Bulk assign bad target", "billing");
        const inactive = await User.findOne({ email: "agent5@example.com" }).lean();
        const refused = await bulkAssign([ticket._id], String(inactive._id));
        expect(refused.status).toBe(400);
        expect(refused.body.error.code).toBe("INVALID_AGENT");

        const customerAccount = await User.findOne({ email: "customer2@example.com" }).lean();
        expect((await bulkAssign([ticket._id], String(customerAccount._id))).status).toBe(400);
    });
});

describe("bulk priority changes several tickets' urgency in one action", () => {
    test("each ticket gets the new priority and a fresh SLA window from now, on its own audit trail", async () => {
        const tickets = [await newTicket("Bulk priority A"), await newTicket("Bulk priority B")];
        const ids = tickets.map((ticket) => ticket._id);
        const before = Date.now();

        const { status, body } = await bulkPriority(ids, "high");
        expect(status).toBe(200);
        expect(body.data).toEqual({ requested: 2, updated: 2, unchanged: 0 });

        for (const id of ids) {
            const stored = await Ticket.findById(id).lean();
            expect(stored.priority).toBe("high");
            // High is four hours in the seeded settings, measured from the change, not from creation.
            const window = new Date(stored.slaDeadline).getTime() - before;
            expect(window).toBeGreaterThanOrEqual(4 * 60 * 60 * 1000 - 1000);
            expect(window).toBeLessThanOrEqual(4 * 60 * 60 * 1000 + 60 * 1000);
        }
        const trail = await AuditLog.find({ ticketId: { $in: ids }, action: "updated", "changes.priority.to": "high" }).lean();
        expect(trail).toHaveLength(2);
    });

    test("a closed ticket is read-only, so one in the selection refuses the lot", async () => {
        const open = await newTicket("Bulk priority beside a closed one");
        const closed = await Ticket.findOne({ status: "closed" }).lean();
        const { status, body } = await bulkPriority([open._id, closed._id], "critical");
        expect(status).toBe(422);
        expect(body.error.details.rejections).toEqual([expect.objectContaining({ ticketId: String(closed._id), code: "TICKET_CLOSED" })]);
        expect((await Ticket.findById(open._id).lean()).priority).toBe("low");
    });

    test("a ticket already at that priority is unchanged", async () => {
        const ticket = await newTicket("Bulk priority already low");
        const { body } = await bulkPriority([ticket._id], "low");
        expect(body.data).toEqual({ requested: 1, updated: 0, unchanged: 1 });
    });

    test("on a breached ticket seeded hours ago, the breach stays on the record", async () => {
        const old = await seeded("Search results are inaccurate");
        expect(old.slaBreached).toBe(true);

        const { status } = await bulkPriority([old._id], "critical");
        expect(status).toBe(200);
        const stored = await Ticket.findById(old._id).lean();
        expect(stored.priority).toBe("critical");
        expect(stored.slaBreached).toBe(true);
        expect(new Date(stored.slaDeadline).getTime()).toBeGreaterThan(Date.now());
    });

    test("customers cannot reach it, and the limits are the other bulk actions'", async () => {
        const ticket = await newTicket("Bulk priority limits");
        expect((await bulkPriority([ticket._id], "high", customer.token)).status).toBe(403);
        expect((await bulkPriority([ticket._id, ticket._id], "high")).status).toBe(400);
        expect((await bulkPriority([ticket._id], "urgent")).status).toBe(400);
    });
});

describe("who may act on several tickets, and on which", () => {
    test("an agent can include only tickets they can see", async () => {
        const mine = await Ticket.findOne({ assignedTo: agent.user.id, status: "in_progress" }).lean();
        const theirs = await Ticket.findOne({ assignedTo: { $ne: agent.user.id }, status: "in_progress" }).lean();
        expect(mine && theirs).toBeTruthy();

        const { status, body } = await bulkStatus([mine._id, theirs._id], "pending", agent.token);
        expect(status).toBe(422);
        expect(body.error.details.rejections).toEqual([expect.objectContaining({ ticketId: String(theirs._id), code: "FORBIDDEN" })]);
        expect((await Ticket.findById(mine._id).lean()).status).toBe("in_progress");
    });

    test("customers cannot reach either action", async () => {
        const ticket = await newTicket("Bulk customer attempt");
        expect((await bulkStatus([ticket._id], "closed", customer.token)).status).toBe(403);
        expect((await bulkAssign([ticket._id], agent.user.id, customer.token)).status).toBe(403);
        // null, not undefined: an undefined argument would fall back to the admin token.
        expect((await bulkStatus([ticket._id], "closed", null)).status).toBe(401);
    });
});

describe("a bulk request is validated before it touches anything", () => {
    test("nothing selected, too many, the same ticket twice and a malformed id are all 400", async () => {
        const ticket = await newTicket("Bulk validation");

        const empty = await bulkStatus([], "pending");
        expect(empty.status).toBe(400);
        expect(empty.body.error.message).toContain("at least one ticket");

        const tooMany = await bulkStatus(
            Array.from({ length: 51 }, (_, index) => index.toString(16).padStart(24, "0")),
            "pending",
        );
        expect(tooMany.status).toBe(400);
        expect(tooMany.body.error.message).toContain("at most 50");

        const twice = await bulkStatus([ticket._id, ticket._id], "pending");
        expect(twice.status).toBe(400);
        expect(twice.body.error.message).toContain("only once");

        const malformed = await bulkStatus([ticket._id, "not-an-id"], "pending");
        expect(malformed.status).toBe(400);
        expect(malformed.body.error.code).toBe("VALIDATION_ERROR");

        const badStatus = await bulkStatus([ticket._id], "banana");
        expect(badStatus.status).toBe(400);
    });

    test("the bulk routes are not read as a ticket id", async () => {
        const { status } = await api("/tickets/bulk/status", { method: "POST", token: admin.token, body: {} });
        expect(status).toBe(400);
    });
});
