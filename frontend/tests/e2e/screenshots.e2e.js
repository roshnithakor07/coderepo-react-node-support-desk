import { ACCOUNTS, API_URL, ARTIFACTS_DIRECTORY, readSavedToken, sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

// Review screenshots of the ticket detail page. Skipped unless E2E_SCREENSHOTS=1.
test.skip(!process.env.E2E_SCREENSHOTS, "Set E2E_SCREENSHOTS=1 to capture review screenshots.");

const VIEWPORTS = [
    { width: 1920, height: 961 },
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
];

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
                await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Tickets" }).click();
                await page.locator("table tbody tr", { hasText: ticketTitle }).first().click();
                await expect(page.getByText("That worked, thank you!")).toBeVisible();
                await page.screenshot({ path: `${ARTIFACTS_DIRECTORY}/screenshots/ticket-detail-${role}-${viewport.width}.png` });
            });
        }
    });
}
