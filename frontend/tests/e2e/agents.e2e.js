import { sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

const INACTIVE_AGENT = "Sofia Rossi";

test.use({ storageState: sessionFile("admin") });

function agentRow(page) {
    return page.locator("table tbody tr", { hasText: INACTIVE_AGENT });
}

test("an admin can reactivate an inactive agent and deactivate them again", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Agents" }).click();

    await expect(agentRow(page)).toContainText("Inactive");
    await agentRow(page).getByRole("button", { name: "Activate" }).click();
    await expect(agentRow(page)).toContainText("Active");
    await expect(agentRow(page).getByRole("button", { name: "Deactivate" })).toBeVisible();

    await agentRow(page).getByRole("button", { name: "Deactivate" }).click();
    await expect(agentRow(page)).toContainText("Inactive");
    await expect(agentRow(page).getByRole("button", { name: "Activate" })).toBeVisible();
});

test("the ticket assignee picker offers active agents only", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Tickets" }).click();
    await page.locator("table tbody tr").first().click();

    const options = page.locator("#ticket-assignee option:not([disabled])");
    await expect(options.first()).toBeAttached();
    await expect(options.filter({ hasText: INACTIVE_AGENT })).toHaveCount(0);
});
