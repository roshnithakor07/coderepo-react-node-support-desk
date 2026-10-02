import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { User } from "../src/features/auth/user.model.js";
import { api, loginAs, SEEDED_ACCOUNTS } from "./helpers/api.js";

let admin;
let agent;
let customer;
let agentIds;
let ownTicket;
let otherAgentsTicket;

async function assignedEmail(ticketId) {
    const { body } = await api(`/tickets/${ticketId}`, { token: admin.token });
    return body.data.assignedTo?.email;
}

function assign(ticketId, agentId, token) {
    return api(`/tickets/${ticketId}/assign`, { method: "POST", token, body: { agentId } });
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);

    const agents = await User.find({ role: "agent" }).lean();
    agentIds = Object.fromEntries(agents.map((user) => [user.email.split("@")[0], String(user._id)]));

    const { body } = await api("/tickets?pageSize=100", { token: admin.token });
    const tickets = body.data.tickets;
    // Avoid the seeded customer's tickets, which other test files use.
    ownTicket = tickets.find(
        (ticket) => ticket.assignedTo?.email === SEEDED_ACCOUNTS.agent && ticket.createdBy.email !== SEEDED_ACCOUNTS.customer,
    );
    otherAgentsTicket = tickets.find((ticket) => ticket.assignedTo?.email === "agent2@example.com");
});

afterAll(async () => {
    await assign(ownTicket._id, agentIds.agent1, admin.token);
    await assign(otherAgentsTicket._id, agentIds.agent2, admin.token);
});

describe("who can assign a ticket", () => {
    test("an agent cannot reassign a ticket assigned to another agent", async () => {
        const { status, body } = await assign(otherAgentsTicket._id, agentIds.agent1, agent.token);
        expect(status).toBe(403);
        expect(body.error.code).toBe("FORBIDDEN");
        expect(await assignedEmail(otherAgentsTicket._id)).toBe("agent2@example.com");
    });

    test("an agent can hand their own ticket to another agent", async () => {
        const { status, body } = await assign(ownTicket._id, agentIds.agent2, agent.token);
        expect(status).toBe(200);
        expect(body.data.assignedTo.email).toBe("agent2@example.com");
    });

    test("an admin can assign any ticket", async () => {
        const { status, body } = await assign(otherAgentsTicket._id, agentIds.agent3, admin.token);
        expect(status).toBe(200);
        expect(body.data.assignedTo.email).toBe("agent3@example.com");
    });

    test("a customer cannot assign tickets", async () => {
        const { status } = await assign(otherAgentsTicket._id, agentIds.agent1, customer.token);
        expect(status).toBe(403);
    });
});

describe("agentId validation", () => {
    test("a malformed agentId is rejected with 400, not 500", async () => {
        const { status, body } = await assign(otherAgentsTicket._id, "not-an-id", admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("an unknown agentId is rejected", async () => {
        const { status, body } = await assign(otherAgentsTicket._id, "000000000000000000000000", admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("INVALID_AGENT");
    });

    test("an inactive agent cannot be assigned", async () => {
        const { status, body } = await assign(otherAgentsTicket._id, agentIds.agent5, admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("INVALID_AGENT");
    });

    test("a non-agent account cannot be assigned", async () => {
        const { status, body } = await assign(otherAgentsTicket._id, admin.user.id, admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("INVALID_AGENT");
    });
});
