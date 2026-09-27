import { readSavedToken, sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

test.use({ storageState: sessionFile("admin") });

test.beforeAll(async ({ playwright }) => {
    // A ticket created now guarantees today has data, whatever time the suite runs.
    const customerApi = await playwright.request.newContext({
        baseURL: "http://localhost:3000",
        extraHTTPHeaders: { Authorization: `Bearer ${readSavedToken("customer")}` },
    });
    const response = await customerApi.post("/api/v1/tickets", {
        data: { title: `Analytics range check (${Date.now()})`, description: "Created by the e2e suite.", priority: "low" },
    });
    expect(response.status()).toBe(201);
    await customerApi.dispose();
});

function totalTickets(page) {
    return page.locator(".stat-tile", { hasText: "Total tickets" }).locator(".stat-value");
}

test("the 7-day preset counts today's tickets, matching all time", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Analytics" }).click();

    await expect(totalTickets(page)).toHaveText(/\d+/);
    const allTime = await totalTickets(page).textContent();

    await page.getByRole("button", { name: "7D", exact: true }).click();
    await expect(page.getByRole("button", { name: "7D", exact: true })).toHaveClass(/active/);
    await expect(totalTickets(page)).toHaveText(allTime);
});
