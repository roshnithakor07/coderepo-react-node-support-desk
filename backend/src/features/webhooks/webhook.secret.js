import crypto from "crypto";
import { getOptionalEnv } from "../../shared/config/index.js";
import { AppError } from "../../shared/errors/app-error.js";

function digest(value) {
    return crypto.createHash("sha256").update(value).digest();
}

// Inbound email is accepted only from a sender that knows the shared secret. Comparing digests
// keeps the check constant-time regardless of the length of what was sent.
export function requireWebhookSecret(request, response, next) {
    const expected = getOptionalEnv("WEBHOOK_SECRET", "");
    if (!expected) return next(new AppError(503, "WEBHOOK_DISABLED", "The inbound email webhook is not configured."));
    const provided = request.get("x-webhook-secret") || "";
    if (!crypto.timingSafeEqual(digest(provided), digest(expected))) {
        return next(new AppError(401, "INVALID_WEBHOOK_SECRET", "The webhook secret is missing or incorrect."));
    }
    next();
}
