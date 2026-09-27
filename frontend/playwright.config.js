import { defineConfig, devices } from "@playwright/test";
import { ARTIFACTS_DIRECTORY } from "./tests/e2e/support/sessions.js";

// Ports are fixed (3000/8000), so a running `bun start` is reused; otherwise Playwright starts it.
export default defineConfig({
    testDir: "tests/e2e",
    testMatch: "**/*.e2e.js",
    outputDir: `${ARTIFACTS_DIRECTORY}/results`,
    workers: 1,
    reporter: "list",
    use: {
        baseURL: "http://localhost:3000",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "setup", testMatch: "**/auth.setup.js" },
        { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    ],
    webServer: {
        command: "bun start",
        cwd: "..",
        url: "http://localhost:3000/api/v1/health",
        reuseExistingServer: true,
        timeout: 180_000,
    },
});
