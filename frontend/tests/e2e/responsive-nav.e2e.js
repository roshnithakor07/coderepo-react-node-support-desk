import { sessionFile } from "./support/sessions.js";
import { navigateTo } from "./support/navigation.js";
import { expect, test } from "./support/fixtures.js";

const ADMIN_NAV = ["Dashboard", "Tickets", "Agents", "Canned responses", "Analytics", "Settings"];

test.use({ storageState: sessionFile("admin") });

// Every nav label must be rendered in full: inside its button, inside the viewport, and not clipped.
function navLabelProblems(page) {
    return page.getByRole("navigation", { name: "Main" }).evaluate((nav) => {
        const problems = [];
        const scrollbar = nav.scrollWidth > nav.clientWidth + 1;
        if (scrollbar) problems.push(`nav scrolls horizontally (${nav.scrollWidth} > ${nav.clientWidth})`);
        for (const button of nav.querySelectorAll("button")) {
            const label = button.innerText.trim().replace(/\s+/g, " ");
            const box = button.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(button);
            for (const rect of range.getClientRects()) {
                if (rect.width === 0) continue;
                const inside =
                    rect.left >= box.left - 0.5 &&
                    rect.right <= box.right + 0.5 &&
                    rect.top >= box.top - 0.5 &&
                    rect.bottom <= box.bottom + 0.5;
                const onScreen = rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
                if (!inside || !onScreen) problems.push(`"${label}" is cut off`);
            }
            for (const element of [button, ...button.querySelectorAll("*")]) {
                if (getComputedStyle(element).textOverflow === "ellipsis" && element.scrollWidth > element.clientWidth + 1) {
                    problems.push(`"${label}" is truncated`);
                }
            }
        }
        return [...new Set(problems)];
    });
}

for (const width of [600, 768, 1024]) {
    test.describe(`tablet ${width}px`, () => {
        test.use({ viewport: { width, height: 900 } });

        test("the navigation is a full-height labeled rail with no scrollbar and no cut-off labels", async ({ page }) => {
            await page.goto("/");
            const nav = page.getByRole("navigation", { name: "Main" }).getByRole("button");
            await expect(nav).toHaveText(ADMIN_NAV);
            expect(await navLabelProblems(page)).toEqual([]);

            const rail = await page.locator(".sidebar").boundingBox();
            expect({ left: rail.x, height: Math.round(rail.height) }).toEqual({ left: 0, height: 900 });
            expect(rail.width).toBeLessThanOrEqual(96);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
        });
    });
}

test.describe("phone 375px", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("the navigation lives in a menu drawer with full labels", async ({ page }) => {
        await page.goto("/");
        const menu = page.getByRole("button", { name: "Open menu" });
        await expect(menu).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        await menu.click();
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        const nav = page.getByRole("navigation", { name: "Main" }).getByRole("button");
        await expect(nav).toHaveText(ADMIN_NAV);
        expect(await navLabelProblems(page)).toEqual([]);

        await page.keyboard.press("Escape");
        await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
        await expect(menu).toBeFocused();

        await navigateTo(page, "Agents");
        await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
        await expect(page.getByRole("heading", { name: "Agents", level: 1 })).toBeVisible();
    });
});

test.describe("tickets page header and filters", () => {
    for (const viewport of [
        { width: 375, height: 812 },
        { width: 768, height: 900 },
        { width: 1280, height: 800 },
    ]) {
        test(`one page title, a compact header row and no lonely filter at ${viewport.width}px`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto("/");
            await navigateTo(page, "Tickets");
            await expect(page.locator("table tbody tr.clickable").first()).toBeVisible();

            await expect(page.getByRole("heading", { name: "Tickets" })).toHaveCount(1);
            await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();

            const count = page.getByText(/^\d+ total$/);
            const create = page.getByRole("button", { name: "New ticket" });
            const middle = async (locator) => {
                const box = await locator.boundingBox();
                return box.y + box.height / 2;
            };
            expect(Math.abs((await middle(count)) - (await middle(create)))).toBeLessThanOrEqual(4);

            const rows = await page.evaluate(() => {
                const controls = [...document.querySelectorAll(".ticket-filters input, .ticket-filters select")];
                const byRow = new Map();
                for (const control of controls) {
                    const top = Math.round(control.getBoundingClientRect().top);
                    byRow.set(top, [...(byRow.get(top) || []), control.tagName.toLowerCase()]);
                }
                return [...byRow.values()];
            });
            for (const row of rows) expect(row.length === 1 && row[0] === "select", `lonely select in ${JSON.stringify(rows)}`).toBe(false);
            if (viewport.width >= 768) expect(rows).toEqual([["input", "select", "select"]]);
        });
    }
});
