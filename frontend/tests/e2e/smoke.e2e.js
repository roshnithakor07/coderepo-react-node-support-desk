import { ACCOUNTS, sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

const NAV_BY_ROLE = {
    admin: ["Dashboard", "Tickets", "Agents", "Canned responses", "Analytics", "Settings"],
    agent: ["Dashboard", "Tickets", "Agents", "Canned responses"],
    customer: ["Dashboard", "Tickets"],
};

function mainNav(page) {
    return page.getByRole("navigation", { name: "Main" }).getByRole("button");
}

async function openFirstTicket(page) {
    await mainNav(page).filter({ hasText: "Tickets" }).click();
    await page.locator("table tbody tr").first().click();
    await expect(page.getByRole("button", { name: "Back to tickets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conversation" })).toBeVisible();
}

test.describe("customer journey", () => {
    test.use({ storageState: sessionFile("customer") });

    test("sees only customer navigation and replies publicly on their own ticket", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { name: `Welcome back, ${ACCOUNTS.customer.firstName}` })).toBeVisible();
        await expect(mainNav(page)).toHaveText(NAV_BY_ROLE.customer);

        await openFirstTicket(page);
        await expect(page.getByRole("tab", { name: "Public Reply" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Internal Note" })).toHaveCount(0);
        await expect(page.getByText("Audit trail")).toHaveCount(0);
    });
});

test.describe("agent journey", () => {
    test.use({ storageState: sessionFile("agent") });

    test("sees team tools and can write internal notes", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { name: `Welcome back, ${ACCOUNTS.agent.firstName}` })).toBeVisible();
        await expect(mainNav(page)).toHaveText(NAV_BY_ROLE.agent);

        await mainNav(page).filter({ hasText: "Agents" }).click();
        await expect(page.getByRole("heading", { name: "Agents", level: 1 })).toBeVisible();
        await expect(page.getByRole("button", { name: "Add agent" })).toHaveCount(0);

        await mainNav(page).filter({ hasText: "Canned responses" }).click();
        await expect(page.getByRole("heading", { name: "Billing - Refund Processed" })).toBeVisible();

        await openFirstTicket(page);
        await expect(page.getByRole("tab", { name: "Internal Note" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Insert canned response" })).toBeVisible();
    });
});

test.describe("admin journey", () => {
    test.use({ storageState: sessionFile("admin") });

    test("reaches every admin area and the ticket audit trail", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { name: `Welcome back, ${ACCOUNTS.admin.firstName}` })).toBeVisible();
        await expect(mainNav(page)).toHaveText(NAV_BY_ROLE.admin);

        await mainNav(page).filter({ hasText: "Agents" }).click();
        await expect(page.getByRole("button", { name: "Add agent" })).toBeVisible();

        await mainNav(page).filter({ hasText: "Analytics" }).click();
        await expect(page.getByText("Total tickets")).toBeVisible();

        await mainNav(page).filter({ hasText: "Settings" }).click();
        await expect(page.getByRole("heading", { name: "SLA response targets" })).toBeVisible();

        await openFirstTicket(page);
        await expect(page.getByText("Audit trail")).toBeVisible();
    });
});

test.describe("sign in and sign out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("a demo account signs in from the login screen and signs out", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: /Customer/ }).click();
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: `Welcome back, ${ACCOUNTS.customer.firstName}` })).toBeVisible();

        await page.getByRole("button", { name: "Sign out" }).click();
        await expect(page.getByLabel("Email")).toBeVisible();
    });
});
