import { beforeAll, describe, expect, test } from "bun:test";
import { api, loginAs, SEEDED_ACCOUNTS } from "./helpers/api.js";

let admin;
let agent;
let customer;

function createTemplate(token, body) {
    return api("/canned-responses", { method: "POST", token, body });
}

function deleteTemplate(id, token) {
    return api(`/canned-responses/${id}`, { method: "DELETE", token });
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
});

describe("one account per email address", () => {
    test("signing up with an email already in use is refused", async () => {
        const { status, body } = await api("/auth/register", {
            method: "POST",
            body: { name: "Duplicate Signup", email: SEEDED_ACCOUNTS.customer, password: "SupportDesk@2026" },
        });
        expect(status).toBe(409);
        expect(body.error.code).toBe("EMAIL_TAKEN");
    });

    test("adding an agent with an email already in use is refused", async () => {
        const { status, body } = await api("/agents", {
            method: "POST",
            token: admin.token,
            body: { name: "Duplicate Agent", email: SEEDED_ACCOUNTS.agent, password: "SupportDesk@2026" },
        });
        expect(status).toBe(409);
        expect(body.error.code).toBe("EMAIL_TAKEN");
    });
});

describe("canned responses belong to the person who wrote them", () => {
    test("customers cannot reach them at all", async () => {
        expect((await api("/canned-responses", { token: customer.token })).status).toBe(403);
        expect((await createTemplate(customer.token, { title: "Nope", body: "Not for customers." })).status).toBe(403);
    });

    test("an agent's template is personal, whatever they ask for", async () => {
        const { status, body } = await createTemplate(agent.token, {
            title: "Agent personal template",
            body: "Only this agent should see this one.",
            isGlobal: true,
        });
        expect(status).toBe(201);
        expect(body.data.isGlobal).toBe(false);
        expect((await deleteTemplate(body.data._id, agent.token)).status).toBe(200);
    });

    test("an agent cannot delete a template somebody else owns", async () => {
        const created = await createTemplate(admin.token, {
            title: "Admin private template",
            body: "Belongs to the admin who wrote it.",
            isGlobal: false,
        });
        expect(created.status).toBe(201);

        const { status, body } = await deleteTemplate(created.body.data._id, agent.token);
        expect(status).toBe(403);
        expect(body.error.code).toBe("FORBIDDEN");

        // Still there afterwards.
        const list = await api("/canned-responses", { token: admin.token });
        expect(list.body.data.some((item) => item._id === created.body.data._id)).toBe(true);
        expect((await deleteTemplate(created.body.data._id, admin.token)).status).toBe(200);
    });

    test("an agent deletes their own template, and an admin can delete anyone's", async () => {
        const own = await createTemplate(agent.token, { title: "Agent deletes this", body: "Written by the agent." });
        expect((await deleteTemplate(own.body.data._id, agent.token)).status).toBe(200);

        const theirs = await createTemplate(agent.token, { title: "Admin deletes this", body: "Written by the agent." });
        expect((await deleteTemplate(theirs.body.data._id, admin.token)).status).toBe(200);
    });

    test("a template that does not exist is a 404, not a 403", async () => {
        const { status, body } = await deleteTemplate("000000000000000000000000", admin.token);
        expect(status).toBe(404);
        expect(body.error.code).toBe("CANNED_RESPONSE_NOT_FOUND");
    });

    test("an agent's list is the global templates plus their own", async () => {
        const { body } = await api("/canned-responses", { token: agent.token });
        const mine = String(agent.user.id);
        expect(body.data.length).toBeGreaterThan(0);
        expect(body.data.every((item) => item.isGlobal || String(item.createdBy) === mine)).toBe(true);
    });
});
