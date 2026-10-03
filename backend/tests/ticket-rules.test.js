import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { User } from "../src/features/auth/user.model.js";
import { Notification } from "../src/features/notifications/notification.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { ticketService } from "../src/features/tickets/ticket.service.js";
import { api, loginAs } from "./helpers/api.js";

let admin;
let agent;
let customer;
let adminIds;

// Seeded tickets this file moves, restored afterwards so the shared database ends as it started.
const RESTORE_TITLES = [
    "Cannot log into my account",
    "Invoice shows incorrect tax amount",
    "Notification emails not arriving",
    "Cannot download my past invoices",
];
const originals = new Map();

function update(ticketId, patch, token) {
    return api(`/tickets/${ticketId}`, { method: "PUT", token, body: patch });
}

function reply(ticketId, token, body, isInternal = false) {
    return api(`/tickets/${ticketId}/replies`, { method: "POST", token, body: { body, isInternal } });
}

function assign(ticketId, agentId, token) {
    return api(`/tickets/${ticketId}/assign`, { method: "POST", token, body: { agentId } });
}

async function seeded(title) {
    const ticket = await Ticket.findOne({ title }).lean();
    expect(ticket).not.toBeNull();
    return ticket;
}

async function openTicket(title, priority = "medium") {
    const created = await api("/tickets", {
        method: "POST",
        token: customer.token,
        body: { title, description: "Opened by the ticket rules test suite.", priority },
    });
    expect(created.status).toBe(201);
    return created.body.data;
}

// Walks a fresh ticket to resolved the only way the lifecycle allows.
async function resolvedTicket(title) {
    const ticket = await openTicket(title);
    expect((await reply(ticket._id, admin.token, "We have a fix for you, please confirm.")).status).toBe(201);
    const resolved = await update(ticket._id, { status: "resolved" }, admin.token);
    expect(resolved.status).toBe(200);
    return resolved.body.data;
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
    adminIds = (await User.find({ role: "admin" }).lean()).map((user) => String(user._id));
    for (const title of RESTORE_TITLES) originals.set(title, await seeded(title));
});

afterAll(async () => {
    for (const [title, ticket] of originals) {
        await Ticket.updateOne(
            { _id: ticket._id },
            {
                $set: {
                    status: ticket.status,
                    priority: ticket.priority,
                    assignedTo: ticket.assignedTo ?? null,
                    slaStartedAt: ticket.slaStartedAt,
                    slaDeadline: ticket.slaDeadline,
                    slaBreached: ticket.slaBreached,
                    slaWarningNotifiedAt: ticket.slaWarningNotifiedAt ?? null,
                    unassignedNotifiedAt: ticket.unassignedNotifiedAt ?? null,
                    resolvedAt: ticket.resolvedAt ?? null,
                    closedAt: ticket.closedAt ?? null,
                },
            },
        );
    }
});

describe("resolving requires a public staff reply", () => {
    test("an in-progress ticket with nothing the customer can read cannot be resolved", async () => {
        const ticket = await openTicket("Resolve without an answer");
        expect((await update(ticket._id, { status: "in_progress" }, admin.token)).status).toBe(200);

        const { status, body } = await update(ticket._id, { status: "resolved" }, admin.token);
        expect(status).toBe(422);
        expect(body.error.code).toBe("RESOLUTION_REQUIRES_REPLY");
        expect(body.error.message).toContain("public reply");
    });

    test("an internal note does not count as an answer", async () => {
        const ticket = await openTicket("Resolve on an internal note");
        expect((await update(ticket._id, { status: "in_progress" }, admin.token)).status).toBe(200);
        expect((await reply(ticket._id, admin.token, "Note to the team: known regression.", true)).status).toBe(201);

        const { status, body } = await update(ticket._id, { status: "resolved" }, admin.token);
        expect(status).toBe(422);
        expect(body.error.code).toBe("RESOLUTION_REQUIRES_REPLY");
    });

    test("a public reply unlocks resolving, and the ticket page says so beforehand", async () => {
        const ticket = await openTicket("Resolve after answering");
        expect((await update(ticket._id, { status: "in_progress" }, admin.token)).status).toBe(200);

        const blocked = await api(`/tickets/${ticket._id}`, { token: admin.token });
        expect(blocked.body.data.permissions.nextStatuses).toEqual(["pending"]);
        expect(blocked.body.data.permissions.resolveBlockedReason).toContain("public reply");

        expect((await reply(ticket._id, admin.token, "Fixed on our side, please confirm.")).status).toBe(201);
        const unlocked = await api(`/tickets/${ticket._id}`, { token: admin.token });
        expect(unlocked.body.data.permissions.nextStatuses).toEqual(["pending", "resolved"]);
        expect(unlocked.body.data.permissions.resolveBlockedReason).toBeNull();
        expect((await update(ticket._id, { status: "resolved" }, admin.token)).status).toBe(200);
    });
});

