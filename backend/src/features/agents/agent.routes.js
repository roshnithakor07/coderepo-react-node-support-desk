import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { validateObjectIdParam } from "../../shared/middleware/validate-object-id.js";
import { createAgent, listAgents, previewDeactivation, updateAgentCategories, updateAgentStatus } from "./agent.controller.js";

export const agentRouter = Router();

agentRouter.param("agentId", validateObjectIdParam);

agentRouter.get("/", requireRole("admin", "agent"), listAgents);
agentRouter.post("/", requireRole("admin"), createAgent);
// What deactivating would do, so the confirmation can say so before anything is changed.
agentRouter.get("/:agentId/deactivation-preview", requireRole("admin"), previewDeactivation);
agentRouter.patch("/:agentId/status", requireRole("admin"), updateAgentStatus);
// Which categories an agent works is who can be given what, so only an admin sets it.
agentRouter.patch("/:agentId/categories", requireRole("admin"), updateAgentCategories);
