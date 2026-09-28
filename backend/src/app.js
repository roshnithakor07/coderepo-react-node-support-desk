import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { getOptionalEnv } from "./shared/config/index.js";
import { isRedisReady } from "./shared/config/redis.js";
import { requireAuth } from "./shared/middleware/auth.js";
import { errorHandler, notFoundHandler } from "./shared/middleware/error-handler.js";
import { securityHeaders } from "./shared/middleware/security-headers.js";
import { authRouter } from "./features/auth/auth.routes.js";
import { ticketRouter } from "./features/tickets/ticket.routes.js";
import { agentRouter } from "./features/agents/agent.routes.js";
import { cannedResponseRouter } from "./features/canned-responses/canned-response.routes.js";
import { auditLogRouter } from "./features/audit-logs/audit-log.routes.js";
import { notificationRouter } from "./features/notifications/notification.routes.js";
import { analyticsRouter } from "./features/analytics/analytics.routes.js";
import { webhookRouter } from "./features/webhooks/webhook.routes.js";
import { settingsRouter } from "./features/settings/settings.routes.js";

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

export function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.use(securityHeaders);
    // Only listed origins may call the API from a browser. The frontend reaches it through the
    // Vite proxy (same origin), so this only matters for pages served from elsewhere.
    const allowedOrigins = getOptionalEnv("CORS_ORIGIN", "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.use(cors({ origin: allowedOrigins }));
    app.use(express.json({ limit: "100kb" }));
    app.use(express.static(publicDirectory));

    app.get("/api/v1/health", (request, response) => {
        // Without MongoDB the API cannot serve (503); without Redis it still serves, degraded.
        const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
        const redis = isRedisReady() ? "connected" : "disconnected";
        const status = database === "connected" && redis === "connected" ? "ok" : "degraded";
        response.status(database === "connected" ? 200 : 503).json({ data: { status, database, redis } });
    });

    app.use("/api/v1/auth", authRouter);
    app.use("/api/v1/webhooks", webhookRouter);
    app.use("/api/v1/tickets", requireAuth, ticketRouter);
    app.use("/api/v1/agents", requireAuth, agentRouter);
    app.use("/api/v1/canned-responses", requireAuth, cannedResponseRouter);
    app.use("/api/v1/audit-logs", requireAuth, auditLogRouter);
    app.use("/api/v1/notifications", requireAuth, notificationRouter);
    app.use("/api/v1/analytics", requireAuth, analyticsRouter);
    app.use("/api/v1/settings", requireAuth, settingsRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
