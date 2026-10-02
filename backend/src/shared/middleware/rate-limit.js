import { AppError } from "../errors/app-error.js";

// Fixed-window counters per limiter and client IP, kept in this process.
const windows = new Map();

function countRequest(key, windowSeconds) {
    const now = Date.now();
    if (windows.size > 10_000) {
        for (const [storedKey, window] of windows) if (window.resetAt <= now) windows.delete(storedKey);
    }
    const window = windows.get(key);
    if (!window || window.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return 1;
    }
    window.count += 1;
    return window.count;
}

// Starts every window afresh; the API tests use it so one test file's requests don't count against another's.
export function clearRateLimits() {
    windows.clear();
}

export function rateLimit({ windowSeconds, max, keyPrefix }) {
    return (request, response, next) => {
        const identifier = request.ip || request.socket.remoteAddress || "unknown";
        if (countRequest(`${keyPrefix}:${identifier}`, windowSeconds) > max) {
            return next(new AppError(429, "RATE_LIMITED", "Too many requests. Please wait before trying again."));
        }
        next();
    };
}
