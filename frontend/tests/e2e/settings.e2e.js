import { sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

test.use({ storageState: sessionFile("admin") });

async function openSettings(page) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "SLA response targets" })).toBeVisible();
}

test("invalid SLA hours show inline errors and are not saved", async ({ page }) => {
    await openSettings(page);
    const critical = page.locator("#sla-critical");
    const save = page.getByRole("button", { name: "Save settings" });

    await critical.fill("1.5");
    await save.click();
    await expect(page.locator("#sla-critical-error")).toHaveText("Use whole hours.");

    await critical.fill("721");
    await save.click();
    await expect(page.locator("#sla-critical-error")).toHaveText("Must be 720 hours (30 days) or less.");

    // Reloading returns to the dashboard (there is no URL routing yet), so open Settings again.
    await openSettings(page);
    await expect(page.locator("#sla-critical")).toHaveValue("1");
});

test("a valid SLA change is saved and kept after reloading", async ({ page }) => {
    await openSettings(page);
    await page.locator("#sla-low").fill("12");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    await page.reload();
    await openSettings(page);
    await expect(page.locator("#sla-low")).toHaveValue("12");
    await expect(page.locator("#sla-high")).toHaveValue("4");

    await page.locator("#sla-low").fill("24");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
});
