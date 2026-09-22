import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { getSettings, updateSettings } from "./settings.controller.js";

export const settingsRouter = Router();

settingsRouter.get("/", getSettings);
settingsRouter.put("/", requireRole("admin"), updateSettings);
