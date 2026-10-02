import { sessionFile } from "./support/sessions.js";
import { navigateTo } from "./support/navigation.js";
import { expect, test } from "./support/fixtures.js";

// Loading behaviour on every page: a same-shape skeleton instead of empty-state text or zeros,
// near-zero layout shift, dimmed data (not a skeleton) while reloading, one request per load,
// and no loader at all for fast responses.
test.use({ storageState: sessionFile("admin"), viewport: { width: 1280, height: 800 } });

const SLOW_MS = 700;
const MAX_CLS = 0.02;

// Installed before any page script runs. Records empty-state text (or zero stats) seen before the
// watched response arrives, whether a loader became visible, the layout shift, and the theme at first render.
async function installMonitor(page, phrases = []) {
    await page.addInitScript((watched) => {
        const monitor = { responded: true, early: [], loaderShown: false, cls: 0, firstRenderTheme: null };
        window.__loadMonitor = monitor;
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) monitor.cls += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        const check = () => {
            if (document.querySelector("[data-loader='visible']")) monitor.loaderShown = true;
            const root = document.getElementById("root");
            if (monitor.firstRenderTheme === null && root?.firstElementChild)
                monitor.firstRenderTheme = document.documentElement.dataset.theme || "none";
            if (monitor.responded || !document.body) return;
            const text = document.body.innerText;
            for (const phrase of watched) if (text.includes(phrase) && !monitor.early.includes(phrase)) monitor.early.push(phrase);
            const zero = [...document.querySelectorAll(".stat-value")].some((element) => element.textContent.trim() === "0");
            if (zero && !monitor.early.includes("0")) monitor.early.push("0");
        };
        new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    }, phrases);
}

// Starts watching: everything from now on counts, until a response matching `pattern` arrives.
async function watchNextLoad(page) {
    await page.evaluate(() => Object.assign(window.__loadMonitor, { responded: false, early: [], loaderShown: false, cls: 0 }));
}

async function delayResponses(page, pattern, delayMs = SLOW_MS) {
    await page.route(pattern, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await page.evaluate(() => window.__loadMonitor && (window.__loadMonitor.responded = true)).catch(() => {});
        await route.fulfill({ response });
    });
}

async function settledReport(page) {
    await page.waitForTimeout(400);
    return page.evaluate(() => ({ ...window.__loadMonitor }));
}

const TICKET_LIST = /\/api\/v1\/tickets\?/;
const TICKET_ONE = /\/api\/v1\/tickets\/[a-f0-9]{24}$/;

const PAGES = [
    { name: "Agents", pattern: /\/api\/v1\/agents$/, phrases: ["No agents yet"], ready: "table tbody tr.clickable, table tbody tr td" },
    {
        name: "Canned responses",
        pattern: /\/api\/v1\/canned-responses$/,
        phrases: ["No canned responses yet"],
        ready: ".canned-response-card",
    },
    {
        name: "Analytics",
        pattern: /\/api\/v1\/analytics(\?|$)/,
        phrases: ["No agent activity", "No data"],
        ready: ".chart-card .data-table",
    },
    { name: "Settings", pattern: /\/api\/v1\/settings$/, phrases: [], ready: ".sla-row input" },
];

