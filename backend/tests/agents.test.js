import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { User } from "../src/features/auth/user.model.js";
import { api, loginAs } from "./helpers/api.js";

let admin;
let agent;
let customer;
let idsByEmail;

async function listAgents(token = admin.token) {
    const { status, body } = await api("/agents", { token });
    expect(status).toBe(200);
    return body.data;
}

function setActive(email, isActive) {
    return api(`/agents/${idsByEmail[email]}/status`, { method: "PATCH", token: admin.token, body: { isActive } });
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
    const agents = await User.find({ role: "agent" }).lean();
    idsByEmail = Object.fromEntries(agents.map((user) => [user.email, String(user._id)]));
});

afterAll(async () => {
    await setActive("agent5@example.com", false);
});

describe("agents list", () => {
    test("includes inactive agents, with their status and workload", async () => {
        const agents = await listAgents();
        expect(agents).toHaveLength(5);
        const inactive = agents.find((entry) => entry.email === "agent5@example.com");
        expect(inactive).toMatchObject({ isActive: false, openTicketCount: 0 });
        expect(agents.every((entry) => typeof entry.openTicketCount === "number")).toBe(true);
        expect(agents.some((entry) => "password" in entry)).toBe(false);
    });

    test("agents can read the full list too", async () => {
        expect(await listAgents(agent.token)).toHaveLength(5);
    });

    test("a deactivated agent stays in the list and can be reactivated", async () => {
        // A fresh agent with nothing open, so deactivating them has no tickets to hand on. Deactivating
        // someone with work is its own rule, with its own tests.
        const created = await api("/agents", {
            method: "POST",
            token: admin.token,
            body: {
                name: "Reactivation Test",
                email: "reactivation.test@example.com",
                password: "SupportDesk@2026",
                categories: ["billing"],
            },
        });
        expect(created.status).toBe(201);
        idsByEmail["reactivation.test@example.com"] = created.body.data.id;
        const email = "reactivation.test@example.com";

        expect((await setActive(email, false)).status).toBe(200);
        expect((await listAgents()).find((entry) => entry.email === email).isActive).toBe(false);

        const reactivated = await setActive(email, true);
        expect(reactivated.status).toBe(200);
        expect(reactivated.body.data.isActive).toBe(true);
        expect((await listAgents()).find((entry) => entry.email === email).isActive).toBe(true);

        await User.deleteOne({ email });
    });

    test("the seeded inactive agent can be activated from the list", async () => {
        const { status, body } = await setActive("agent5@example.com", true);
        expect(status).toBe(200);
        expect(body.data.isActive).toBe(true);
    });
});

describe("auto-assignment", () => {
    test("never assigns a new ticket to an inactive agent", async () => {
        await setActive("agent5@example.com", false);
        const { status, body } = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: { title: "Auto-assignment check", description: "Created by the agents test suite.", priority: "low" },
        });
        expect(status).toBe(201);
        const assignee = await User.findById(body.data.assignedTo._id).lean();
        expect(assignee).toMatchObject({ role: "agent", isActive: true });
    });
});
