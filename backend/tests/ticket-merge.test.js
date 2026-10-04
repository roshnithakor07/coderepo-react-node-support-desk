import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AuditLog } from "../src/features/audit-logs/audit-log.model.js";
import { Notification } from "../src/features/notifications/notification.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, login, loginAs } from "./helpers/api.js";

// Ticket merge: staff fold a duplicate into the ticket the conversation should continue on. Replies move
// over in the order they were written, the duplicate is closed with a link to the primary, and both
// histories record it. Closed tickets, a ticket into itself and two customers' tickets are refused.

let admin;
let agent;
let customer;
let otherCustomer;
let startedAt;

const created = [];
const seededSnapshots = new Map();

function merge(duplicateId, primaryId, token = admin.token) {
    return api(`/tickets/${duplicateId}/merge`, { method: "POST", token, body: { primaryId } });
}

async function newTicket(title, session = customer, category = "general") {
    const { status, body } = await api("/tickets", {
        method: "POST",
        token: session.token,
        body: { title, description: `${title}: what the customer first wrote.`, priority: "medium", category },
    });
    expect(status).toBe(201);
    created.push(body.data._id);
    return body.data;
}

function reply(ticketId, token, body, isInternal = false) {
    return api(`/tickets/${ticketId}/replies`, { method: "POST", token, body: { body, isInternal } });
}

async function seeded(title) {
    const ticket = await Ticket.findOne({ title }).lean();
    expect(ticket).not.toBeNull();
    if (!seededSnapshots.has(title)) seededSnapshots.set(title, ticket);
    return ticket;
}

beforeAll(async () => {
    startedAt = new Date();
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
    otherCustomer = (await login("customer2@example.com")).body.data;
});

afterAll(async () => {
    // Seeded tickets go back exactly as they were, replies and all.
    for (const ticket of seededSnapshots.values()) await Ticket.replaceOne({ _id: ticket._id }, ticket);
    const ids = [...created, ...[...seededSnapshots.values()].map((ticket) => ticket._id)];
    await Promise.all([
        AuditLog.deleteMany({ ticketId: { $in: ids }, createdAt: { $gte: startedAt } }),
        Notification.deleteMany({ ticketId: { $in: ids }, createdAt: { $gte: startedAt } }),
        Ticket.deleteMany({ _id: { $in: created } }),
    ]);
});

describe("merging a duplicate into the ticket the conversation continues on", () => {
    let primary;
    let duplicate;

    test("the replies move over in the order they were written, the duplicate's opening message with them", async () => {
        primary = await newTicket("Merge primary");
        duplicate = await newTicket("Merge duplicate");
        await reply(primary._id, admin.token, "Primary: first answer.");
        await reply(duplicate._id, customer.token, "Duplicate: a follow-up from the customer.");
        await reply(duplicate._id, admin.token, "Duplicate: a private note.", true);
        await reply(primary._id, customer.token, "Primary: the customer replies.");

        const { status, body } = await merge(duplicate._id, primary._id);
        expect(status).toBe(200);
        expect(body.data._id).toBe(primary._id);

        const stored = await Ticket.findById(primary._id).lean();
        const bodies = stored.replies.map((entry) => entry.body);
        expect(bodies).toHaveLength(5);
        expect(bodies.some((text) => text.startsWith(`Merged from #${duplicate._id.slice(-6)} "Merge duplicate"`))).toBe(true);
        const times = stored.replies.map((entry) => new Date(entry.createdAt).getTime());
        expect([...times].sort((first, second) => first - second)).toEqual(times);
        // An internal note stays internal after the move.
        expect(stored.replies.find((entry) => entry.body === "Duplicate: a private note.").isInternal).toBe(true);
    });

    test("the duplicate is closed with a link to the primary, and nothing is left on it", async () => {
        const stored = await Ticket.findById(duplicate._id).lean();
        expect(stored.status).toBe("closed");
        expect(stored.closedAt).toBeTruthy();
        expect(String(stored.mergedInto)).toBe(primary._id);
        expect(stored.replies).toHaveLength(0);

        const page = await api(`/tickets/${duplicate._id}`, { token: admin.token });
        expect(page.body.data.mergedInto._id).toBe(primary._id);
        expect(page.body.data.mergedInto.title).toBe("Merge primary");
        expect(page.body.data.permissions.canMerge).toBe(false);
    });

    test("both histories record it, each saying which way it went", async () => {
        const dupHistory = (await api(`/tickets/${duplicate._id}/history`, { token: customer.token })).body.data;
        const merged = dupHistory.find((entry) => entry.action === "merged");
        expect(merged.mergedInto.id).toBe(primary._id);
        expect(merged.to).toBe("closed");

        const primaryHistory = (await api(`/tickets/${primary._id}/history`, { token: customer.token })).body.data;
        expect(primaryHistory.find((entry) => entry.action === "merged").mergedFrom.id).toBe(duplicate._id);
    });

    test("the customer is told where the conversation continues", async () => {
        const told = await Notification.find({ userId: customer.user.id, type: "ticket_merged", ticketId: primary._id }).lean();
        expect(told).toHaveLength(1);
        expect(told[0].message).toContain("Merge duplicate");
    });

    test("the duplicate cannot be reopened, because its conversation lives elsewhere", async () => {
        const reopen = await api(`/tickets/${duplicate._id}`, { method: "PUT", token: customer.token, body: { status: "open" } });
        expect(reopen.status).toBe(409);
        expect(reopen.body.error.code).toBe("TICKET_MERGED");
        expect(reopen.body.error.message).toContain(`#${primary._id.slice(-6)}`);

        const page = await api(`/tickets/${duplicate._id}`, { token: customer.token });
        expect(page.body.data.permissions.canReopenAsRequester).toBe(false);
        expect(page.body.data.permissions.reopenBlockedReason).toContain("merged into");
    });
});

