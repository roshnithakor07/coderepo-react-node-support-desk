import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { User } from "../src/features/auth/user.model.js";
import { Notification } from "../src/features/notifications/notification.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { clearRateLimits } from "../src/shared/middleware/rate-limit.js";
import { api, loginAs } from "./helpers/api.js";

// Agent teams: an agent works only the categories their team covers. The second dimension of access,
// on top of the role.

let admin;
let agent; // agent1: billing + technical
let agentGeneral; // agent4: general only
let customer;

// The seeded tickets nobody has picked up, one per category, which is what the queue is made of.
const UNOWNED_BILLING = "Cannot download my past invoices";
const UNOWNED_GENERAL = "Where do I find my account history?";
// Seeded 48 hours ago, long before this rule existed: the old record every claim and assignment is
// also tested against.
const OLD_TICKET = "Duplicate charge on my card";

const restoreTickets = new Map();
const restoreAgents = new Map();

function list(query, token) {
    return api(`/tickets?${query}`, { token });
}

function assign(ticketId, agentId, token) {
    return api(`/tickets/${ticketId}/assign`, { method: "POST", token, body: { agentId } });
}

function update(ticketId, patch, token) {
    return api(`/tickets/${ticketId}`, { method: "PUT", token, body: patch });
}

async function seeded(title) {
    const ticket = await Ticket.findOne({ title }).lean();
    expect(ticket).not.toBeNull();
    if (!restoreTickets.has(title)) restoreTickets.set(title, ticket);
    return ticket;
}

async function remember(email) {
    const user = await User.findOne({ email }).lean();
    if (!restoreAgents.has(email)) restoreAgents.set(email, user.categories);
    return user;
}

function titles(body) {
    return body.data.tickets.map((ticket) => ticket.title);
}

beforeAll(async () => {
    clearRateLimits();
    [admin, agent, agentGeneral, customer] = await Promise.all([
        loginAs("admin"),
        loginAs("agent"),
        loginAs("agentGeneral"),
        loginAs("customer"),
    ]);
});

// Every seeded record this file touches goes back as it was, so the shared database ends where it
// started whichever order the files run in.
afterAll(async () => {
    for (const ticket of restoreTickets.values()) {
        await Ticket.updateOne(
            { _id: ticket._id },
            {
                $set: {
                    category: ticket.category,
                    assignedTo: ticket.assignedTo ?? null,
                    unassignedNotifiedAt: ticket.unassignedNotifiedAt ?? null,
                },
            },
        );
    }
    for (const [email, categories] of restoreAgents) {
        await User.updateOne({ email }, { $set: { categories } });
    }
});

describe("the unassigned queue is limited to the agent's categories", () => {
    test("an agent sees the tickets nobody owns in their own categories, and no others", async () => {
        const { status, body } = await list("view=unassigned", agent.token);
        expect(status).toBe(200);
        // agent1 covers billing and technical, so the general ticket is not theirs to see.
        expect(titles(body)).toContain(UNOWNED_BILLING);
        expect(titles(body)).not.toContain(UNOWNED_GENERAL);
        expect(body.data.tickets.every((ticket) => ticket.assignedTo === null)).toBe(true);
    });

    test("another team's queue holds the other tickets", async () => {
        const { body } = await list("view=unassigned", agentGeneral.token);
        expect(titles(body)).toContain(UNOWNED_GENERAL);
        expect(titles(body)).not.toContain(UNOWNED_BILLING);
    });

    test("an admin's queue is the whole backlog", async () => {
        const { body } = await list("view=unassigned", admin.token);
        expect(titles(body)).toContain(UNOWNED_BILLING);
        expect(titles(body)).toContain(UNOWNED_GENERAL);
    });

    test("a customer has no unassigned queue", async () => {
        const { status, body } = await list("view=unassigned", customer.token);
        expect(status).toBe(403);
        expect(body.error.code).toBe("FORBIDDEN");
        expect(body.error.message).toContain("support team");
    });

    test("a filter inside the queue narrows it and never reaches past the team", async () => {
        // Billing is not agent4's category, so asking for it by name still returns nothing.
        const { status, body } = await list("view=unassigned&category=billing", agentGeneral.token);
        expect(status).toBe(200);
        expect(body.data.tickets).toEqual([]);
        // A finished status cannot appear in a queue of work still waiting.
        const closed = await list("view=unassigned&status=closed", admin.token);
        expect(closed.body.data.tickets).toEqual([]);
    });

    test("the default list is unchanged: an agent's own tickets, all assigned to them", async () => {
        const { body } = await list("pageSize=100", agent.token);
        expect(body.data.tickets.length).toBeGreaterThan(0);
        expect(body.data.tickets.every((ticket) => ticket.assignedTo?._id === agent.user.id)).toBe(true);
    });
});

