import { Router } from "express";
import { rateLimit } from "../../shared/middleware/rate-limit.js";
import { receiveEmail } from "./webhook.controller.js";
import { requireWebhookSecret } from "./webhook.secret.js";

export const webhookRouter = Router();

const webhookRateLimit = rateLimit({ windowSeconds: 60, max: 30, keyPrefix: "webhook-email" });

// The rate limit runs first so the shared secret cannot be guessed quickly.
webhookRouter.post("/email", webhookRateLimit, requireWebhookSecret, receiveEmail);
