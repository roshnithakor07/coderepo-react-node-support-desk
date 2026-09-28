const STORAGE_KEY = "support-desk-sidebar-collapsed";

export function getStoredSidebarCollapsed() {
    try {
        return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

export function storeSidebarCollapsed(isCollapsed) {
    try {
        localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch {
        // ignore storage failures (private browsing, etc.)
    }
}
