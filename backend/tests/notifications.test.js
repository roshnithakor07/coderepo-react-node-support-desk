import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Notification } from "../src/features/notifications/notification.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, login, loginAs } from "./helpers/api.js";

// Notifications are read by being opened, one at a time, never by glancing at the panel. A reply names
// who wrote it, and an internal note tells nobody at all.

let admin;
let agent;
let customer;
let otherCustomer;

const created = [];

function listNotifications(token) {
    return api("/notifications", { token });
}

function markOneRead(id, token) {
    return api(`/notifications/${id}/read`, { method: "PATCH", token });
}

function markAllRead(token) {
    return api("/notifications/read-all", { method: "PATCH", token });
}

function reply(ticketId, token, body, isInternal = false) {
    return api(`/tickets/${ticketId}/replies`, { method: "POST", token, body: { body, isInternal } });
}

// A ticket of the customer's, with the admin on it, so a staff reply notifies the customer.
async function newTicket(title) {
    const { status, body } = await api("/tickets", {
        method: "POST",
        token: customer.token,
        body: { title, description: `${title}: what the customer first wrote.`, priority: "medium" },
    });
    expect(status).toBe(201);
    created.push(body.data._id);
    return body.data;
}

function forTicket(items, ticketId) {
    return items.filter((item) => String(item.ticketId?._id || item.ticketId) === String(ticketId));
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
    otherCustomer = (await login("customer2@example.com")).body.data;
});

afterAll(async () => {
    await Notification.deleteMany({ ticketId: { $in: created } });
    await Ticket.deleteMany({ _id: { $in: created } });
});

describe("a reply names the person who wrote it", () => {
    test("a staff reply reaches the requester and says who replied", async () => {
        const ticket = await newTicket("Notifications: who replied");
        expect((await reply(ticket._id, admin.token, "Looking into this now.")).status).toBe(201);

        const { status, body } = await listNotifications(customer.token);
        expect(status).toBe(200);
        const [notification] = forTicket(body.data.items, ticket._id).filter((item) => item.type === "ticket_reply");
        expect(notification).toBeTruthy();
        expect(notification.message).toBe(`${admin.user.name} replied on "${ticket.title}".`);
        expect(notification.isRead).toBe(false);
    });

    test("an internal note notifies nobody, least of all the customer", async () => {
        const ticket = await newTicket("Notifications: a note tells nobody");
        expect((await reply(ticket._id, admin.token, "Billing should take this one.", true)).status).toBe(201);

        const customerSide = await listNotifications(customer.token);
        expect(forTicket(customerSide.body.data.items, ticket._id).filter((item) => item.type === "ticket_reply")).toHaveLength(0);
        expect(JSON.stringify(customerSide.body)).not.toContain("Billing should take this one");
        // Nor the agent the ticket is with: a note is the team writing to the record, not to each other.
        const stored = await Notification.find({ ticketId: ticket._id, type: "ticket_reply" }).lean();
        expect(stored).toHaveLength(0);
    });
});

describe("notifications are read by being opened", () => {
    let ticket;

    beforeAll(async () => {
        ticket = await newTicket("Notifications: reading them");
        await reply(ticket._id, admin.token, "First reply, so there is something unread.");
        await reply(ticket._id, admin.token, "Second reply, so there are two.");
    });

    test("listing the panel changes nothing: the count is the same before and after", async () => {
        const before = await listNotifications(customer.token);
        expect(before.body.data.unreadCount).toBeGreaterThan(1);
        const after = await listNotifications(customer.token);
        expect(after.body.data.unreadCount).toBe(before.body.data.unreadCount);
        expect(after.body.data.items.filter((item) => !item.isRead)).toHaveLength(before.body.data.unreadCount);
    });

    test("opening one marks that one, and leaves the rest unread", async () => {
        const before = await listNotifications(customer.token);
        const unread = before.body.data.items.filter((item) => !item.isRead);
        const target = unread[0];

        const { status, body } = await markOneRead(target._id, customer.token);
        expect(status).toBe(200);
        // The answer is the list as it now stands, so the badge needs no second request.
        expect(body.data.unreadCount).toBe(before.body.data.unreadCount - 1);
        expect(body.data.items.find((item) => item._id === target._id).isRead).toBe(true);
        expect(body.data.items.filter((item) => !item.isRead)).toHaveLength(before.body.data.unreadCount - 1);
        expect((await Notification.findById(target._id).lean()).isRead).toBe(true);

        // Reading it again is accepted and changes nothing.
        const again = await markOneRead(target._id, customer.token);
        expect(again.status).toBe(200);
        expect(again.body.data.unreadCount).toBe(body.data.unreadCount);
    });

    test("mark all as read clears the count in one request", async () => {
        const { status, body } = await markAllRead(customer.token);
        expect(status).toBe(200);
        expect(body.data.unreadCount).toBe(0);
        expect(body.data.items.every((item) => item.isRead)).toBe(true);
        expect(await Notification.countDocuments({ userId: customer.user.id, isRead: false })).toBe(0);
    });

    test("nobody can mark somebody else's notification, and it is not even said to exist", async () => {
        const ticket = await newTicket("Notifications: not yours to read");
        await reply(ticket._id, admin.token, "A reply only the requester hears about.");
        const [theirs] = forTicket((await listNotifications(customer.token)).body.data.items, ticket._id);
        expect(theirs).toBeTruthy();

        for (const stranger of [otherCustomer, agent, admin]) {
            const { status, body } = await markOneRead(theirs._id, stranger.token);
            expect(status).toBe(404);
            expect(body.error.code).toBe("NOTIFICATION_NOT_FOUND");
        }
        expect((await Notification.findById(theirs._id).lean()).isRead).toBe(false);
    });

    test("a malformed notification id is a 400, and an unknown one a 404", async () => {
        expect((await markOneRead("not-an-id", customer.token)).status).toBe(400);
        const unknown = await markOneRead("000000000000000000000000", customer.token);
        expect(unknown.status).toBe(404);
        expect(unknown.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
    });

    test("both marks need a session", async () => {
        expect((await api(`/notifications/${"0".repeat(24)}/read`, { method: "PATCH" })).status).toBe(401);
        expect((await api("/notifications/read-all", { method: "PATCH" })).status).toBe(401);
    });
});
