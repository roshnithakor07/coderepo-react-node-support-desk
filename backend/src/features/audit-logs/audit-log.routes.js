import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { listAuditLogs } from "./audit-log.controller.js";

export const auditLogRouter = Router();

auditLogRouter.get("/", requireRole("admin"), listAuditLogs);
