import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Settings } from "../src/features/settings/settings.model.js";
import { REOPEN_WINDOW_DAYS } from "../src/features/tickets/ticket-lifecycle.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { ticketService } from "../src/features/tickets/ticket.service.js";
import { api, loginAs } from "./helpers/api.js";

let admin;
let agent;
let customer;

// Seeded tickets this file moves, restored afterwards so the shared database ends as it started.
const RESTORE_TITLES = ["How do I export my data?", "Duplicate charge on my card", "Requesting a demo for enterprise plan"];
const originals = new Map();

function update(ticketId, patch, token) {
    return api(`/tickets/${ticketId}`, { method: "PUT", token, body: patch });
}

function reply(ticketId, token, body) {
    return api(`/tickets/${ticketId}/replies`, { method: "POST", token, body: { body } });
}

// Seeded tickets are addressed by title: the seed is deterministic, so each one is a known
// starting state rather than "whatever came back first".
async function seeded(title) {
    const ticket = await Ticket.findOne({ title }).lean();
    expect(ticket).not.toBeNull();
    return ticket;
}

async function openTicket(title, priority = "high") {
    const created = await api("/tickets", {
        method: "POST",
        token: customer.token,
        body: { title, description: "Opened by the ticket lifecycle test suite.", priority },
    });
    expect(created.status).toBe(201);
    return created.body.data;
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
    for (const title of RESTORE_TITLES) originals.set(title, await seeded(title));
});

afterAll(async () => {
    for (const [title, ticket] of originals) {
        await Ticket.updateOne(
            { _id: ticket._id },
            {
                $set: {
                    status: ticket.status,
                    slaStartedAt: ticket.slaStartedAt,
                    slaDeadline: ticket.slaDeadline,
                    slaBreached: ticket.slaBreached,
                    slaWarningNotifiedAt: ticket.slaWarningNotifiedAt ?? null,
                    resolvedAt: ticket.resolvedAt ?? null,
                    closedAt: ticket.closedAt ?? null,
                },
            },
        );
    }
});