describe("a closed ticket is read-only", () => {
    test("no reply can be added", async () => {
        const closed = await seeded("Old import job never finished");
        const { status, body } = await reply(closed._id, admin.token, "Reviving a three-week-old thread.");
        expect(status).toBe(409);
        expect(body.error.code).toBe("TICKET_CLOSED");
        expect(body.error.message).toContain("read-only");
    });

    test("no field can be edited", async () => {
        const closed = await seeded("Old import job never finished");
        const { status, body } = await update(closed._id, { title: "Renaming a closed ticket" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("TICKET_CLOSED");
        expect((await seeded("Old import job never finished")).title).toBe("Old import job never finished");
    });

    test("the priority cannot be changed either", async () => {
        const closed = await seeded("Old import job never finished");
        const { status, body } = await update(closed._id, { priority: "critical" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("TICKET_CLOSED");
    });

    test("it cannot be reassigned", async () => {
        const closed = await seeded("Old import job never finished");
        const target = await User.findOne({ email: "agent3@example.com" }).lean();
        const { status, body } = await assign(closed._id, String(target._id), admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("TICKET_CLOSED");
    });

    test("the ticket page is told to lock the conversation and the fields", async () => {
        const closed = await seeded("Old import job never finished");
        const { body } = await api(`/tickets/${closed._id}`, { token: admin.token });
        expect(body.data.permissions.canReply).toBe(false);
        expect(body.data.permissions.canEditFields).toBe(false);
        expect(body.data.permissions.canAssign).toBe(false);
        expect(body.data.permissions.closedReason).toContain("read-only");
    });
});

describe("a customer's reply revives a waiting or resolved ticket", () => {
    test("a reply on a pending ticket hands it back to the team with a fresh SLA window", async () => {
        const pending = await seeded("Invoice shows incorrect tax amount");
        expect(pending.status).toBe("pending");
        expect(pending.slaBreached).toBe(true);
        const repliedAt = Date.now();

        const { status, body } = await reply(pending._id, customer.token, "Here is the invoice number you asked for.");
        expect(status).toBe(201);
        expect(body.data.status).toBe("in_progress");
        expect(body.data.slaBreached).toBe(false);
        expect(new Date(body.data.slaStartedAt).getTime()).toBeGreaterThanOrEqual(repliedAt - 5000);
        expect(new Date(body.data.slaDeadline).getTime()).toBeGreaterThan(Date.now());
    });

    test("a reply on a resolved ticket reopens it", async () => {
        const resolved = await seeded("Notification emails not arriving");
        expect(resolved.status).toBe("resolved");

        const { status, body } = await reply(resolved._id, customer.token, "This is still happening on my account.");
        expect(status).toBe(201);
        expect(body.data.status).toBe("open");
        expect(body.data.resolvedAt).toBeNull();
        expect(new Date(body.data.slaDeadline).getTime()).toBeGreaterThan(Date.now());
    });

    test("the revival is logged as a reopen, so it shows in the status history", async () => {
        const revived = await seeded("Notification emails not arriving");
        const { body } = await api(`/tickets/${revived._id}/history`, { token: customer.token });
        const entry = body.data.find((item) => item.action === "reopened");
        expect(entry).toBeDefined();
        expect(entry.from).toBe("resolved");
        expect(entry.to).toBe("open");
        expect(entry.slaRestartedAt).not.toBeNull();
    });

    test("a staff reply on an open ticket starts work, and an internal note never moves it", async () => {
        const ticket = await openTicket("Internal note keeps the status");
        const note = await reply(ticket._id, admin.token, "Checking the billing export first.", true);
        expect(note.status).toBe(201);
        expect(note.body.data.status).toBe("open");

        const answer = await reply(ticket._id, admin.token, "We are on it, here is what we found.");
        expect(answer.status).toBe(201);
        expect(answer.body.data.status).toBe("in_progress");
    });

    test("the SLA clock is untouched by a staff reply", async () => {
        const ticket = await openTicket("Staff reply keeps the clock");
        const answered = await reply(ticket._id, admin.token, "Looking into this now.");
        expect(new Date(answered.body.data.slaStartedAt).getTime()).toBe(new Date(ticket.slaStartedAt).getTime());
        expect(new Date(answered.body.data.slaDeadline).getTime()).toBe(new Date(ticket.slaDeadline).getTime());
    });
});

describe("a breached SLA is permanent", () => {
    test("changing the priority never clears the breach, and the new window runs from the change", async () => {
        const breached = await seeded("Cannot log into my account");
        expect(breached.slaBreached).toBe(true);
        expect(breached.priority).toBe("critical");
        const changedAt = Date.now();

        const { status, body } = await update(breached._id, { priority: "low" }, admin.token);
        expect(status).toBe(200);
        expect(body.data.priority).toBe("low");
        // The miss stays on the record.
        expect(body.data.slaBreached).toBe(true);

        // 24 hours from the change, not from a creation two hours before it.
        const windowMs = new Date(body.data.slaDeadline).getTime() - changedAt;
        expect(windowMs).toBeGreaterThan(23.9 * 3_600_000);
        expect(windowMs).toBeLessThan(24.1 * 3_600_000);
        const fromCreation = new Date(breached.createdAt).getTime() + 24 * 3_600_000;
        expect(new Date(body.data.slaDeadline).getTime()).toBeGreaterThan(fromCreation);
    });

    test("the audit entry records the old and the new deadline", async () => {
        const changed = await seeded("Cannot log into my account");
        const { body } = await api(`/tickets/${changed._id}/audit`, { token: admin.token });
        const entry = body.data.find((item) => item.changes?.priority?.to === "low");
        expect(entry).toBeDefined();
        expect(entry.changes.priority).toEqual({ from: "critical", to: "low" });
        expect(entry.changes.slaDeadline.from).toBeDefined();
        expect(new Date(entry.changes.slaDeadline.to).getTime()).toBeGreaterThan(new Date(entry.changes.slaDeadline.from).getTime());
    });

    test("a resolved ticket's deadline is left where it was when its priority changes", async () => {
        const ticket = await resolvedTicket("Priority change after resolving");
        const { body } = await update(ticket._id, { priority: "critical" }, admin.token);
        expect(body.data.priority).toBe("critical");
        expect(new Date(body.data.slaDeadline).getTime()).toBe(new Date(ticket.slaDeadline).getTime());
    });
});

describe("customers close and reopen their own tickets", () => {
    test("a customer closes a resolved ticket and the page offers them exactly that", async () => {
        const ticket = await resolvedTicket("Customer closes this one");
        const beforeClose = await api(`/tickets/${ticket._id}`, { token: customer.token });
        expect(beforeClose.body.data.permissions.nextStatuses).toEqual(["closed", "open"]);
        expect(beforeClose.body.data.permissions.canCloseAsRequester).toBe(true);

        const { status, body } = await update(ticket._id, { status: "closed" }, customer.token);
        expect(status).toBe(200);
        expect(body.data.status).toBe("closed");
        expect(body.data.closedAt).not.toBeNull();
    });

    test("a customer reopens their closed ticket, which restarts the clock", async () => {
        const ticket = await resolvedTicket("Customer reopens this one");
        expect((await update(ticket._id, { status: "closed" }, customer.token)).status).toBe(200);

        const { status, body } = await update(ticket._id, { status: "open" }, customer.token);
        expect(status).toBe(200);
        expect(body.data.status).toBe("open");
        expect(body.data.closedAt).toBeNull();
        expect(new Date(body.data.slaDeadline).getTime()).toBeGreaterThan(Date.now());
    });

    test("a customer cannot reply to the ticket they closed", async () => {
        const ticket = await resolvedTicket("Customer closed, then tried to reply");
        expect((await update(ticket._id, { status: "closed" }, customer.token)).status).toBe(200);

        const { status, body } = await reply(ticket._id, customer.token, "One more thing...");
        expect(status).toBe(409);
        expect(body.error.code).toBe("TICKET_CLOSED");
    });

    test("a customer cannot move a ticket anywhere else in the lifecycle", async () => {
        const ticket = await openTicket("Customer tries to triage");
        const { status, body } = await update(ticket._id, { status: "in_progress" }, customer.token);
        expect(status).toBe(403);
        expect(body.error.code).toBe("FORBIDDEN");
        expect(body.error.message).toContain("support team");
        expect((await api(`/tickets/${ticket._id}`, { token: customer.token })).body.data.permissions.nextStatuses).toEqual([]);
    });

    test("a customer cannot edit a ticket's details or priority", async () => {
        const ticket = await openTicket("Customer tries to edit");
        for (const patch of [{ title: "Renamed by the customer" }, { priority: "critical" }]) {
            const { status, body } = await update(ticket._id, patch, customer.token);
            expect(status).toBe(403);
            expect(body.error.code).toBe("FORBIDDEN");
        }
        expect((await api(`/tickets/${ticket._id}`, { token: customer.token })).body.data.title).toBe("Customer tries to edit");
    });

    test("a customer cannot touch someone else's ticket", async () => {
        const other = await seeded("Old import job never finished");
        expect((await update(other._id, { status: "open" }, customer.token)).status).toBe(403);
    });
});

describe("the status history on the ticket page", () => {
    test("reads back the whole lifecycle, newest first, with who moved it", async () => {
        const ticket = await openTicket("History walk");
        expect((await update(ticket._id, { status: "in_progress" }, admin.token)).status).toBe(200);
        expect((await reply(ticket._id, admin.token, "Here is your answer.")).status).toBe(201);
        expect((await update(ticket._id, { status: "resolved" }, admin.token)).status).toBe(200);

        const { status, body } = await api(`/tickets/${ticket._id}/history`, { token: customer.token });
        expect(status).toBe(200);
        const moves = body.data.map((entry) => `${entry.from || ""}>${entry.to || ""}`);
        expect(moves).toEqual(["in_progress>resolved", "open>in_progress", ">open"]);
        expect(body.data[0].performedBy.role).toBe("admin");
        expect(body.data.at(-1).action).toBe("created");
    });

    test("it leaves internal activity out", async () => {
        const ticket = await openTicket("History hides notes");
        expect((await reply(ticket._id, admin.token, "Internal: escalating to engineering.", true)).status).toBe(201);
        const { body } = await api(`/tickets/${ticket._id}/history`, { token: customer.token });
        expect(JSON.stringify(body.data)).not.toContain("escalating to engineering");
        expect(body.data.every((entry) => entry.action !== "replied")).toBe(true);
    });

    test("an SLA breach appears in it", async () => {
        const ticket = await openTicket("History shows a breach");
        await Ticket.updateOne({ _id: ticket._id }, { $set: { slaDeadline: new Date(Date.now() - 60_000) } });
        await ticketService.runSlaSweep();

        const { body } = await api(`/tickets/${ticket._id}/history`, { token: customer.token });
        const breach = body.data.find((entry) => entry.action === "sla_breached");
        expect(breach).toBeDefined();
        expect(breach.performedBy).toBeNull();
    });

    test("nobody can read the history of a ticket they cannot see", async () => {
        const other = await seeded("Old import job never finished");
        const { status, body } = await api(`/tickets/${other._id}/history`, { token: customer.token });
        expect(status).toBe(403);
        expect(body.error.code).toBe("FORBIDDEN");
    });
});

describe("admins are told about breaches and unowned tickets", () => {
    async function notificationsFor(userId, ticketId, type) {
        return Notification.find({ userId, ticketId, type }).lean();
    }

    test("an SLA breach reaches every admin, not only the assignee", async () => {
        const ticket = await openTicket("Breach alert reaches the admins");
        await Ticket.updateOne({ _id: ticket._id }, { $set: { slaDeadline: new Date(Date.now() - 60_000) } });

        const result = await ticketService.runSlaSweep();
        expect(result.breached).toBeGreaterThan(0);

        for (const adminId of adminIds) {
            expect((await notificationsFor(adminId, ticket._id, "sla_breached")).length).toBe(1);
        }
        const assigned = await Ticket.findById(ticket._id).lean();
        expect((await notificationsFor(assigned.assignedTo, ticket._id, "sla_breached")).length).toBe(1);
    });

    test("the seeded unowned ticket is already on the admins' bell", async () => {
        const unowned = await seeded("Cannot download my past invoices");
        expect(unowned.assignedTo).toBeNull();
        for (const adminId of adminIds) {
            expect((await notificationsFor(adminId, unowned._id, "ticket_unassigned")).length).toBe(1);
        }
    });

    test("the sweep reports a ticket with no assignee once, not every minute", async () => {
        const unowned = await seeded("Cannot download my past invoices");
        await Notification.deleteMany({ ticketId: unowned._id, type: "ticket_unassigned" });
        await Ticket.updateOne({ _id: unowned._id }, { $set: { unassignedNotifiedAt: null } });

        const first = await ticketService.runSlaSweep();
        expect(first.unassigned).toBe(1);
        const second = await ticketService.runSlaSweep();
        expect(second.unassigned).toBe(0);

        for (const adminId of adminIds) {
            const alerts = await notificationsFor(adminId, unowned._id, "ticket_unassigned");
            expect(alerts.length).toBe(1);
            expect(alerts[0].message).toContain("no assignee");
        }
    });

    test("assigning the ticket arms the alert again for a later spell without an owner", async () => {
        const unowned = await seeded("Cannot download my past invoices");
        const target = await User.findOne({ email: "agent3@example.com" }).lean();
        const { status } = await assign(unowned._id, String(target._id), admin.token);
        expect(status).toBe(200);
        expect((await Ticket.findById(unowned._id).lean()).unassignedNotifiedAt).toBeNull();
    });
});

describe("handing a ticket to another agent", () => {
    test("an agent loses access the moment they reassign, which is why the UI sends them back", async () => {
        const mine = await Ticket.findOne({ assignedTo: agent.user.id, status: { $in: ["open", "in_progress", "pending"] } }).lean();
        expect(mine).not.toBeNull();
        const target = await User.findOne({ email: "agent4@example.com" }).lean();

        const handed = await assign(mine._id, String(target._id), agent.token);
        expect(handed.status).toBe(200);
        expect(handed.body.data.assignedTo.name).toBe(target.name);

        // The ticket is no longer theirs to open.
        expect((await api(`/tickets/${mine._id}`, { token: agent.token })).status).toBe(403);

        await assign(mine._id, mine.assignedTo, admin.token);
    });
});
