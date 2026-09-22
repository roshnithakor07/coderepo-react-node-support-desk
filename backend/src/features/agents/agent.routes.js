import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { createAgent, listAgents, updateAgentStatus } from "./agent.controller.js";

export const agentRouter = Router();

agentRouter.get("/", requireRole("admin", "agent"), listAgents);
agentRouter.post("/", requireRole("admin"), createAgent);
agentRouter.patch("/:agentId/status", requireRole("admin"), updateAgentStatus);
