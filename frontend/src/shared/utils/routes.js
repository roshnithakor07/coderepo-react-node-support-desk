// Every page in the app, the URL it lives at and who may open it. The sidebar reads its role rules
// from here too, so a page can never be linked for a role the route itself turns away.
const EVERYONE = ["admin", "agent", "customer"];
const STAFF = ["admin", "agent"];
const ADMIN = ["admin"];

export const HOME_PATH = "/dashboard";
export const SIGN_IN_PATH = "/sign-in";

export const ROUTES = [
    { view: "dashboard", path: "/dashboard", title: "Dashboard", roles: EVERYONE },
    { view: "tickets", path: "/tickets", title: "Tickets", roles: EVERYONE },
    { view: "ticket-detail", path: "/tickets/:ticketId", title: "Ticket", roles: EVERYONE },
    { view: "agents", path: "/agents", title: "Agents", roles: STAFF },
    { view: "canned-responses", path: "/canned-responses", title: "Canned Responses", roles: STAFF },
    { view: "analytics", path: "/analytics", title: "Analytics", roles: ADMIN },
    { view: "activity", path: "/activity", title: "Activity", roles: ADMIN },
    { view: "settings", path: "/settings", title: "Settings", roles: ADMIN },
    { view: "profile", path: "/profile", title: "Profile", roles: EVERYONE },
];

export function matchRoute(path) {
    const segments = path.split("/").filter(Boolean);
    for (const route of ROUTES) {
        const parts = route.path.split("/").filter(Boolean);
        if (parts.length !== segments.length) continue;
        const params = {};
        const matches = parts.every((part, index) => {
            if (part.startsWith(":")) {
                params[part.slice(1)] = segments[index];
                return true;
            }
            return part === segments[index];
        });
        if (matches) return { route, params };
    }
    return null;
}

export function routeForView(view) {
    return ROUTES.find((route) => route.view === view);
}

export function canOpen(route, role) {
    return route.roles.includes(role);
}

export function ticketPath(ticketId) {
    return `/tickets/${ticketId}`;
}

// Where to go after signing in. Only an in-app path is accepted, and never the sign-in page itself.
export function safeReturnPath(value) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return HOME_PATH;
    if (value === "/" || value.split("?")[0] === SIGN_IN_PATH) return HOME_PATH;
    return value;
}
