import { sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

const THEME_KEY = "support-desk-theme";

async function openView(page, name) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name }).click();
}

test.describe("theme", () => {
    test.use({ storageState: sessionFile("admin") });

    for (const colorScheme of ["light", "dark"]) {
        test(`follows the ${colorScheme} system setting until the user picks a theme`, async ({ page }) => {
            await page.emulateMedia({ colorScheme });
            await page.goto("/");
            await expect(page.locator(".topbar")).toBeVisible();
            await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
            expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(colorScheme);
            expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBeNull();
        });
    }

    test("the user's choice overrides the system setting and is remembered", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" });
        await page.goto("/");
        await page.locator(".topbar-profile-chip").click();
        await page.getByLabel("Toggle light theme").check();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

        await page.reload();
        await expect(page.locator(".topbar")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("light");
    });
});

test.describe("components", () => {
    test.use({ storageState: sessionFile("admin") });

    test("badges read in title case, and low priority is not shown as a success color", async ({ page }) => {
        await openView(page, "Tickets");
        const rows = page.locator("table tbody tr.clickable");
        await page.getByLabel("Filter by status").selectOption("in_progress");
        const badge = rows.first().locator(".badge");
        await expect(badge).toHaveText("In Progress");
        expect(await badge.innerText()).toBe("In Progress");

        await page.getByLabel("Filter by status").selectOption("");
        await page.getByLabel("Filter by priority").selectOption("low");
        await expect(rows.first().locator(".priority-cell")).toHaveText("Low");
        await rows.first().click();
        const priority = page.locator(".ticket-detail-chips .badge").nth(1);
        await expect(priority).toHaveText("Low");
        await expect(priority).toHaveClass(/badge-neutral/);
    });

    test("buttons, inputs and selects share one control height", async ({ page }) => {
        await openView(page, "Tickets");
        const heights = await page.evaluate(() =>
            [".panel-header .button-primary", ".search-input input", ".filter-bar select"].map((selector) =>
                Math.round(document.querySelector(selector).getBoundingClientRect().height),
            ),
        );
        expect(heights).toEqual([36, 36, 36]);
    });

    test("numeric table columns are right-aligned in tabular figures", async ({ page }) => {
        await openView(page, "Agents");
        const header = page.getByRole("columnheader", { name: /Open tickets/ });
        await expect(header).toBeVisible();
        const column = await header.evaluate((element) => element.cellIndex);
        const cell = page.locator("table tbody tr").first().locator("td").nth(column);
        expect(await cell.evaluate((element) => getComputedStyle(element).textAlign)).toBe("right");
        expect(await cell.evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toBe("tabular-nums");
        expect(await header.evaluate((element) => getComputedStyle(element).textAlign)).toBe("right");
    });

    test("stat values and table dates use the interface font, not monospace", async ({ page }) => {
        await page.goto("/");
        const statFont = await page
            .locator(".stat-value")
            .first()
            .evaluate((element) => getComputedStyle(element).fontFamily);
        expect(statFont).toContain("Roboto");

        await openView(page, "Tickets");
        // Loaded rows only: the loading skeleton rows are replaced as the data arrives.
        const dateCell = page.locator("table tbody tr.clickable").first().locator("td").last().locator("span");
        await expect(dateCell).toBeVisible();
        expect(await dateCell.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Roboto");
    });
});

test.describe("keyboard and motion", () => {
    test.use({ storageState: sessionFile("admin") });

    test("keyboard focus shows a 2px ring in the focus color on buttons and table rows", async ({ page }) => {
        await openView(page, "Tickets");
        await expect(page.locator("table tbody tr.clickable").first()).toBeVisible();
        const expected = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--focus-ring").trim());

        const ring = (locator) =>
            locator.evaluate((element) => {
                const style = getComputedStyle(element);
                return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
            });
        const toRgb = (hex) => {
            const value = parseInt(hex.slice(1), 16);
            return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
        };

        await page.locator(".panel-header .button-primary").focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        expect(await ring(page.locator(".panel-header .button-primary"))).toEqual({ style: "solid", width: "2px", color: toRgb(expected) });

        const row = page.locator("table tbody tr.clickable").first();
        await row.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        expect(await ring(row)).toEqual({ style: "solid", width: "2px", color: toRgb(expected) });
    });

    test("dialogs animate in, and not at all when reduced motion is requested", async ({ page }) => {
        await openView(page, "Agents");
        await page.getByRole("button", { name: "Add agent" }).first().click();
        const duration = () => page.locator("dialog.modal").evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
        const seconds = await duration();
        expect(seconds).toBeGreaterThanOrEqual(0.15);
        expect(seconds).toBeLessThanOrEqual(0.2);

        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Add agent" }).first().click();
        expect(await duration()).toBeLessThan(0.01);
    });
});

// Resolves a color token to the rgb() string the browser computes for it.
function tokenColor(page, token) {
    return page.evaluate((name) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
    }, token);
}

test.describe("dashboard", () => {
    test.use({ storageState: sessionFile("admin") });

    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(page.locator(".dashboard-ticket-list li").first()).toBeVisible();
    });

    test("has no cards inside cards", async ({ page }) => {
        const nested = await page.evaluate(() => {
            const isCard = (element) => {
                const style = getComputedStyle(element);
                return (
                    parseFloat(style.borderTopWidth) > 0 &&
                    parseFloat(style.borderLeftWidth) > 0 &&
                    style.backgroundColor !== "rgba(0, 0, 0, 0)"
                );
            };
            const content = document.querySelector(".app-content");
            const cards = [...content.querySelectorAll("*")].filter(isCard);
            return cards
                .filter((card) => {
                    for (let parent = card.parentElement; parent && parent !== content; parent = parent.parentElement)
                        if (isCard(parent)) return true;
                    return false;
                })
                .map((card) => card.className);
        });
        expect(nested).toEqual([]);
    });

    test("recent tickets are one list separated by thin dividers", async ({ page }) => {
        const rows = await page.locator(".dashboard-ticket-list li > button").evaluateAll((buttons) =>
            buttons.map((button) => {
                const style = getComputedStyle(button.parentElement);
                const own = getComputedStyle(button);
                return { sides: [own.borderTopWidth, own.borderLeftWidth, own.borderRightWidth], divider: style.borderBottomWidth };
            }),
        );
        expect(rows.length).toBeGreaterThan(1);
        for (const row of rows.slice(0, -1)) expect(row).toEqual({ sides: ["0px", "0px", "0px"], divider: "1px" });
    });

    test("stat cards are neutral, each has an icon, and a breach shows only in the number and icon", async ({ page }) => {
        const cards = page.locator(".stat-tile");
        // SLA compliance appears only once analytics has loaded, so the check covers the cards present.
        expect(await cards.count()).toBeGreaterThanOrEqual(3);
        const looks = await cards.evaluateAll((elements) =>
            elements.map((element) => {
                const style = getComputedStyle(element);
                return {
                    background: style.backgroundColor,
                    border: style.borderTopColor,
                    hasIcon: Boolean(element.querySelector(".stat-tile-icon svg")),
                };
            }),
        );
        for (const look of looks) expect(look).toEqual({ ...looks[0], hasIcon: true });

        const breached = cards.filter({ hasText: "SLA breached" });
        const count = Number(await breached.locator(".stat-value").innerText());
        expect(count).toBeGreaterThan(0);
        const danger = await tokenColor(page, "--danger-ink");
        expect(await breached.locator(".stat-value").evaluate((element) => getComputedStyle(element).color)).toBe(danger);
        expect(await breached.locator(".stat-tile-icon").evaluate((element) => getComputedStyle(element).color)).toBe(danger);
        const open = cards.filter({ hasText: "Open" });
        expect(await open.locator(".stat-value").evaluate((element) => getComputedStyle(element).color)).toBe(
            await tokenColor(page, "--ink"),
        );
    });

    test("badges are title case and hug their text", async ({ page }) => {
        const badges = await page.locator(".dashboard-ticket-list .badge").evaluateAll((elements) =>
            elements.map((element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return {
                    text: element.innerText,
                    width: element.getBoundingClientRect().width,
                    textWidth: range.getBoundingClientRect().width,
                };
            }),
        );
        expect(badges.length).toBeGreaterThan(0);
        for (const badge of badges) {
            expect(badge.text).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/);
            expect(badge.width - badge.textWidth).toBeLessThanOrEqual(18);
        }
    });

    test("SLA time is colored only when urgent, on the dashboard and the ticket list", async ({ page }) => {
        const [danger, warning, muted] = await Promise.all(
            ["--danger-ink", "--warning-ink", "--muted"].map((token) => tokenColor(page, token)),
        );
        const expectedColor = (text) => (text === "SLA breached" ? danger : /^\d+m left$/.test(text) ? warning : muted);
        const check = async (selector) => {
            const entries = await page
                .locator(selector)
                .evaluateAll((elements) =>
                    elements.map((element) => ({ text: element.innerText, color: getComputedStyle(element).color })),
                );
            expect(entries.length).toBeGreaterThan(0);
            for (const entry of entries) expect(entry, entry.text).toEqual({ text: entry.text, color: expectedColor(entry.text) });
            return entries;
        };

        await check(".dashboard-ticket-list .sla-text");
        await openView(page, "Tickets");
        await expect(page.locator("table tbody tr.clickable").first()).toBeVisible();
        const entries = await check("table .sla-text");
        expect(entries.some((entry) => entry.color === muted)).toBe(true);
    });
});

test.describe("brand", () => {
    test.use({ storageState: sessionFile("admin") });

    test("the logo mark and favicon use the teal accent", async ({ page, request }) => {
        await page.goto("/");
        const mark = page.locator(".sidebar-brand .logo-mark");
        await expect(mark).toBeVisible();
        const tile = await mark.locator(".logo-mark-tile").evaluate((element) => getComputedStyle(element).fill);
        expect(tile).toBe(await tokenColor(page, "--accent"));

        const favicon = await (await request.get("/favicon.svg")).text();
        expect(favicon).toContain("#0f766e");
        expect(favicon).not.toContain("#4f7cff");
    });
});
