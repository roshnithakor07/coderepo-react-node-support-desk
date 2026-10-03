import { beforeAll, describe, expect, test } from "bun:test";
import { Settings } from "../src/features/settings/settings.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, loginAs } from "./helpers/api.js";

let admin;
let agent;
let customer;

function update(ticketId, patch, token) {
    return api(`/tickets/${ticketId}`, { method: "PUT", token, body: patch });
}

// An old ticket: created days ago, already finished, with an SLA window that closed long before now.
async function oldFinishedTicket(status) {
    const ticket = await Ticket.findOne({ status }).sort({ createdAt: 1 }).lean();
    expect(ticket).not.toBeNull();
    expect(new Date(ticket.slaDeadline).getTime()).toBeLessThan(Date.now());
    return ticket;
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
});

describe("status transitions", () => {
    test("an illegal move is a conflict with the current state, not a malformed request", async () => {
        const closed = await oldFinishedTicket("closed");
        const { status, body } = await update(closed._id, { status: "resolved" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
        expect(body.error.message).toContain("closed");
    });

    test("a value outside the status list is still a validation error", async () => {
        const closed = await oldFinishedTicket("closed");
        const { status, body } = await update(closed._id, { status: "sideways" }, admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("re-sending the status a ticket already has is accepted and changes nothing", async () => {
        const closed = await oldFinishedTicket("closed");
        const { status, body } = await update(closed._id, { status: "closed" }, admin.token);
        expect(status).toBe(200);
        expect(body.data.status).toBe("closed");
        expect(new Date(body.data.slaStartedAt).getTime()).toBe(new Date(closed.slaStartedAt).getTime());
    });
});

describe("reopening restarts the SLA clock", () => {
    test("an old resolved ticket reopened now gets a deadline in the future, not its original one", async () => {
        const resolved = await oldFinishedTicket("resolved");
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
        const actualWindowMs = new Date(ticket.slaDeadline).getTime() - new Date(ticket.slaStartedAt).getTime();
        expect(actualWindowMs).toBe(expectedWindowMs);
        expect(new Date(ticket.slaDeadline).getTime()).toBeGreaterThan(Date.now());
    });

    test("the restart is written to the audit trail", async () => {
        const closed = await oldFinishedTicket("closed");
        expect((await update(closed._id, { status: "open" }, admin.token)).status).toBe(200);

        const { body } = await api(`/tickets/${closed._id}/audit`, { token: admin.token });
        const entry = body.data.find((item) => item.action === "updated" && item.changes?.slaRestartedAt);
        expect(entry).toBeDefined();
        expect(entry.changes.status).toEqual({ from: "closed", to: "open" });
    });

    test("a move between two active statuses leaves the clock alone", async () => {
        const created = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: { title: "Clock continuity check", description: "Moves from open to pending.", priority: "high" },
        });
        expect(created.status).toBe(201);
        const before = created.body.data;

        const { body } = await update(before._id, { status: "pending" }, admin.token);
        expect(new Date(body.data.slaStartedAt).getTime()).toBe(new Date(before.slaStartedAt).getTime());
        expect(new Date(body.data.slaDeadline).getTime()).toBe(new Date(before.slaDeadline).getTime());
    });

    test("a priority change after a reopen measures the new window from the reopen", async () => {
        const created = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: { title: "Reopen then repriorititze", description: "Resolved, reopened, then raised.", priority: "low" },
        });
        const ticketId = created.body.data._id;
        // Age it by a day so a deadline measured from creation would already be in the past.
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await Ticket.updateOne({ _id: ticketId }, { $set: { createdAt: dayAgo, slaStartedAt: dayAgo } });

        expect((await update(ticketId, { status: "resolved" }, admin.token)).status).toBe(200);
        expect((await update(ticketId, { status: "open" }, admin.token)).status).toBe(200);
        const { body } = await update(ticketId, { priority: "critical" }, admin.token);

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
