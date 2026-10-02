import { ACCOUNTS, API_URL, ARTIFACTS_DIRECTORY, readSavedToken, sessionFile } from "./support/sessions.js";
import { navigateTo } from "./support/navigation.js";
import { expect, test } from "./support/fixtures.js";

// Review screenshots: the main pages in both themes on desktop and phone, plus the ticket detail
// page for each role. Skipped unless E2E_SCREENSHOTS=1.
test.skip(!process.env.E2E_SCREENSHOTS, "Set E2E_SCREENSHOTS=1 to capture review screenshots.");

const VIEWPORTS = [
    { width: 1920, height: 961 },
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
];

const PAGE_VIEWPORTS = [
    { width: 1280, height: 800 },
    { width: 375, height: 812 },
];

const PAGES = [
    { name: "dashboard", open: async () => {} },
    { name: "tickets", open: (page) => openView(page, "Tickets") },
    {
        name: "ticket-detail",
        open: async (page) => {
            await openView(page, "Tickets");
            await page.locator("table tbody tr", { hasText: ticketTitle }).first().click();
            await expect(page.getByText("That worked, thank you!")).toBeVisible();
        },
    },
    { name: "analytics", open: (page) => openView(page, "Analytics") },
    { name: "settings", open: (page) => openView(page, "Settings") },
];

function openView(page, name) {
    return navigateTo(page, name);
}

// Grows the viewport to the page's content so one image shows the whole page.
async function captureWholePage(page, viewport, file) {
    await page.waitForLoadState("networkidle");
    const contentHeight = await page.evaluate(() => {
        const content = document.querySelector(".app-content");
        return content ? content.getBoundingClientRect().top + content.scrollHeight : document.documentElement.scrollHeight;
    });
    await page.setViewportSize({ width: viewport.width, height: Math.min(Math.max(viewport.height, Math.ceil(contentHeight)), 4000) });
    await page.screenshot({ path: `${ARTIFACTS_DIRECTORY}/screenshots/${file}.png` });
}

let ticketTitle;

test.beforeAll(async ({ playwright }) => {
    const as = (role) =>
        playwright.request.newContext({ baseURL: `${API_URL}/`, extraHTTPHeaders: { Authorization: `Bearer ${readSavedToken(role)}` } });
    const [agentApi, customerApi] = await Promise.all([as("agent"), as("customer")]);

    const list = await (await agentApi.get("tickets?pageSize=100")).json();
    const ticket = list.data.tickets.find((entry) => entry.createdBy.email === ACCOUNTS.customer.email);
    ticketTitle = ticket.title;

    const thread = [
        [
            agentApi,
            "Thanks for reaching out, Grace. I can see two failed sign-in attempts from a new device this morning. Did you recently change your password?",
        ],
        [customerApi, "Yes, I changed it yesterday, but the new password isn't accepted on my laptop."],
        [
            agentApi,
            "The laptop still holds a session from before the password change. Clearing all sessions should fix it; escalate to identity if not.",
            true,
        ],
        [agentApi, "I've signed you out of all devices. Please sign in again with your new password and let me know how it goes."],
        [customerApi, "That worked, thank you!"],
    ];
    for (const [context, body, isInternal = false] of thread) {
        expect((await context.post(`tickets/${ticket._id}/replies`, { data: { body, isInternal } })).status()).toBe(201);
    }
    await Promise.all([agentApi.dispose(), customerApi.dispose()]);
});

for (const role of ["admin", "customer"]) {
    test.describe(`${role} view`, () => {
        test.use({ storageState: sessionFile(role) });

        for (const viewport of VIEWPORTS) {
            test(`ticket detail at ${viewport.width}px`, async ({ page }) => {
                await page.setViewportSize(viewport);
                await page.goto("/");
                await navigateTo(page, "Tickets");
                await page.locator("table tbody tr", { hasText: ticketTitle }).first().click();
                await expect(page.getByText("That worked, thank you!")).toBeVisible();
                await page.screenshot({ path: `${ARTIFACTS_DIRECTORY}/screenshots/ticket-detail-${role}-${viewport.width}.png` });
            });
        }
    });
}

for (const theme of ["dark", "light"]) {
    test.describe(`${theme} theme`, () => {
        test.use({ colorScheme: theme });

        for (const viewport of PAGE_VIEWPORTS) {
            test(`login at ${viewport.width}px`, async ({ page }) => {
                await page.setViewportSize(viewport);
                await page.goto("/");
                await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
                await captureWholePage(page, viewport, `login-${theme}-${viewport.width}`);
            });

            test.describe("signed in", () => {
                test.use({ storageState: sessionFile("admin") });

                for (const view of PAGES) {
                    test(`${view.name} at ${viewport.width}px`, async ({ page }) => {
                        await page.setViewportSize(viewport);
                        await page.goto("/");
                        await expect(page.locator(".topbar")).toBeVisible();
                        await view.open(page);
                        await captureWholePage(page, viewport, `${view.name}-${theme}-${viewport.width}`);
                    });
                }
            });
        }
    });
}
