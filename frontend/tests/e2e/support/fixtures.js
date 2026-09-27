import { test as base, expect } from "@playwright/test";

// Every e2e test fails if the browser logs an error, throws, receives a 5xx response,
// or calls the development app instead of the isolated e2e app.
export const test = base.extend({
    browserProblems: [
        async ({ page }, use) => {
            const problems = [];
            page.on("console", (message) => {
                if (message.type() === "error") problems.push(`console: ${message.text()}`);
            });
            page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
            page.on("response", (response) => {
                if (response.status() >= 500) problems.push(`HTTP ${response.status()} ${response.url()}`);
            });
            page.on("request", (request) => {
                if (/\/\/(localhost|127\.0\.0\.1):(3000|8000)\//.test(request.url()))
                    problems.push(`request to the development app: ${request.url()}`);
            });
            await use(problems);
            expect(problems, "browser errors during the test").toEqual([]);
        },
        { auto: true },
    ],
});

export { expect };
