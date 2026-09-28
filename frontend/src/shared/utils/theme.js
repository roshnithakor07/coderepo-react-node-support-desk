const STORAGE_KEY = "support-desk-theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

// The theme the user picked, or null while they have not picked one.
export function getSavedTheme() {
    try {
        const theme = localStorage.getItem(STORAGE_KEY);
        return theme === "light" || theme === "dark" ? theme : null;
    } catch {
        return null;
    }
}

export function getSystemTheme() {
    return window.matchMedia?.(LIGHT_QUERY).matches ? "light" : "dark";
}

// index.html runs the same logic before first paint, so the page never flashes the wrong theme.
export function getInitialTheme() {
    return getSavedTheme() || getSystemTheme();
}

export function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme) {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // ignore storage failures (private browsing, etc.)
    }
}

// Calls back when the system theme changes, unless the user has picked a theme.
export function onSystemThemeChange(callback) {
    const query = window.matchMedia?.(LIGHT_QUERY);
    if (!query) return () => {};
    const handleChange = (event) => {
        if (!getSavedTheme()) callback(event.matches ? "light" : "dark");
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
}
