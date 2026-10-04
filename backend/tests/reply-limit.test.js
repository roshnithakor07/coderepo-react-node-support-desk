import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { REPLY_LIMIT, REPLY_PAGE_SIZE } from "../src/features/tickets/ticket-replies.js";
import { api, login, loginAs } from "./helpers/api.js";

// A conversation is capped at REPLY_LIMIT replies, because every reply lives inside the ticket document
// and a MongoDB document cannot pass 16 MB. The cap is applied by the write itself, so two replies sent
// at the same moment cannot both get past it, and the ticket is read back one page at a time.

let admin;
let agent;
let customer;
let otherCustomer;

const created = [];

function reply(ticketId, token, body, isInternal = false) {
    return api(`/tickets/${ticketId}/replies`, { method: "POST", token, body: { body, isInternal } });
}

function repliesPage(ticketId, token, query = "") {
    return api(`/tickets/${ticketId}/replies${query}`, { token });
}

async function newTicket(title, session = customer) {
    const { status, body } = await api("/tickets", {
        method: "POST",
        token: session.token,
        body: { title, description: `${title}: what the customer first wrote.`, priority: "medium" },
    });
    expect(status).toBe(201);
    created.push(body.data._id);
    return body.data;
}

// Filling a conversation through the API would be hundreds of requests, so the replies that only need to
// be there are written straight to the document. Each one is numbered, which is what the paging
// assertions read, and every tenth is an internal note so a customer's pages have notes to leave out.
async function fillReplies(ticketId, count, { from = 1, internalEveryTenth = false } = {}) {
    const start = new Date("2026-09-01T09:00:00.000Z").getTime();
    const replies = Array.from({ length: count }, (unused, index) => {
        const number = from + index;
        const isInternal = internalEveryTenth && number % 10 === 0;
        return {
            body: `${isInternal ? "note" : "reply"} ${number}`,
            author: isInternal ? agent.user.id : customer.user.id,
            isInternal,
            createdAt: new Date(start + number * 1000),
        };
    });
    await Ticket.updateOne({ _id: ticketId }, { $push: { replies: { $each: replies } } });
}

function bodiesOf(page) {
    return page.map((entry) => entry.body);
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
    otherCustomer = (await login("customer2@example.com")).body.data;
});

afterAll(async () => {
    await Ticket.deleteMany({ _id: { $in: created } });
});

describe("a ticket holds at most 500 replies", () => {
    test("the 500th reply is accepted and the 501st is refused, with the ticket left at 500", async () => {
        const ticket = await newTicket("Reply limit: the five hundredth");
        await fillReplies(ticket._id, REPLY_LIMIT - 1);

        const accepted = await reply(ticket._id, admin.token, "The five hundredth reply.");
        expect(accepted.status).toBe(201);
        expect(accepted.body.data.replyCount).toBe(REPLY_LIMIT);

        const refused = await reply(ticket._id, admin.token, "One reply too many.");
        expect(refused.status).toBe(422);
        expect(refused.body.error.code).toBe("REPLY_LIMIT_REACHED");
        expect(refused.body.error.message).toBe(`This ticket has reached ${REPLY_LIMIT} replies. Open a follow-up ticket to continue.`);

        const stored = await Ticket.findById(ticket._id).lean();
        expect(stored.replies).toHaveLength(REPLY_LIMIT);
        expect(stored.replies.at(-1).body).toBe("The five hundredth reply.");
    });

    test("two replies sent at the same moment on a ticket with 499 leave exactly 500", async () => {
        const ticket = await newTicket("Reply limit: two at once");
        await fillReplies(ticket._id, REPLY_LIMIT - 1);

        const [first, second] = await Promise.all([
            reply(ticket._id, admin.token, "Racing reply one."),
            reply(ticket._id, customer.token, "Racing reply two."),
        ]);

        const statuses = [first.status, second.status].sort();
        expect(statuses).toEqual([201, 422]);
        const refused = first.status === 422 ? first : second;
        expect(refused.body.error.code).toBe("REPLY_LIMIT_REACHED");

        const stored = await Ticket.findById(ticket._id).lean();
        expect(stored.replies).toHaveLength(REPLY_LIMIT);
    });

    test("the refused reply leaves the ticket's status and SLA clock alone", async () => {
        const ticket = await newTicket("Reply limit: nothing else moves");
        await fillReplies(ticket._id, REPLY_LIMIT);
        const before = await Ticket.findById(ticket._id).lean();

        const refused = await reply(ticket._id, admin.token, "A reply that starts no work.");
        expect(refused.status).toBe(422);

        const after = await Ticket.findById(ticket._id).lean();
        expect(after.status).toBe(before.status);
        expect(after.slaDeadline.getTime()).toBe(before.slaDeadline.getTime());
        expect(after.replies).toHaveLength(REPLY_LIMIT);
    });

    test("the ticket page is told the conversation is full, so the composer is replaced", async () => {
        const ticket = await newTicket("Reply limit: the page knows");
        await fillReplies(ticket._id, REPLY_LIMIT);

        const { status, body } = await api(`/tickets/${ticket._id}`, { token: customer.token });
        expect(status).toBe(200);
        expect(body.data.replyCount).toBe(REPLY_LIMIT);
        expect(body.data.replyLimit).toBe(REPLY_LIMIT);
        expect(body.data.permissions.canReply).toBe(false);
        expect(body.data.permissions.replyLimitReason).toContain("Open a follow-up ticket");
    });

    test("a merge that would take the primary past the limit is refused", async () => {
        const primary = await newTicket("Reply limit: merge primary");
        const duplicate = await newTicket("Reply limit: merge duplicate");
        await fillReplies(primary._id, REPLY_LIMIT - 10);
        await fillReplies(duplicate._id, 20);

        const { status, body } = await api(`/tickets/${duplicate._id}/merge`, {
            method: "POST",
            token: admin.token,
            body: { primaryId: primary._id },
        });
        expect(status).toBe(422);
        expect(body.error.code).toBe("MERGE_REPLY_LIMIT");
        expect(body.error.message).toContain(`over the limit of ${REPLY_LIMIT}`);
        expect((await Ticket.findById(duplicate._id).lean()).replies).toHaveLength(20);
    });
});

