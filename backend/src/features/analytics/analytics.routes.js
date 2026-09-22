import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { getDashboard } from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.get("/", requireRole("admin"), getDashboard);