test.describe("first load", () => {
    test("dashboard: a skeleton, never zeros or 'No tickets yet', and no layout shift", async ({ page }) => {
        await installMonitor(page, ["No tickets yet"]);
        await delayResponses(page, TICKET_LIST);
        await page.goto("/");
        await expect(page.locator(".dashboard-ticket-list li").first()).toBeVisible();
        const report = await settledReport(page);
        expect(report.early).toEqual([]);
        expect(report.loaderShown).toBe(true);
        expect(report.cls).toBeLessThan(MAX_CLS);
    });

    test("tickets: a skeleton with the table's shape, never 'No tickets yet', and no layout shift", async ({ page }) => {
        await installMonitor(page, ["No tickets yet", "No matching tickets"]);
        await delayResponses(page, TICKET_LIST);
        await page.goto("/");
        await navigateTo(page, "Tickets");
        await expect(page.locator("table tbody tr[data-skeleton]").first()).toBeVisible();
        const skeletonRow = await page.locator("table tbody tr[data-skeleton]").first().boundingBox();
        await expect(page.locator("table tbody tr.clickable").first()).toBeVisible();
        const realRow = await page.locator("table tbody tr.clickable").first().boundingBox();
        expect(Math.abs(realRow.height - skeletonRow.height)).toBeLessThanOrEqual(1);

        const report = await settledReport(page);
        expect(report.early).toEqual([]);
        expect(report.loaderShown).toBe(true);
        expect(report.cls).toBeLessThan(MAX_CLS);
        expect(await page.locator("table tbody").evaluate((element) => getComputedStyle(element).animationName)).toBe("fade-in");
    });

    test("ticket detail: a skeleton of the header, messages and properties, and no layout shift", async ({ page }) => {
        await installMonitor(page);
        await page.goto("/");
        await navigateTo(page, "Tickets");
        await expect(page.locator("table tbody tr.clickable").first()).toBeVisible();
        await delayResponses(page, TICKET_ONE);
        await watchNextLoad(page);
        await page.locator("table tbody tr.clickable").first().click();
        await expect(page.locator(".ticket-detail[data-skeleton] .properties-card")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Conversation" })).toBeVisible();
        await expect(page.locator(".message-card:not([data-skeleton])").first()).toBeVisible();
        const report = await settledReport(page);
        expect(report.loaderShown).toBe(true);
        expect(report.cls).toBeLessThan(MAX_CLS);
    });

    for (const view of PAGES) {
        test(`${view.name.toLowerCase()}: a skeleton, no early empty state, and no layout shift`, async ({ page }) => {
            await installMonitor(page, view.phrases);
            await page.goto("/");
            await expect(page.locator(".dashboard-ticket-list li").first()).toBeVisible();
            await delayResponses(page, view.pattern);
            await watchNextLoad(page);
            await navigateTo(page, view.name);
            await expect(page.locator(view.ready).first()).toBeVisible();
            const report = await settledReport(page);
            expect(report.early).toEqual([]);
            expect(report.loaderShown).toBe(true);
            expect(report.cls).toBeLessThan(MAX_CLS);
        });
    }

    test("notifications panel: skeleton items, never 'No notifications' before the first response", async ({ page }) => {
        await installMonitor(page, ["No notifications", "all caught up"]);
        await delayResponses(page, /\/api\/v1\/notifications$/, 1500);
        await page.goto("/");
        await page.locator(".notification-bell .icon-button").click();
        await expect(page.locator(".notification-panel [data-skeleton]").first()).toBeVisible();
        await expect(page.locator(".notification-item").first()).toBeVisible({ timeout: 5000 });
        const report = await settledReport(page);
        expect(report.early).toEqual([]);
    });

    test("boot: no login screen and no wrong theme before the session is checked", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await installMonitor(page, ["Create account"]);
        await page.addInitScript(() => (window.__loadMonitor.responded = false));
        await delayResponses(page, /\/api\/v1\/auth\/me$/);
        await page.goto("/");
        await expect(page.locator(".topbar")).toBeVisible();
        const report = await settledReport(page);
        expect(report.early).toEqual([]);
        expect(report.firstRenderTheme).toBe("light");
    });

    test("profile: no layout shift", async ({ page }) => {
        await installMonitor(page);
        await page.goto("/");
        await expect(page.locator(".dashboard-ticket-list li").first()).toBeVisible();
        await watchNextLoad(page);
        await page.locator(".topbar-profile-chip").click();
        await expect(page.getByLabel("Toggle light theme")).toBeVisible();
        expect((await settledReport(page)).cls).toBeLessThan(MAX_CLS);
    });
});

