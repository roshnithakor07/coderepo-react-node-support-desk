import { beforeAll, describe, expect, test } from "bun:test";
import { api, loginAs, SEEDED_ACCOUNTS } from "./helpers/api.js";

const INTERNAL_NOTE = "Internal only: customer is on the legacy billing plan (api test)";
const PUBLIC_REPLY = "We are looking into this for you (api test)";

let agent;
let customer;
let admin;
let ticketId;

function containsNote(payload) {
    return JSON.stringify(payload).includes(INTERNAL_NOTE);
}

beforeAll(async () => {
    [agent, customer, admin] = await Promise.all([loginAs("agent"), loginAs("customer"), loginAs("admin")]);

    // A ticket the seeded customer opened that the seeded agent is assigned to.
    const assigned = await api("/tickets?pageSize=100", { token: agent.token });
    ticketId = assigned.body.data.tickets.find((ticket) => ticket.createdBy.email === SEEDED_ACCOUNTS.customer)._id;

    const note = await api(`/tickets/${ticketId}/replies`, {
        method: "POST",
        token: agent.token,
        body: { body: INTERNAL_NOTE, isInternal: true },
    });
    expect(note.status).toBe(201);
    expect(containsNote(note.body)).toBe(true);

    const reply = await api(`/tickets/${ticketId}/replies`, { method: "POST", token: agent.token, body: { body: PUBLIC_REPLY } });
    expect(reply.status).toBe(201);
});

describe("internal notes are hidden from customers", () => {
    test("ticket detail omits internal note content but keeps public replies", async () => {
        const { status, body } = await api(`/tickets/${ticketId}`, { token: customer.token });
        expect(status).toBe(200);
        expect(containsNote(body)).toBe(false);
        expect(body.data.replies.some((reply) => reply.isInternal)).toBe(false);
        expect(body.data.replies.map((reply) => reply.body)).toContain(PUBLIC_REPLY);
    });

    test("ticket list omits internal note content", async () => {
        const { status, body } = await api("/tickets?pageSize=100", { token: customer.token });
        expect(status).toBe(200);
        expect(body.data.tickets.some((ticket) => ticket._id === ticketId)).toBe(true);
        expect(containsNote(body)).toBe(false);
    });

    test("the ticket returned after a customer reply omits internal note content", async () => {
        const { status, body } = await api(`/tickets/${ticketId}/replies`, {
            method: "POST",
            token: customer.token,
            body: { body: "Thanks, I will wait for your update." },
        });
        expect(status).toBe(201);
        expect(containsNote(body)).toBe(false);
    });

    test("a customer cannot post an internal note", async () => {
        const { status, body } = await api(`/tickets/${ticketId}/replies`, {
            method: "POST",
            token: customer.token,
            body: { body: "Trying to post a hidden note", isInternal: true },
        });
        expect(status).toBe(201);
        expect(body.data.replies.find((reply) => reply.body === "Trying to post a hidden note").isInternal).toBe(false);
    });
});

describe("staff still see internal notes", () => {
    test("the assigned agent sees the note", async () => {
        const { body } = await api(`/tickets/${ticketId}`, { token: agent.token });
        expect(containsNote(body)).toBe(true);
    });

    test("an admin sees the note", async () => {
        const { body } = await api(`/tickets/${ticketId}`, { token: admin.token });
        expect(containsNote(body)).toBe(true);
    });
});
