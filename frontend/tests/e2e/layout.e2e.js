import { ARTIFACTS_DIRECTORY, sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

test.use({ storageState: sessionFile("admin") });

async function openFirstTicketWithLongConversation(page) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Tickets" }).click();
    await page.locator("table tbody tr").first().click();
    await expect(page.locator(".ticket-detail")).toBeVisible();
    // Simulate a long conversation in the page, without writing test data.
    await page.evaluate(() => {
        const card = document.querySelector(".message-card");
        for (let index = 0; index < 14; index += 1) card.parentElement.appendChild(card.cloneNode(true));
    });
}

function layoutMetrics(page) {
    return page.evaluate(() => {
        const scrollAreas = [...document.querySelectorAll("*")]
            .filter(
                (element) =>
                    ["auto", "scroll"].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1,
            )
            .map((element) => element.className || element.tagName);
        const shell = document.querySelector(".app-shell").getBoundingClientRect();
        return {
            viewportHeight: window.innerHeight,
            documentScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
            shellHeight: Math.round(shell.height),
            scrollAreas,
        };
    });
}

function inViewport(page, selector) {
    return page.locator(selector).evaluate((element) => {
        const box = element.getBoundingClientRect();
        const topbar = document.querySelector(".topbar").getBoundingClientRect();
        return box.top >= topbar.bottom - 1 && box.bottom <= window.innerHeight + 1 && box.height > 0;
    });
}

test.describe("desktop 1920x961", () => {
    test.use({ viewport: { width: 1920, height: 961 } });

    test("the shell fills the viewport and only the main content scrolls", async ({ page }) => {
        await openFirstTicketWithLongConversation(page);
        const metrics = await layoutMetrics(page);
        expect(metrics.shellHeight).toBe(metrics.viewportHeight);
        expect(metrics.documentScrolls).toBe(false);
        expect(metrics.scrollAreas).toEqual(["app-content"]);
        expect(Math.round((await page.locator(".sidebar").boundingBox()).height)).toBe(961);
    });

    test("the ticket side column and reply box stay visible while the conversation scrolls", async ({ page }) => {
        await openFirstTicketWithLongConversation(page);
        expect(await inViewport(page, "#reply-body")).toBe(true);

        await page.locator(".app-content").evaluate((element) => element.scrollTo(0, element.scrollHeight / 2));
        expect(await inViewport(page, ".ticket-detail-sidebar")).toBe(true);
        expect(await inViewport(page, "#reply-body")).toBe(true);
        await page.screenshot({ path: `${ARTIFACTS_DIRECTORY}/screenshots/ticket-detail-1920.png` });
    });

    test("the top bar shows the ticket number and title, and categories are title case", async ({ page }) => {
        await openFirstTicketWithLongConversation(page);
        const title = await page.locator(".ticket-detail-header h2").textContent();
        await expect(page.locator(".topbar-title")).toHaveText(
            new RegExp(`^#[0-9a-f]{6} · ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
        );
        await expect(page.locator(".ticket-info-row", { hasText: "Category" }).locator(".ticket-info-value")).toHaveText(/^[A-Z][a-z]+$/);
    });

    test("the sidebar is 240px and collapses to a remembered icon rail with tooltips", async ({ page }) => {
        const sidebarWidth = async () => Math.round((await page.locator(".sidebar").boundingBox()).width);
        await page.goto("/");
        await expect.poll(sidebarWidth).toBe(240);

        await page.getByRole("button", { name: "Collapse sidebar" }).click();
        await expect.poll(sidebarWidth).toBe(72);
        await expect(page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Tickets" })).toHaveAttribute(
            "title",
            "Tickets",
        );

        await page.reload();
        await expect.poll(sidebarWidth).toBe(72);
        await page.getByRole("button", { name: "Expand sidebar" }).click();
        await expect.poll(sidebarWidth).toBe(240);
    });

    test("analytics explains that dates are in UTC", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Analytics" }).click();
        await expect(page.getByText("Dates in UTC")).toBeVisible();
    });
});

test.describe("mobile 375x812", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("the shell fills the viewport with a single scroll area, and the reply box is one tap away", async ({ page }) => {
        await openFirstTicketWithLongConversation(page);
        const metrics = await layoutMetrics(page);
        expect(metrics.shellHeight).toBe(metrics.viewportHeight);
        expect(metrics.documentScrolls).toBe(false);
        expect(metrics.scrollAreas).toEqual(["app-content"]);

        await page.getByRole("button", { name: "Jump to reply" }).click();
        await expect(page.locator("#reply-body")).toBeFocused();
        expect(await inViewport(page, "#reply-body")).toBe(true);
        await page.screenshot({ path: `${ARTIFACTS_DIRECTORY}/screenshots/ticket-detail-375.png` });
    });
});
