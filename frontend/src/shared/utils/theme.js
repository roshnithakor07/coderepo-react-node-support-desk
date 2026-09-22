const STORAGE_KEY = "support-desk-theme";

export function getStoredTheme() {
    try {
        return localStorage.getItem(STORAGE_KEY) || "dark";
    } catch {
        return "dark";
    }
}

export function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // ignore storage failures (private browsing, etc.)
    }
}