describe("a ticket in the queue can be opened and claimed by the team that covers it", () => {
    test("an agent can open a ticket in their queue, and is offered the claim", async () => {
        const ticket = await seeded(UNOWNED_BILLING);
        const { status, body } = await api(`/tickets/${ticket._id}`, { token: agent.token });
        expect(status).toBe(200);
        expect(body.data.permissions.canClaim).toBe(true);
    });

    test("an agent cannot open an unowned ticket outside their categories, and hears which team has it", async () => {
        const ticket = await seeded(UNOWNED_GENERAL);
        const { status, body } = await api(`/tickets/${ticket._id}`, { token: agent.token });
        expect(status).toBe(403);
        expect(body.error.code).toBe("OUTSIDE_TEAM");
        expect(body.error.message).toContain("General");
    });

    test("claiming takes the ticket, clears the unassigned alert and is recorded as a claim", async () => {
        const ticket = await seeded(UNOWNED_BILLING);
        const { status, body } = await assign(ticket._id, agent.user.id, agent.token);
        expect(status).toBe(200);
        expect(body.data.assignedTo._id).toBe(agent.user.id);
        expect(body.data.permissions.canClaim).toBe(false);

        const stored = await Ticket.findById(ticket._id).lean();
        expect(stored.unassignedNotifiedAt).toBeNull();

        const trail = await api(`/tickets/${ticket._id}/audit`, { token: admin.token });
        expect(trail.body.data.some((entry) => entry.action === "claimed")).toBe(true);

        // It has left the queue it was claimed from.
        const queue = await list("view=unassigned", agent.token);
        expect(titles(queue.body)).not.toContain(UNOWNED_BILLING);

        await Ticket.updateOne({ _id: ticket._id }, { $set: { assignedTo: null, unassignedNotifiedAt: ticket.unassignedNotifiedAt } });
    });

    test("an agent cannot claim a ticket outside their categories, and the message names it", async () => {
        const ticket = await seeded(UNOWNED_BILLING);
        const { status, body } = await assign(ticket._id, agentGeneral.user.id, agentGeneral.token);
        expect(status).toBe(403);
        expect(body.error.code).toBe("OUTSIDE_TEAM");
        expect(body.error.message).toContain("Billing");
        expect((await Ticket.findById(ticket._id).lean()).assignedTo).toBeNull();
    });
});

describe("an agent can only be assigned tickets in their categories", () => {
    test("an admin cannot hand a billing ticket to an agent who covers only general", async () => {
        const ticket = await seeded(UNOWNED_BILLING);
        const { status, body } = await assign(ticket._id, agentGeneral.user.id, admin.token);
        expect(status).toBe(403);
        expect(body.error.code).toBe("OUTSIDE_TEAM");
        expect(body.error.message).toContain("Billing");
        expect(body.error.message).toContain(agentGeneral.user.name);
    });

    test("an admin can hand it to an agent who does cover it", async () => {
        const ticket = await seeded(UNOWNED_BILLING);
        const { status, body } = await assign(ticket._id, agent.user.id, admin.token);
        expect(status).toBe(200);
        expect(body.data.assignedTo._id).toBe(agent.user.id);
        await Ticket.updateOne({ _id: ticket._id }, { $set: { assignedTo: null, unassignedNotifiedAt: ticket.unassignedNotifiedAt } });
    });

    test("the rule holds on a ticket seeded days ago, not only on new ones", async () => {
        const old = await seeded(OLD_TICKET);
        expect(old.category).toBe("billing");
        expect(Date.now() - new Date(old.createdAt).getTime()).toBeGreaterThan(24 * 60 * 60 * 1000);

        const refused = await assign(old._id, agentGeneral.user.id, admin.token);
        expect(refused.status).toBe(403);
        expect(refused.body.error.code).toBe("OUTSIDE_TEAM");

        // Its own clock and stamps are untouched by the refusal.
        const stored = await Ticket.findById(old._id).lean();
        expect(stored.slaDeadline.getTime()).toBe(old.slaDeadline.getTime());
        expect(String(stored.assignedTo)).toBe(String(old.assignedTo));
    });

    test("an agent with no categories yet covers nothing, which is what an account from before teams looks like", async () => {
        const forgotten = await remember("agent3@example.com");
        await User.updateOne({ _id: forgotten._id }, { $set: { categories: [] } });

        const ticket = await seeded(UNOWNED_BILLING);
        const { status, body } = await assign(ticket._id, String(forgotten._id), admin.token);
        expect(status).toBe(403);
        expect(body.error.code).toBe("OUTSIDE_TEAM");
        expect(body.error.message).toContain("Billing");

        // And nothing can reach their queue either.
        const session = await loginAs("agentAccount");
        const queue = await list("view=unassigned", session.token);
        expect(queue.status).toBe(200);
        expect(queue.body.data.tickets).toEqual([]);

        await User.updateOne({ _id: forgotten._id }, { $set: { categories: forgotten.categories } });
    });
});