describe("the lifecycle runs one step at a time", () => {
    test("an open ticket cannot jump to closed", async () => {
        const ticket = await seeded("Cannot log into my account");
        const { status, body } = await update(ticket._id, { status: "closed" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("INVALID_TRANSITION");
        expect(body.error.message).toBe(
            "This ticket is Open, so it can't move straight to Closed. From here it can only move to In Progress.",
        );
    });

    test("an open ticket cannot be resolved without going through in progress", async () => {
        const ticket = await seeded("App crashes on startup");
        const { status, body } = await update(ticket._id, { status: "resolved" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("INVALID_TRANSITION");
    });

    test("a pending ticket cannot be resolved until it is back in progress", async () => {
        const ticket = await seeded("Invoice shows incorrect tax amount");
        const { status, body } = await update(ticket._id, { status: "resolved" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("INVALID_TRANSITION");
        expect(body.error.message).toContain("In Progress");
    });

    test("nothing runs backwards except the reopen", async () => {
        const ticket = await seeded("Payment failed but I was charged");
        expect(ticket.status).toBe("in_progress");
        const { status, body } = await update(ticket._id, { status: "open" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("INVALID_TRANSITION");
    });

    test("the whole chain open to closed is walked one step at a time", async () => {
        const ticket = await openTicket("Lifecycle walk");
        const steps = [];
        for (const status of ["in_progress", "pending", "in_progress"]) {
            const result = await update(ticket._id, { status }, admin.token);
            expect(result.status).toBe(200);
            steps.push(result.body.data.status);
        }
        // Resolving needs something the customer can read, which is its own rule.
        expect((await reply(ticket._id, admin.token, "Here is the fix, please confirm.")).status).toBe(201);
        for (const status of ["resolved", "closed"]) {
            const result = await update(ticket._id, { status }, admin.token);
            expect(result.status).toBe(200);
            steps.push(result.body.data.status);
        }
        expect(steps).toEqual(["in_progress", "pending", "in_progress", "resolved", "closed"]);
    });

    test("a value outside the status list is still a validation error", async () => {
        const ticket = await seeded("Cannot log into my account");
        const { status, body } = await update(ticket._id, { status: "sideways" }, admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("re-sending the status a ticket already has is accepted and changes nothing", async () => {
        const closed = await seeded("Requesting a demo for enterprise plan");
        const { status, body } = await update(closed._id, { status: "closed" }, admin.token);
        expect(status).toBe(200);
        expect(body.data.status).toBe("closed");
        expect(new Date(body.data.slaStartedAt).getTime()).toBe(new Date(closed.slaStartedAt).getTime());
    });

    test("the status control is offered exactly the moves the API accepts", async () => {
        const ticket = await seeded("Cannot log into my account");
        const { body } = await api(`/tickets/${ticket._id}`, { token: admin.token });
        expect(body.data.permissions.nextStatuses).toEqual(["in_progress"]);
    });
});

describe("the reopen window", () => {
    test("a ticket closed within the window can be reopened", async () => {
        const closed = await seeded("How do I export my data?");
        expect(closed.status).toBe("closed");
        const { status, body } = await update(closed._id, { status: "open" }, admin.token);
        expect(status).toBe(200);
        expect(body.data.status).toBe("open");
        expect(body.data.closedAt).toBeNull();
    });

    test("a ticket closed over fourteen days ago cannot be reopened, and says to open a new one", async () => {
        const archived = await seeded("Old import job never finished");
        expect(archived.status).toBe("closed");
        const { status, body } = await update(archived._id, { status: "open" }, admin.token);
        expect(status).toBe(422);
        expect(body.error.code).toBe("REOPEN_WINDOW_EXPIRED");
        expect(body.error.message).toContain(`${REOPEN_WINDOW_DAYS} days`);
        expect(body.error.message).toContain("open a new ticket");
        // Still closed: a rejected reopen changes nothing.
        expect((await seeded("Old import job never finished")).status).toBe("closed");
    });

    test("the expired window is reported to the ticket page, which hides the reopen", async () => {
        const archived = await seeded("Old import job never finished");
        const { body } = await api(`/tickets/${archived._id}`, { token: admin.token });
        expect(body.data.permissions.nextStatuses).toEqual([]);
        expect(body.data.permissions.reopenBlockedReason).toContain("open a new ticket");
    });

    test("a ticket closed before the close stamp existed measures the window from its resolve stamp", async () => {
        const closed = await seeded("Requesting a demo for enterprise plan");
        // Exactly how a record written before `closedAt` shipped looks.
        await Ticket.updateOne({ _id: closed._id }, { $unset: { closedAt: "" } });

        const withinWindow = await api(`/tickets/${closed._id}`, { token: admin.token });
        expect(withinWindow.body.data.permissions.reopenBlockedReason).toBeNull();

        // Pushing the resolve stamp past the window closes the door, with no close stamp in sight.
        const longAgo = new Date(Date.now() - (REOPEN_WINDOW_DAYS + 3) * 86_400_000);
        await Ticket.updateOne({ _id: closed._id }, { $set: { resolvedAt: longAgo, updatedAt: longAgo } });
        const expired = await update(closed._id, { status: "open" }, admin.token);
        expect(expired.status).toBe(422);
        expect(expired.body.error.code).toBe("REOPEN_WINDOW_EXPIRED");
    });

    test("only a finished ticket can be reopened", async () => {
        const ticket = await seeded("Slow dashboard loading times");
        expect(ticket.status).toBe("in_progress");
        const { status, body } = await update(ticket._id, { status: "open" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("INVALID_TRANSITION");
    });
});

describe("reopening restarts the SLA clock", () => {
    test("a ticket resolved 46 hours ago comes back with a fresh window and is not breached by the next sweep", async () => {
        const resolved = await seeded("Duplicate charge on my card");
        expect(resolved.status).toBe("resolved");
        expect(resolved.slaBreached).toBe(true);
        // Resolved 46 hours ago, with a deadline that closed long before now.
        const hoursSinceResolved = (Date.now() - new Date(resolved.resolvedAt).getTime()) / 3_600_000;
        expect(Math.round(hoursSinceResolved)).toBe(46);
        expect(new Date(resolved.slaDeadline).getTime()).toBeLessThan(Date.now());

        const settings = await Settings.findOne().lean();
        const reopenedAt = Date.now();
        const { status, body } = await update(resolved._id, { status: "open" }, admin.token);
        expect(status).toBe(200);

        const ticket = body.data;
        expect(ticket.status).toBe("open");
        expect(ticket.resolvedAt).toBeNull();
        expect(ticket.slaBreached).toBe(false);
        // The clock starts at the reopen, not at creation.
        expect(new Date(ticket.slaStartedAt).getTime()).toBeGreaterThanOrEqual(reopenedAt - 5000);
        expect(new Date(ticket.createdAt).getTime()).toBeLessThan(new Date(ticket.slaStartedAt).getTime());
        // So the new deadline is one full SLA window away, still ahead of us.
        const expectedWindowMs = settings.slaHours[ticket.priority] * 60 * 60 * 1000;
        expect(new Date(ticket.slaDeadline).getTime() - new Date(ticket.slaStartedAt).getTime()).toBe(expectedWindowMs);
        expect(new Date(ticket.slaDeadline).getTime()).toBeGreaterThan(Date.now());

        // The point of the restart: the sweep that runs a minute later leaves it alone.
        await ticketService.runSlaSweep();
        expect((await Ticket.findById(resolved._id).lean()).slaBreached).toBe(false);
    });

    test("the reopen is recorded as its own history entry, with the clock restart on it", async () => {
        const closed = await seeded("How do I export my data?");
        const { body } = await api(`/tickets/${closed._id}/audit`, { token: admin.token });
        const entry = body.data.find((item) => item.action === "reopened");
        expect(entry).toBeDefined();
        expect(entry.changes.status).toEqual({ from: "closed", to: "open" });
        expect(entry.changes.slaRestartedAt).toBeDefined();
        expect(new Date(entry.changes.slaDeadline.to).getTime()).toBeGreaterThan(new Date(entry.changes.slaDeadline.from).getTime());
    });

    test("a move between two active statuses leaves the clock alone", async () => {
        const before = await openTicket("Clock continuity check");
        expect((await update(before._id, { status: "in_progress" }, admin.token)).status).toBe(200);

        const { body } = await update(before._id, { status: "pending" }, admin.token);
        expect(new Date(body.data.slaStartedAt).getTime()).toBe(new Date(before.slaStartedAt).getTime());
        expect(new Date(body.data.slaDeadline).getTime()).toBe(new Date(before.slaDeadline).getTime());
    });

    test("a priority change after a reopen measures the new window from the reopen", async () => {
        const ticket = await openTicket("Reopen then reprioritize", "low");
        // Age it by a day so a deadline measured from creation would already be in the past.
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await Ticket.updateOne({ _id: ticket._id }, { $set: { createdAt: dayAgo, slaStartedAt: dayAgo } });

        expect((await update(ticket._id, { status: "in_progress" }, admin.token)).status).toBe(200);
        expect((await reply(ticket._id, admin.token, "Resolving this for now.")).status).toBe(201);
        expect((await update(ticket._id, { status: "resolved" }, admin.token)).status).toBe(200);
        expect((await update(ticket._id, { status: "open" }, admin.token)).status).toBe(200);
        const { body } = await update(ticket._id, { priority: "critical" }, admin.token);

        expect(body.data.slaBreached).toBe(false);
        expect(new Date(body.data.slaDeadline).getTime()).toBeGreaterThan(Date.now());
    });
});

describe("who may raise a ticket", () => {
    const body = { title: "Role check", description: "Only customers raise tickets.", priority: "low" };

    test("a customer may", async () => {
        const created = await api("/tickets", { method: "POST", token: customer.token, body });
        expect(created.status).toBe(201);
    });

    test("an agent may not", async () => {
        const { status, body: payload } = await api("/tickets", { method: "POST", token: agent.token, body });
        expect(status).toBe(403);
        expect(payload.error.code).toBe("FORBIDDEN");
    });

    test("an admin may not", async () => {
        const { status, body: payload } = await api("/tickets", { method: "POST", token: admin.token, body });
        expect(status).toBe(403);
        expect(payload.error.code).toBe("FORBIDDEN");
    });
});
