import { expect, test as setup } from "@playwright/test";
import { ACCOUNTS, API_URL, readSavedToken, SEEDED_PASSWORD, sessionFile } from "./support/sessions.js";

// Sign in once per role and save the session. A saved session that is still valid is reused,
// which keeps repeated runs under the login rate limit (10 per minute).
for (const [role, account] of Object.entries(ACCOUNTS)) {
    setup(`save ${role} session`, async ({ page, request }) => {
        const savedToken = readSavedToken(role);
        if (savedToken) {
            const response = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } });
            if (response.ok() && (await response.json()).data.email === account.email) return;
        }

        await page.goto("/");
        await page.getByLabel("Email").fill(account.email);
        await page.getByLabel("Password").fill(SEEDED_PASSWORD);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: `Welcome back, ${account.firstName}` })).toBeVisible();
        await page.context().storageState({ path: sessionFile(role) });
    });
}
