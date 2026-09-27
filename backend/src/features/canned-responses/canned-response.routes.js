import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { validateObjectIdParam } from "../../shared/middleware/validate-object-id.js";
import { createCannedResponse, deleteCannedResponse, listCannedResponses } from "./canned-response.controller.js";

export const cannedResponseRouter = Router();

cannedResponseRouter.param("responseId", validateObjectIdParam);

cannedResponseRouter.get("/", requireRole("admin", "agent"), listCannedResponses);
cannedResponseRouter.post("/", requireRole("admin", "agent"), createCannedResponse);
cannedResponseRouter.delete("/:responseId", requireRole("admin", "agent"), deleteCannedResponse);
