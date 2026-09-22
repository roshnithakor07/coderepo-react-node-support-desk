import { Router } from "express";
import { rateLimit } from "../../shared/middleware/rate-limit.js";
import { receiveEmail } from "./webhook.controller.js";

export const webhookRouter = Router();

const webhookRateLimit = rateLimit({ windowSeconds: 60, max: 30, keyPrefix: "webhook-email" });

webhookRouter.post("/email", webhookRateLimit, receiveEmail);
