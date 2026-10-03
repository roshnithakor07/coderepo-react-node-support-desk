import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, loginAs } from "./helpers/api.js";

// A requester can correct what they wrote while nobody has acted on it: the ticket is still open and
// the team has not answered. After that its title and description are what the answer was written
// against, so they are fixed and a reply is the way to add to it.

let admin;
let agent;
let customer;

const created = [];

function update(ticketId, patch, token) {
    return api(`/tickets/${ticketId}`, { method: "PUT", token, body: patch });
}

function reply(ticketId, token, body, isInternal = false) {
    return api(`/tickets/${ticketId}/replies`, { method: "POST", token, body: { body, isInternal } });
}

function get(ticketId, token) {
    return api(`/tickets/${ticketId}`, { token });
}

async function openTicket(title) {
    const { status, body } = await api("/tickets", {
        method: "POST",
        token: customer.token,
        body: { title, description: "Opened by the edit window test suite.", priority: "medium" },
    });
    expect(status).toBe(201);
    created.push(body.data._id);
    return body.data;
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
});

afterAll(async () => {
    await Ticket.deleteMany({ _id: { $in: created } });
});

describe("a requester can fix their own wording while the ticket is untouched", () => {
    test("the title and description can be corrected on an open ticket nobody has answered", async () => {
        const ticket = await openTicket("Cant login - typo in the title");
        expect(ticket.permissions.canEditDetails).toBe(true);
        expect(ticket.permissions.requesterEditBlockedReason).toBeNull();

        const { status, body } = await update(
            ticket._id,
            { title: "Cannot log in from the mobile app", description: "It fails right after I enter my password." },
            customer.token,
        );
        expect(status).toBe(200);
        expect(body.data.title).toBe("Cannot log in from the mobile app");
        expect(body.data.description).toBe("It fails right after I enter my password.");

        // Still stored after the write, not only echoed back.
        const stored = await Ticket.findById(ticket._id).lean();
        expect(stored.title).toBe("Cannot log in from the mobile app");
    });

    test("an internal note does not count as an answer, because the customer never sees it", async () => {
        const ticket = await openTicket("Still editable after an internal note");
        expect((await reply(ticket._id, admin.token, "Routing this to billing.", true)).status).toBe(201);

        const { status } = await update(ticket._id, { title: "Still editable" }, customer.token);
        expect(status).toBe(200);
    });
});

describe("once the team has answered, the ticket says what was answered", () => {
    test("a public staff reply locks the title and description, and the message says why", async () => {
        const ticket = await openTicket("Locked once we reply");
        expect((await reply(ticket._id, admin.token, "Thanks, we are looking into this now.")).status).toBe(201);

        const { status, body } = await update(ticket._id, { title: "Renamed after the reply" }, customer.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("TICKET_LOCKED");
        // The answer is the cause, not the status move the answer caused.
        expect(body.error.message).toContain("Our team has already replied");

        expect((await Ticket.findById(ticket._id).lean()).title).toBe("Locked once we reply");
    });

    test("the page hides the edit button and shows the same reason", async () => {
        const ticket = await openTicket("Permissions follow the rule");
        await reply(ticket._id, admin.token, "We have this, give us an hour.");

        const { body } = await get(ticket._id, customer.token);
        expect(body.data.permissions.canEditDetails).toBe(false);
        expect(body.data.permissions.requesterEditBlockedReason).toContain("Our team has already replied");
    });

    test("work starting on the ticket locks it too, with its own reason", async () => {
        const ticket = await openTicket("Locked once work starts");
        // A staff reply moves it to in progress; put it in pending to leave the "no reply yet" path
        // and reach the status rule on its own.
        await Ticket.updateOne({ _id: ticket._id }, { $set: { status: "pending" } });

        const { status, body } = await update(ticket._id, { description: "Changed after work started." }, customer.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("TICKET_LOCKED");
        expect(body.error.message).toContain("Work has already started");
    });

    test("the priority, category and tags are never the requester's to set", async () => {
        const ticket = await openTicket("Fields that stay with the team");
        for (const patch of [{ priority: "critical" }, { category: "billing" }, { tags: ["vip"] }]) {
            const { status, body } = await update(ticket._id, patch, customer.token);
            expect(status).toBe(403);
            expect(body.error.code).toBe("FORBIDDEN");
        }
    });

    test("a customer still cannot edit somebody else's ticket", async () => {
        const other = await Ticket.findOne({ createdBy: { $ne: customer.user.id }, status: "open" }).lean();
        expect(other).not.toBeNull();
        const { status } = await update(other._id, { title: "Not mine to rename" }, customer.token);
        expect(status).toBe(403);
    });
});

describe("the support team edits a ticket for as long as it is not closed", () => {
    test("an admin can rename a ticket the customer no longer can", async () => {
        const ticket = await openTicket("Renamed by the team");
        await reply(ticket._id, admin.token, "Looking into it.");

        const { status, body } = await update(ticket._id, { title: "Login fails on the mobile app" }, admin.token);
        expect(status).toBe(200);
        expect(body.data.title).toBe("Login fails on the mobile app");
    });

    test("so can the agent the ticket is assigned to", async () => {
        const mine = await Ticket.findOne({ assignedTo: agent.user.id, status: { $in: ["open", "in_progress", "pending"] } }).lean();
        expect(mine).not.toBeNull();

        const { status, body } = await update(mine._id, { title: `${mine.title} (triaged)` }, agent.token);
        expect(status).toBe(200);
        expect(body.data.title).toBe(`${mine.title} (triaged)`);

        await Ticket.updateOne({ _id: mine._id }, { $set: { title: mine.title } });
    });

    test("the rule holds on an old seeded ticket, where the answer was given days ago", async () => {
        const old = await Ticket.findOne({ title: "How do I export my data?" }).lean();
        expect(old).not.toBeNull();
        expect(old.status).toBe("closed");

        const owner = await loginAs("customer");
        const mine = await Ticket.findOne({ createdBy: owner.user.id, status: { $in: ["resolved", "closed"] } }).lean();
        expect(mine).not.toBeNull();
        const { status, body } = await update(mine._id, { title: "Renamed long after the fact" }, owner.token);
        expect(status).toBe(409);
        expect(["TICKET_LOCKED", "TICKET_CLOSED"]).toContain(body.error.code);
        expect((await Ticket.findById(mine._id).lean()).title).toBe(mine.title);
    });
});