describe("a long conversation is read one page at a time", () => {
    let ticketId;

    beforeAll(async () => {
        const ticket = await newTicket("Reply paging: one hundred and twenty replies");
        ticketId = ticket._id;
        await fillReplies(ticketId, 120, { internalEveryTenth: true });
    });

    test("the ticket carries the latest 50 replies and the count of them all", async () => {
        const { status, body } = await api(`/tickets/${ticketId}`, { token: admin.token });
        expect(status).toBe(200);
        expect(body.data.replies).toHaveLength(REPLY_PAGE_SIZE);
        expect(body.data.replyCount).toBe(120);
        expect(body.data.visibleReplyCount).toBe(120);
        expect(bodiesOf(body.data.replies).at(0)).toBe("reply 71");
        expect(bodiesOf(body.data.replies).at(-1)).toBe("note 120");
        expect(body.data.oldestReplyId).toBe(String(body.data.replies[0]._id));
    });

    test("paging before the oldest one on screen returns the previous 50, in order", async () => {
        const ticket = (await api(`/tickets/${ticketId}`, { token: admin.token })).body.data;
        const first = await repliesPage(ticketId, admin.token, `?before=${ticket.oldestReplyId}&limit=${REPLY_PAGE_SIZE}`);
        expect(first.status).toBe(200);
        expect(first.body.data.replies).toHaveLength(REPLY_PAGE_SIZE);
        expect(bodiesOf(first.body.data.replies).at(0)).toBe("reply 21");
        expect(bodiesOf(first.body.data.replies).at(-1)).toBe("note 70");
        expect(first.body.data.hasEarlier).toBe(true);

        const second = await repliesPage(ticketId, admin.token, `?before=${first.body.data.nextBefore}&limit=${REPLY_PAGE_SIZE}`);
        expect(second.status).toBe(200);
        // Only twenty are left, so the last page is short and says there is nothing behind it.
        expect(bodiesOf(second.body.data.replies)).toEqual(
            Array.from({ length: 20 }, (unused, index) => ((index + 1) % 10 === 0 ? `note ${index + 1}` : `reply ${index + 1}`)),
        );
        expect(second.body.data.hasEarlier).toBe(false);
    });

    test("internal notes stay out of a customer's pages, as they do on the ticket", async () => {
        const detail = (await api(`/tickets/${ticketId}`, { token: customer.token })).body.data;
        expect(detail.replies.every((entry) => !entry.isInternal)).toBe(true);
        expect(detail.visibleReplyCount).toBe(108);
        expect(detail.replyCount).toBe(120);

        const page = await repliesPage(ticketId, customer.token, `?before=${detail.oldestReplyId}&limit=${REPLY_PAGE_SIZE}`);
        expect(page.status).toBe(200);
        expect(page.body.data.replies.every((entry) => !entry.isInternal)).toBe(true);
        expect(bodiesOf(page.body.data.replies).some((body) => body.startsWith("note "))).toBe(false);
        expect(JSON.stringify(page.body)).not.toContain("note 30");
    });

    test("a customer cannot page the replies of someone else's ticket, and hears what they hear of it", async () => {
        const detail = await api(`/tickets/${ticketId}`, { token: otherCustomer.token });
        const page = await repliesPage(ticketId, otherCustomer.token, `?limit=${REPLY_PAGE_SIZE}`);
        expect(detail.status).toBe(403);
        expect(page.status).toBe(detail.status);
        expect(page.body.error.code).toBe(detail.body.error.code);
        expect(page.body.error.message).toBe(detail.body.error.message);
    });

    test("the page size is capped, and a malformed or unknown cursor is a 400 or a 404", async () => {
        const tooMany = await repliesPage(ticketId, admin.token, `?limit=${REPLY_PAGE_SIZE + 1}`);
        expect(tooMany.status).toBe(400);
        expect(tooMany.body.error.code).toBe("VALIDATION_ERROR");

        expect((await repliesPage(ticketId, admin.token, "?limit=0")).status).toBe(400);
        expect((await repliesPage(ticketId, admin.token, "?before=not-an-id")).status).toBe(400);

        const unknown = await repliesPage(ticketId, admin.token, "?before=000000000000000000000000");
        expect(unknown.status).toBe(404);
        expect(unknown.body.error.code).toBe("REPLY_NOT_FOUND");

        const missingTicket = await repliesPage("000000000000000000000000", admin.token);
        expect(missingTicket.status).toBe(404);
        expect(missingTicket.body.error.code).toBe("TICKET_NOT_FOUND");
    });

    test("resolving still needs a staff reply the customer can read, even when it is pages back", async () => {
        const ticket = await newTicket("Reply paging: the answer is pages back");
        await fillReplies(ticket._id, 80);
        // The one public staff reply is the oldest message on the ticket, far behind the latest page.
        await Ticket.updateOne(
            { _id: ticket._id },
            { $set: { "replies.0.author": agent.user.id, "replies.0.isInternal": false, status: "in_progress" } },
        );

        const { status, body } = await api(`/tickets/${ticket._id}`, { token: admin.token });
        expect(status).toBe(200);
        expect(body.data.permissions.nextStatuses).toContain("resolved");
        expect(body.data.permissions.resolveBlockedReason).toBeNull();
    });
});