test.describe("reloading", () => {
    test("a filter change keeps the list visible, dimmed, with a progress bar and no skeleton", async ({ page }) => {
        await installMonitor(page);
        await page.goto("/");
        await navigateTo(page, "Tickets");
        const rows = page.locator("table tbody tr.clickable");
        await expect(rows.first()).toBeVisible();
        const before = await rows.count();

        await delayResponses(page, TICKET_LIST, 1200);
        await page.getByLabel("Filter by priority").selectOption("critical");
        const region = page.locator(".table-region");
        await expect(region).toHaveAttribute("aria-busy", "true");
        await expect(page.locator(".loading-bar")).toBeVisible();
        expect(await rows.count()).toBe(before);
        await expect(page.locator("table tbody tr[data-skeleton]")).toHaveCount(0);
        expect(Number(await region.evaluate((element) => getComputedStyle(element.querySelector("table")).opacity))).toBeLessThan(1);

        await expect(region).toHaveAttribute("aria-busy", "false");
        await expect(rows.first().locator(".priority-cell")).toHaveText("Critical");
    });

    test("analytics keeps its numbers visible while a new range loads", async ({ page }) => {
        await installMonitor(page);
        await page.goto("/");
        await navigateTo(page, "Analytics");
        const total = page.locator(".stat-tile", { hasText: "Total tickets" }).locator(".stat-value");
        await expect(total).toBeVisible();

        await delayResponses(page, /\/api\/v1\/analytics\?/, 1200);
        await page.getByRole("button", { name: "7D" }).click();
        await expect(page.locator(".loading-bar")).toBeVisible();
        await expect(total).toBeVisible();
        await expect(page.locator(".loading-bar")).toBeHidden({ timeout: 5000 });
    });

    test("returning to a page shows its data straight away and refreshes it quietly", async ({ page }) => {
        await installMonitor(page, ["No agents yet"]);
        await page.goto("/");
        await navigateTo(page, "Agents");
        await expect(page.locator("table tbody tr td").first()).toBeVisible();
        await navigateTo(page, "Dashboard");

        await delayResponses(page, /\/api\/v1\/agents$/, 1200);
        await watchNextLoad(page);
        await navigateTo(page, "Agents");
        await expect(page.locator("table tbody tr:not([data-skeleton]) td").first()).toBeVisible();
        await expect(page.locator("table tbody tr[data-skeleton]")).toHaveCount(0);
        expect((await settledReport(page)).early).toEqual([]);
    });
});

test.describe("requests and timing", () => {
    test("each load sends one request", async ({ page }) => {
        const counts = new Map();
        page.on("request", (request) => {
            const path = new URL(request.url()).pathname;
            if (path.startsWith("/api/v1/") && request.method() === "GET") counts.set(path, (counts.get(path) || 0) + 1);
        });
        await page.goto("/");
        await expect(page.locator(".dashboard-ticket-list li").first()).toBeVisible();
        await page.waitForTimeout(500);
        expect(counts.get("/api/v1/tickets")).toBe(1);
        expect(counts.get("/api/v1/auth/me")).toBe(1);
        expect(counts.get("/api/v1/notifications")).toBe(1);

        await navigateTo(page, "Tickets");
        await page.locator("table tbody tr.clickable").first().click();
        await expect(page.getByRole("heading", { name: "Conversation" })).toBeVisible();
        await page.waitForTimeout(500);
        const ticketPaths = [...counts.keys()].filter((path) => /^\/api\/v1\/tickets\/[a-f0-9]{24}$/.test(path));
        expect(ticketPaths.map((path) => counts.get(path))).toEqual([1]);
    });

    test("fast responses never show a loader", async ({ page }) => {
        await installMonitor(page);
        await page.goto("/");
        await expect(page.locator(".dashboard-ticket-list li").first()).toBeVisible();
        await delayResponses(page, /\/api\/v1\/agents$/, 50);
        await watchNextLoad(page);
        await navigateTo(page, "Agents");
        await expect(page.locator("table tbody tr:not([data-skeleton]) td").first()).toBeVisible();
        expect((await settledReport(page)).loaderShown).toBe(false);
    });
});
