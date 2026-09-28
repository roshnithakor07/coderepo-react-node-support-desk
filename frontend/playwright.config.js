import { defineConfig, devices } from "@playwright/test";
import { API_PORT, API_URL, APP_PORT, APP_URL, ARTIFACTS_DIRECTORY } from "./tests/e2e/support/sessions.js";

const BUILD_DIRECTORY = `${ARTIFACTS_DIRECTORY}/dist`;

// The suite starts its own API (database support_desk_e2e) and frontend on separate ports,
// so the development app on 3000/8000 keeps running and its data is never touched.
export default defineConfig({
    testDir: "tests/e2e",
    testMatch: "**/*.e2e.js",
    outputDir: `${ARTIFACTS_DIRECTORY}/results`,
    workers: 1,
    reporter: "list",
    use: {
        baseURL: APP_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "setup", testMatch: "**/auth.setup.js" },
        { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    ],
    webServer: [
        {
            command: "bun tests/e2e-server.js",
            cwd: "../backend",
            env: { E2E_API_PORT: String(API_PORT), CORS_ORIGIN: APP_URL },
            url: `${API_URL}/health`,
            reuseExistingServer: false,
            timeout: 120_000,
        },
        {
            // A production build: the dev server compiles modules on demand, and those page loads were
            // slow enough under load to time out tests intermittently.
            command: `bunx vite build --outDir ${BUILD_DIRECTORY} --emptyOutDir && bunx vite preview --outDir ${BUILD_DIRECTORY} --port ${APP_PORT} --strictPort`,
            env: { VITE_API_URL: API_URL },
            url: APP_URL,
            reuseExistingServer: false,
            timeout: 120_000,
        },
    ],
});
