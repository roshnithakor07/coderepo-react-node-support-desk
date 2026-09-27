import { test as base, expect } from "@playwright/test";

// Every e2e test fails if the browser logs an error, throws, or receives a 5xx response.
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
            await use(problems);
            expect(problems, "browser errors during the test").toEqual([]);
        },
        { auto: true },
    ],
});

export { expect };
