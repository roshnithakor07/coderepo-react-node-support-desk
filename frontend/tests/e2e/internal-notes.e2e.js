import { ACCOUNTS, readSavedToken, sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

const stamp = Date.now();
const INTERNAL_NOTE = `Internal only: escalated to billing engineering (${stamp})`;
const PUBLIC_REPLY = `Thanks for your patience, we are on it (${stamp})`;

let ticketTitle;

test.beforeAll(async ({ playwright }) => {
    const agentApi = await playwright.request.newContext({
        baseURL: "http://localhost:3000",
        extraHTTPHeaders: { Authorization: `Bearer ${readSavedToken("agent")}` },
    });
    const list = await (await agentApi.get("/api/v1/tickets?pageSize=100")).json();
    const ticket = list.data.tickets.find((entry) => entry.createdBy.email === ACCOUNTS.customer.email);
    ticketTitle = ticket.title;

    for (const reply of [
        { body: INTERNAL_NOTE, isInternal: true },
        { body: PUBLIC_REPLY, isInternal: false },
    ]) {
        const response = await agentApi.post(`/api/v1/tickets/${ticket._id}/replies`, { data: reply });
        expect(response.status()).toBe(201);
    }
    await agentApi.dispose();
});

async function openTicket(page) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Tickets" }).click();
    await page.locator("table tbody tr", { hasText: ticketTitle }).first().click();
    await expect(page.getByRole("heading", { name: ticketTitle })).toBeVisible();
}

test.describe("customer view", () => {
    test.use({ storageState: sessionFile("customer") });

    test("shows the public reply but never the internal note text", async ({ page }) => {
        await openTicket(page);
        await expect(page.getByText(PUBLIC_REPLY)).toBeVisible();
        await expect(page.getByText(INTERNAL_NOTE)).toHaveCount(0);
        await expect(page.getByText("Internal Note", { exact: false })).toHaveCount(0);
    });
});

test.describe("agent view", () => {
    test.use({ storageState: sessionFile("agent") });

    test("shows the internal note to the assigned agent", async ({ page }) => {
        await openTicket(page);
        await expect(page.getByText(INTERNAL_NOTE)).toBeVisible();
    });
});
