const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";
let sessionToken = localStorage.getItem("support-desk-session-token") || "";

export function setSessionToken(token) {
    sessionToken = token || "";
    if (sessionToken) localStorage.setItem("support-desk-session-token", sessionToken);
    else localStorage.removeItem("support-desk-session-token");
}

export const hasSessionToken = () => Boolean(sessionToken);

export async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
            ...options.headers,
        },
    });

    if (response.status === 204) return null;

    const contentType = response.headers?.get?.("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
        const code = payload?.error?.code;
        const message = payload?.error?.message || `Service returned ${response.status}.`;
        if (response.status === 401 && ["AUTH_REQUIRED", "INVALID_TOKEN"].includes(code)) {
            setSessionToken("");
            window.dispatchEvent(new CustomEvent("support-desk-session-expired", { detail: message }));
        }
        // The status travels with the message, so a page can tell "not yours" (403) from "gone" (404).
        throw Object.assign(new Error(message), { status: response.status, code });
    }

    if (!payload || !("data" in payload)) throw new Error("Service returned an invalid response.");
    return payload.data;
}
