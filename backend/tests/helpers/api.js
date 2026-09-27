export const SEEDED_PASSWORD = "SupportDesk@2026";

export const SEEDED_ACCOUNTS = {
    admin: "admin1@supportdesk.io",
    agent: "agent1@supportdesk.io",
    customer: "customer1@supportdesk.io",
    inactiveAgent: "agent5@supportdesk.io",
};

export async function api(path, { method = "GET", token, body } = {}) {
    const response = await fetch(`${process.env.TEST_API_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const contentType = response.headers.get("content-type") || "";
    return { status: response.status, body: contentType.includes("application/json") ? await response.json() : null };
}

export function login(email, password = SEEDED_PASSWORD) {
    return api("/auth/login", { method: "POST", body: { email, password } });
}

// Login is rate limited (10 per minute per IP), so each role signs in once per test run.
const sessions = new Map();

export async function loginAs(role) {
    if (!sessions.has(role)) {
        const email = SEEDED_ACCOUNTS[role];
        if (!email) throw new Error(`Unknown seeded role "${role}".`);
        const { status, body } = await login(email);
        if (status !== 200) throw new Error(`Sign-in as ${role} failed with ${status}: ${JSON.stringify(body)}`);
        sessions.set(role, body.data);
    }
    return sessions.get(role);
}
