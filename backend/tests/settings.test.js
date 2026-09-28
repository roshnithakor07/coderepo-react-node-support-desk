import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
        const { status, body } = await update({ categories: ["  General ", "Billing", "Shipping delays"] });
        expect(status).toBe(200);
        expect(body.data.categories).toEqual(["general", "billing", "shipping delays"]);
    });

    test("only admins can change settings", async () => {
        expect((await update({ slaHours: { low: 12 } }, agent.token)).status).toBe(403);
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
