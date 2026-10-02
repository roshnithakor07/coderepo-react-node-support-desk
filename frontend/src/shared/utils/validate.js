const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function isValidEmail(value) {
    return EMAIL_PATTERN.test(String(value || "").trim());
}

export function validateRequired(value, label) {
    if (!String(value ?? "").trim()) return `${label} is required.`;
    return "";
}

export function validateEmail(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "Email is required.";
    if (!isValidEmail(trimmed)) return "Please enter a valid email address.";
    return "";
}

export function validatePassword(value, minLength = 8) {
    if (!value) return "Password is required.";
    if (value.length < minLength) return `Password must be at least ${minLength} characters.`;
    return "";
}

export function validateMaxLength(value, max, label) {
    if (String(value || "").length > max) return `${label} must be ${max} characters or fewer.`;
    return "";
}

export function friendlyErrorMessage(error, fallback = "Something went wrong. Please try again.") {
    if (!error) return fallback;
    const message = typeof error === "string" ? error : error.message;
    if (!message) return fallback;
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return "Can't reach the server. Check your connection and try again.";
    }
    return message;
}
