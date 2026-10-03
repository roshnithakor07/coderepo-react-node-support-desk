import { beforeAll, describe, expect, test } from "bun:test";
import { api, loginAs } from "./helpers/api.js";

let admin;
let customer;
let agent;

function list(query, token) {
    return api(`/tickets${query}`, { token });
}

beforeAll(async () => {
    [admin, customer, agent] = await Promise.all([loginAs("admin"), loginAs("customer"), loginAs("agent")]);
});

describe("ticket search", () => {
    test("matches part of a word, not only whole words", async () => {
        const { status, body } = await list("?search=log", admin.token);
        expect(status).toBe(200);
        expect(body.data.total).toBeGreaterThan(0);
        for (const ticket of body.data.tickets) {
            expect(`${ticket.title} ${ticket.description}`.toLowerCase()).toContain("log");
        }
    });

    test("ignores case", async () => {
        const [lower, upper] = await Promise.all([list("?search=account", admin.token), list("?search=ACCOUNT", admin.token)]);
        expect(lower.body.data.total).toBeGreaterThan(0);
        expect(upper.body.data.total).toBe(lower.body.data.total);
    });

    test("searches the description as well as the title", async () => {
        const created = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: {
                title: "Search coverage check",
                description: "The word zebracrossing appears only in this description.",
                priority: "low",
            },
        });
        expect(created.status).toBe(201);

        const { body } = await list("?search=zebracross", customer.token);
        expect(body.data.tickets.map((ticket) => ticket._id)).toContain(created.body.data._id);
    });

    test("treats regular expression characters as literal text instead of failing", async () => {
        for (const term of ["(", "a*", ".*", "[", "\\"]) {
            const { status, body } = await list(`?search=${encodeURIComponent(term)}`, admin.token);
            expect(status).toBe(200);
            expect(body.data.total).toBe(0);
        }
    });

    test("an empty or blank term returns the unfiltered list", async () => {
        const [all, blank] = await Promise.all([list("", admin.token), list("?search=%20%20", admin.token)]);
        expect(blank.body.data.total).toBe(all.body.data.total);
    });

    test("stays inside what the signed-in role may see", async () => {
        const [agentResult, adminResult] = await Promise.all([list("?search=a", agent.token), list("?search=a", admin.token)]);
        expect(agentResult.body.data.total).toBeLessThan(adminResult.body.data.total);
        for (const ticket of agentResult.body.data.tickets) {
            expect(ticket.assignedTo._id).toBe(agent.user.id);
        }
    });
});

describe("ticket sorting", () => {
    const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
    const STATUS_RANK = { open: 1, in_progress: 2, pending: 3, resolved: 4, closed: 5 };

    test("newest first is the default", async () => {
        const [plain, explicit] = await Promise.all([list("?pageSize=10", admin.token), list("?pageSize=10&sort=newest", admin.token)]);
        expect(plain.body.data.tickets.map((ticket) => ticket._id)).toEqual(explicit.body.data.tickets.map((ticket) => ticket._id));
        const dates = plain.body.data.tickets.map((ticket) => new Date(ticket.createdAt).getTime());
        expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    });

    test("oldest first reverses it", async () => {
        const { body } = await list("?pageSize=10&sort=oldest", admin.token);
        const dates = body.data.tickets.map((ticket) => new Date(ticket.createdAt).getTime());
        expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    });

    test("title sorts alphabetically, ignoring case, in both directions", async () => {
        const ascending = await list("?pageSize=100&sort=title_asc", admin.token);
        const titles = ascending.body.data.tickets.map((ticket) => ticket.title.toLowerCase());
        expect([...titles].sort()).toEqual(titles);

        const descending = await list("?pageSize=100&sort=title_desc", admin.token);
        expect(descending.body.data.tickets.map((ticket) => ticket.title.toLowerCase())).toEqual([...titles].reverse());
    });

    test("priority sorts by meaning, highest first, not alphabetically", async () => {
        const { body } = await list("?pageSize=100&sort=priority_desc", admin.token);
        const ranks = body.data.tickets.map((ticket) => PRIORITY_RANK[ticket.priority]);
        expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
    });

    test("status sorts along the ticket lifecycle", async () => {
        const { body } = await list("?pageSize=100&sort=status", admin.token);
        const ranks = body.data.tickets.map((ticket) => STATUS_RANK[ticket.status]);
        expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    });

    test("the order holds across pages instead of only inside one page", async () => {
        const [first, second] = await Promise.all([
            list("?pageSize=3&page=1&sort=title_asc", admin.token),
            list("?pageSize=3&page=2&sort=title_asc", admin.token),
        ]);
        const firstTitles = first.body.data.tickets.map((ticket) => ticket.title.toLowerCase());
        const secondTitles = second.body.data.tickets.map((ticket) => ticket.title.toLowerCase());
        expect(secondTitles.length).toBeGreaterThan(0);
        expect(firstTitles.at(-1) <= secondTitles[0]).toBe(true);
        expect(firstTitles.some((title) => secondTitles.includes(title))).toBe(false);
    });

    test("an unknown sort is rejected instead of silently ignored", async () => {
        const { status, body } = await list("?sort=by_vibes", admin.token);
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });
});
