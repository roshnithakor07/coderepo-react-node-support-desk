import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api, loginAs } from "./helpers/api.js";

let admin;
let agent;
let original;

function update(body, token = admin.token) {
    return api("/settings", { method: "PUT", token, body });
}

beforeAll(async () => {
    [admin, agent] = await Promise.all([loginAs("admin"), loginAs("agent")]);
    original = (await api("/settings", { token: admin.token })).body.data;
});

afterAll(async () => {
    await update({ slaHours: original.slaHours, categories: original.categories });
});

describe("saving settings", () => {
    test("a partial SLA update keeps the other priorities", async () => {
        const { status, body } = await update({ slaHours: { critical: 2 } });
        expect(status).toBe(200);
        expect(body.data.slaHours).toEqual({ ...original.slaHours, critical: 2 });
    });

    test("category names are trimmed and stored in lower case", async () => {
        // Nothing is removed here: a category agents or open tickets still use cannot be, which is
        // its own rule. Adding one on the end is the part this test is about.
        const { status, body } = await update({ categories: [...original.categories, "  Shipping Delays "] });
        expect(status).toBe(200);
        expect(body.data.categories).toEqual([...original.categories, "shipping delays"]);
    });

    test("only admins can change settings", async () => {
        expect((await update({ slaHours: { low: 12 } }, agent.token)).status).toBe(403);
    });
});

// Removing a category agents are on, or open work is filed under, would leave both pointing at
// something that no longer exists.
describe("a category still in use cannot be removed", () => {
    test("the refusal names the category and counts what is using it", async () => {
        const before = (await api("/settings", { token: admin.token })).body.data.categories;
        const { status, body } = await update({ categories: before.filter((category) => category !== "billing") });
        expect(status).toBe(409);
        expect(body.error.code).toBe("CATEGORY_IN_USE");
        expect(body.error.message).toContain("Billing");
        expect(body.error.message).toMatch(/\d+ agents?/);
        expect(body.error.message).toMatch(/\d+ open tickets?/);

        // Nothing was written: the whole update is refused, not the part that was allowed.
        const stored = (await api("/settings", { token: admin.token })).body.data;
        expect(stored.categories).toEqual(before);
    });

    test("the settings page is told what is in use, so the remove button can say why", async () => {
        const { body } = await api("/settings", { token: admin.token });
        expect(body.data.categoryUsage.billing.agents).toBeGreaterThan(0);
        expect(body.data.categoryUsage.billing.openTickets).toBeGreaterThan(0);
    });

    test("a category nothing uses can be removed", async () => {
        const before = (await api("/settings", { token: admin.token })).body.data.categories;
        expect((await update({ categories: [...before, "shipping"] })).status).toBe(200);

        const { status, body } = await update({ categories: before });
        expect(status).toBe(200);
        expect(body.data.categories).toEqual(before);
    });

    test("closed and resolved tickets do not hold a category open", async () => {
        // "general" is on one agent's team here, so the count that refuses it is the agent count
        // alone: finished work filed under it is history and does not block the change.
        const { body } = await api("/settings", { token: admin.token });
        const usage = body.data.categoryUsage.general;
        const openGeneral = await Ticket.countDocuments({ category: "general", status: { $in: ["open", "in_progress", "pending"] } });
        expect(usage.openTickets).toBe(openGeneral);
        expect(await Ticket.countDocuments({ category: "general" })).toBeGreaterThan(openGeneral);
    });
});

describe("rejecting invalid settings", () => {
    const cases = [
        ["no changes at all", {}, "Change the SLA hours or the categories."],
        ["zero hours", { slaHours: { high: 0 } }, "Use at least 1 hour."],
        ["negative hours", { slaHours: { high: -4 } }, "Use at least 1 hour."],
        ["fractional hours", { slaHours: { high: 1.5 } }, "Use whole hours."],
        ["more than 30 days", { slaHours: { low: 721 } }, "Use at most 720 hours (30 days)."],
        ["hours sent as text", { slaHours: { low: "24" } }, null],
        ["an unknown priority", { slaHours: { urgent: 2 } }, null],
        ["no categories", { categories: [] }, "Keep at least one category."],
        ["a blank category", { categories: ["general", "   "] }, "Category names can't be empty."],
        ["a category over 30 characters", { categories: ["x".repeat(31)] }, "Category names can be at most 30 characters."],
        ["duplicate categories, ignoring case and spaces", { categories: ["Billing", " billing "] }, "Category names must be unique."],
        [
            "more than 20 categories",
            { categories: Array.from({ length: 21 }, (_, index) => `category ${index + 1}`) },
            "Use at most 20 categories.",
        ],
    ];

    for (const [label, body, message] of cases) {
        test(`${label} returns 400`, async () => {
            const response = await update(body);
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe("VALIDATION_ERROR");
            if (message) expect(response.body.error.message).toBe(message);
        });
    }

    test("a rejected update leaves the stored settings unchanged", async () => {
        const before = (await api("/settings", { token: admin.token })).body.data;
        await update({ categories: [] });
        const after = (await api("/settings", { token: admin.token })).body.data;
        expect(after.categories).toEqual(before.categories);
        expect(after.slaHours).toEqual(before.slaHours);
    });
});
