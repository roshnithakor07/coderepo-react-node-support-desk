import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// Saved sessions and test output live under node_modules/.cache, which is already git-ignored.
export const ARTIFACTS_DIRECTORY = path.join(frontendDirectory, "node_modules/.cache/e2e");

export const SEEDED_PASSWORD = "SupportDesk@2026";

export const ACCOUNTS = {
    admin: { email: "admin1@supportdesk.io", firstName: "Ava" },
    agent: { email: "agent1@supportdesk.io", firstName: "Priya" },
    customer: { email: "customer1@supportdesk.io", firstName: "Grace" },
};

export function sessionFile(role) {
    return path.join(ARTIFACTS_DIRECTORY, "sessions", `${role}.json`);
}

export function readSavedToken(role) {
    try {
        const state = JSON.parse(fs.readFileSync(sessionFile(role), "utf8"));
        const origin = state.origins.find((entry) => entry.origin === "http://localhost:3000");
        return origin?.localStorage.find((item) => item.name === "support-desk-session-token")?.value || "";
    } catch {
        return "";
    }
}