describe("auto-assignment picks the least-loaded agent in the ticket's category", () => {
    async function createTicket(title, category) {
        const { status, body } = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: { title, description: "Created by the agent teams test suite.", priority: "low", category },
        });
        expect(status).toBe(201);
        return body.data;
    }

    test("the ticket goes to somebody whose team covers it", async () => {
        const ticket = await createTicket("Auto-assigned inside the team", "general");
        // Noah is the only active agent covering general, so the choice is not a coincidence.
        expect(ticket.assignedTo?._id).toBe(agentGeneral.user.id);
        await Ticket.deleteOne({ _id: ticket._id });
    });

    test("with nobody covering the category the ticket waits in the queue and the admins are told", async () => {
        const ticket = await createTicket("Nobody covers shipping", "shipping");
        expect(ticket.assignedTo).toBeNull();

        const admins = await User.find({ role: "admin", isActive: true }).lean();
        for (const person of admins) {
            const alerts = await Notification.find({ userId: person._id, ticketId: ticket._id, type: "ticket_unassigned" }).lean();
            expect(alerts.length).toBe(1);
            expect(alerts[0].message).toContain("Shipping");
        }

        // It is in the admin's queue, and in no agent's.
        const adminQueue = await list("view=unassigned&pageSize=100", admin.token);
        expect(titles(adminQueue.body)).toContain("Nobody covers shipping");
        const agentQueue = await list("view=unassigned&pageSize=100", agent.token);
        expect(titles(agentQueue.body)).not.toContain("Nobody covers shipping");

        await Promise.all([Ticket.deleteOne({ _id: ticket._id }), Notification.deleteMany({ ticketId: ticket._id })]);
    });
});

describe("refiling a ticket cannot strand it outside its assignee's team", () => {
    test("moving it to a category the assignee does not cover is refused", async () => {
        const ticket = await seeded(OLD_TICKET);
        const assignee = await User.findById(ticket.assignedTo).lean();
        expect(assignee.categories).not.toContain("general");

        const { status, body } = await update(ticket._id, { category: "general" }, admin.token);
        expect(status).toBe(409);
        expect(body.error.code).toBe("ASSIGNEE_OUTSIDE_TEAM");
        expect(body.error.message).toContain(assignee.name);
        expect(body.error.message).toContain("General");
        expect((await Ticket.findById(ticket._id).lean()).category).toBe(ticket.category);
    });

    test("moving it to a category they do cover goes through", async () => {
        const ticket = await seeded(OLD_TICKET);
        const assignee = await User.findById(ticket.assignedTo).lean();
        const covered = assignee.categories.find((category) => category !== ticket.category);
        expect(covered).toBeTruthy();

        const { status, body } = await update(ticket._id, { category: covered }, admin.token);
        expect(status).toBe(200);
        expect(body.data.category).toBe(covered);
    });
});

describe("only an admin sets which categories an agent works", () => {
    test("an agent cannot change a team", async () => {
        const target = await remember("agent3@example.com");
        const { status } = await api(`/agents/${target._id}/categories`, {
            method: "PATCH",
            token: agent.token,
            body: { categories: ["billing"] },
        });
        expect(status).toBe(403);
    });

    test("a category that is not in Settings is refused, and the message says where to add it", async () => {
        const target = await remember("agent3@example.com");
        const { status, body } = await api(`/agents/${target._id}/categories`, {
            method: "PATCH",
            token: admin.token,
            body: { categories: ["billing", "warp drive"] },
        });
        expect(status).toBe(422);
        expect(body.error.code).toBe("UNKNOWN_CATEGORY");
        expect(body.error.message).toContain("Settings");
    });

    test("an empty team is refused: an agent nothing can reach is not a team", async () => {
        const target = await remember("agent3@example.com");
        const { status, body } = await api(`/agents/${target._id}/categories`, {
            method: "PATCH",
            token: admin.token,
            body: { categories: [] },
        });
        expect(status).toBe(400);
        expect(body.error.message).toContain("at least one category");
    });

    test("an admin sets them, and what the agent already holds stays with them", async () => {
        const target = await remember("agent3@example.com");
        const held = await Ticket.countDocuments({ assignedTo: target._id });

        const { status, body } = await api(`/agents/${target._id}/categories`, {
            method: "PATCH",
            token: admin.token,
            body: { categories: ["technical"] },
        });
        expect(status).toBe(200);
        expect(body.data.categories).toEqual(["technical"]);
        expect(await Ticket.countDocuments({ assignedTo: target._id })).toBe(held);

        await User.updateOne({ _id: target._id }, { $set: { categories: target.categories } });
    });

    test("a new agent is created with their team, in lower case", async () => {
        const { status, body } = await api("/agents", {
            method: "POST",
            token: admin.token,
            body: {
                name: "Team Test Agent",
                email: "team.test.agent@example.com",
                password: "SupportDesk@2026",
                categories: ["Billing", "billing", " Technical "],
            },
        });
        expect(status).toBe(201);
        expect(body.data.categories).toEqual(["billing", "technical"]);
        await User.deleteOne({ email: "team.test.agent@example.com" });
    });
});
