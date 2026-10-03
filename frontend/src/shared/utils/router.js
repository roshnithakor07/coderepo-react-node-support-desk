import { useEffect, useMemo, useState } from "react";

// Hash routing on the browser's own hashchange event, with no router package: every page has a real
// URL that survives a refresh, moves with Back and Forward, and opens in a new tab.

export function parseHash(hash) {
    const raw = hash.replace(/^#/, "");
    const queryStart = raw.indexOf("?");
    const pathPart = queryStart === -1 ? raw : raw.slice(0, queryStart);
    const rawSearch = queryStart === -1 ? "" : raw.slice(queryStart + 1);
    // Normalized so two spellings of the same URL compare equal ("#tickets/" and "#/tickets").
    const path = `/${pathPart.split("/").filter(Boolean).join("/")}`;
    return { path, search: new URLSearchParams(rawSearch).toString() };
}

// Empty values are left out, so a cleared filter disappears from the URL instead of lingering as "status=".
export function toHash(path, query) {
    const entries =
        typeof query === "string" ? query : Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== "");
    const search = new URLSearchParams(entries).toString();
    return `#${path}${search ? `?${search}` : ""}`;
}

// Replacing swaps the current history entry instead of adding one, for redirects and for typing in a
// search box, so Back does not step through every keystroke.
export function navigate(href, { replace = false } = {}) {
    if (href === window.location.hash) return;
    if (replace) {
        window.history.replaceState(window.history.state, "", href);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
        window.location.hash = href;
    }
}

export function useHashRoute() {
    const [hash, setHash] = useState(() => window.location.hash);

    useEffect(() => {
        const update = () => setHash(window.location.hash);
        window.addEventListener("hashchange", update);
        return () => window.removeEventListener("hashchange", update);
    }, []);

    return useMemo(() => parseHash(hash), [hash]);
}
