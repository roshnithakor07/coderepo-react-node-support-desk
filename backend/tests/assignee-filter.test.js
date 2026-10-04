import { beforeAll, describe, expect, test } from "bun:test";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, loginAs } from "./helpers/api.js";

// The ticket list's "Assigned to" filter. It runs in the database, next to the search, status and
// priority filters, and it can only narrow what the viewer may already see: an admin asks for any
// agent, an agent only for themselves, and "unassigned" means exactly what it means in the queue.

let admin;
let agent; // agent1: billing + technical
let agentGeneral; // agent4: general only
let customer;

function list(query, token) {
    return api(`/tickets?${query}`, { token });
}

function titlesOf(body) {
    return body.data.tickets.map((ticket) => ticket.title);
}

beforeAll(async () => {
    [admin, agent, agentGeneral, customer] = await Promise.all([
        loginAs("admin"),
        loginAs("agent"),
        loginAs("agentGeneral"),
        loginAs("customer"),
    ]);
});

describe("an admin filters by any agent", () => {
    test("asking for one agent returns their tickets and nobody else's", async () => {
        const { status, body } = await list(`assignee=${agent.user.id}&pageSize=100`, admin.token);
        expect(status).toBe(200);
        expect(body.data.tickets.length).toBeGreaterThan(0);
        expect(body.data.tickets.every((ticket) => ticket.assignedTo?._id === agent.user.id)).toBe(true);
        expect(body.data.total).toBe(await Ticket.countDocuments({ assignedTo: agent.user.id }));
    });

    test("another agent's filter returns a different set", async () => {
        const [first, second] = await Promise.all([
            list(`assignee=${agent.user.id}&pageSize=100`, admin.token),
            list(`assignee=${agentGeneral.user.id}&pageSize=100`, admin.token),
        ]);
        expect(titlesOf(second.body).some((title) => titlesOf(first.body).includes(title))).toBe(false);
    });

    test("unassigned returns the tickets nobody owns, still in play", async () => {
        const { status, body } = await list("assignee=unassigned&pageSize=100", admin.token);
        expect(status).toBe(200);
        expect(body.data.tickets.length).toBeGreaterThan(0);
        expect(body.data.tickets.every((ticket) => !ticket.assignedTo)).toBe(true);
        expect(body.data.tickets.every((ticket) => ["open", "in_progress", "pending"].includes(ticket.status))).toBe(true);
    });

    test("it combines with the status filter, and with the search", async () => {
        const open = await list(`assignee=${agent.user.id}&status=open&pageSize=100`, admin.token);
        expect(open.status).toBe(200);
        expect(open.body.data.tickets.every((ticket) => ticket.status === "open" && ticket.assignedTo?._id === agent.user.id)).toBe(true);
        expect(open.body.data.total).toBe(await Ticket.countDocuments({ assignedTo: agent.user.id, status: "open" }));

        const searched = await list(`assignee=${agent.user.id}&search=invoice&pageSize=100`, admin.token);
        expect(searched.status).toBe(200);
        expect(
            searched.body.data.tickets.every(
                (ticket) => ticket.assignedTo?._id === agent.user.id && /invoice/i.test(`${ticket.title} ${ticket.description}`),
            ),
        ).toBe(true);
    });

    test("a page of filtered results is a page of that filter, not of the whole list", async () => {
        const all = await list(`assignee=${agent.user.id}&pageSize=100`, admin.token);
        const firstPage = await list(`assignee=${agent.user.id}&pageSize=1&page=1`, admin.token);
        expect(firstPage.body.data.total).toBe(all.body.data.total);
        expect(firstPage.body.data.tickets).toHaveLength(1);
    });
});

describe("an agent filters only within their own list", () => {
    test("asking for themselves is their own list", async () => {
        const [filtered, plain] = await Promise.all([
            list(`assignee=${agent.user.id}&pageSize=100`, agent.token),
            list("pageSize=100", agent.token),
        ]);
        expect(filtered.status).toBe(200);
        expect(titlesOf(filtered.body).sort()).toEqual(titlesOf(plain.body).sort());
    });

    test("asking for another agent shows nothing, and never their tickets", async () => {
        const { status, body } = await list(`assignee=${agentGeneral.user.id}&pageSize=100`, agent.token);
        expect(status).toBe(200);
        expect(body.data.tickets).toHaveLength(0);
        expect(body.data.total).toBe(0);
    });

    test("unassigned is their team's queue, never another team's", async () => {
        const [filtered, queue] = await Promise.all([
            list("assignee=unassigned&pageSize=100", agent.token),
            list("view=unassigned&pageSize=100", agent.token),
        ]);
        expect(filtered.status).toBe(200);
        // Non-empty, or the comparison below would prove nothing.
        expect(queue.body.data.tickets.length).toBeGreaterThan(0);
        expect(titlesOf(filtered.body).sort()).toEqual(titlesOf(queue.body).sort());
        expect(filtered.body.data.tickets.every((ticket) => ["billing", "technical"].includes(ticket.category))).toBe(true);
    });

    test("inside the queue, asking for an agent matches nothing, because nobody owns those tickets", async () => {
        const { status, body } = await list(`view=unassigned&assignee=${agent.user.id}&pageSize=100`, agent.token);
        expect(status).toBe(200);
        expect(body.data.tickets).toHaveLength(0);
    });
});

describe("what the filter refuses", () => {
    test("a malformed assignee is a 400, not an empty list", async () => {
        const { status, body } = await list("assignee=not-an-id", admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("a customer cannot filter by assignee at all", async () => {
        const named = await list(`assignee=${agent.user.id}`, customer.token);
        expect(named.status).toBe(403);
        expect(named.body.error.code).toBe("FORBIDDEN");
        expect(named.body.error.message).toContain("support team");
        expect((await list("assignee=unassigned", customer.token)).status).toBe(403);
        // Their own list still works, untouched by the filter they may not use.
        expect((await list("pageSize=100", customer.token)).status).toBe(200);
    });
});