describe("merges that cannot make sense are refused with the reason", () => {
    test("a ticket into itself", async () => {
        const ticket = await newTicket("Merge into itself");
        const { status, body } = await merge(ticket._id, ticket._id);
        expect(status).toBe(422);
        expect(body.error.code).toBe("MERGE_INTO_ITSELF");
    });

    test("two different customers' tickets", async () => {
        const mine = await newTicket("Merge customer one");
        const theirs = await newTicket("Merge customer two", otherCustomer);
        const { status, body } = await merge(mine._id, theirs._id);
        expect(status).toBe(422);
        expect(body.error.code).toBe("MERGE_DIFFERENT_CUSTOMERS");
        expect(body.error.message).toContain("different customers");
        expect((await Ticket.findById(mine._id).lean()).status).toBe("open");
    });

    test("a closed ticket on either side", async () => {
        const open = await newTicket("Merge open side");
        const closing = await newTicket("Merge closed side");
        await Ticket.updateOne({ _id: closing._id }, { $set: { status: "closed", closedAt: new Date() } });

        const asDuplicate = await merge(closing._id, open._id);
        expect(asDuplicate.status).toBe(409);
        expect(asDuplicate.body.error.code).toBe("TICKET_CLOSED");
        expect(asDuplicate.body.error.message).toContain("duplicate");

        const asPrimary = await merge(open._id, closing._id);
        expect(asPrimary.status).toBe(409);
        expect(asPrimary.body.error.message).toContain("ticket to merge into");
        expect((await Ticket.findById(open._id).lean()).status).toBe("open");
    });

    test("only the support team can merge, and only tickets they can see", async () => {
        const first = await newTicket("Merge permission A");
        const second = await newTicket("Merge permission B");
        expect((await merge(first._id, second._id, customer.token)).status).toBe(403);
        // Both are general, which agent1 does not cover, and neither is theirs.
        expect((await merge(first._id, second._id, agent.token)).status).toBe(403);
    });

    test("bad ids are a 400 or a 404, never a 500", async () => {
        const ticket = await newTicket("Merge bad ids");
        expect((await merge(ticket._id, "not-an-id")).status).toBe(400);
        expect((await merge(ticket._id, "0123456789abcdef01234567")).status).toBe(404);
    });
});

describe("the page is offered exactly the tickets a merge would accept", () => {
    test("the same customer's other tickets still in play, never itself, a closed one or someone else's", async () => {
        const subject = await newTicket("Candidates subject");
        const sibling = await newTicket("Candidates sibling");
        const closed = await newTicket("Candidates closed");
        await Ticket.updateOne({ _id: closed._id }, { $set: { status: "closed" } });
        const stranger = await newTicket("Candidates stranger", otherCustomer);

        const { status, body } = await api(`/tickets/${subject._id}/merge-candidates`, { token: admin.token });
        expect(status).toBe(200);
        const ids = body.data.map((entry) => String(entry._id));
        expect(ids).toContain(sibling._id);
        expect(ids).not.toContain(subject._id);
        expect(ids).not.toContain(closed._id);
        expect(ids).not.toContain(stranger._id);
        expect((await api(`/tickets/${subject._id}/merge-candidates`, { token: customer.token })).status).toBe(403);
    });
});

describe("merging seeded tickets a day apart", () => {
    test("the primary keeps its own clock, status, priority and assignee", async () => {
        const primary = await seeded("Two-factor authentication not working");
        const duplicate = await seeded("Login code never arrives by text");
        expect(String(primary.createdBy)).toBe(String(duplicate.createdBy));
        expect(Date.now() - new Date(duplicate.createdAt).getTime()).toBeGreaterThan(24 * 60 * 60 * 1000);

        const { status } = await merge(duplicate._id, primary._id);
        expect(status).toBe(200);

        const stored = await Ticket.findById(primary._id).lean();
        expect(new Date(stored.slaDeadline).getTime()).toBe(new Date(primary.slaDeadline).getTime());
        expect(stored.status).toBe(primary.status);
        expect(stored.priority).toBe(primary.priority);
        expect(String(stored.assignedTo)).toBe(String(primary.assignedTo));
        // The older duplicate's opening message sorts before the primary's later replies.
        expect(stored.replies[0].body).toContain("Login code never arrives by text");
    });
});
