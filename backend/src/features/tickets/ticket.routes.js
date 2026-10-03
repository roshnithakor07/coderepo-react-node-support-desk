import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { validateObjectIdParam } from "../../shared/middleware/validate-object-id.js";
import {
    addReply,
    assignTicket,
    createTicket,
    getTicket,
    getTicketAudit,
    getTicketStats,
    listTickets,
    updateTicket,
} from "./ticket.controller.js";

export const ticketRouter = Router();

ticketRouter.param("ticketId", validateObjectIdParam);

ticketRouter.get("/", listTickets);
// Before "/:ticketId", so "stats" is not read as an id.
ticketRouter.get("/stats", getTicketStats);
// Customers raise tickets; agents and admins work them, so the button is theirs alone.
ticketRouter.post("/", requireRole("customer"), createTicket);
ticketRouter.get("/:ticketId", getTicket);
ticketRouter.put("/:ticketId", requireRole("admin", "agent"), updateTicket);
ticketRouter.post("/:ticketId/replies", addReply);
ticketRouter.post("/:ticketId/assign", requireRole("admin", "agent"), assignTicket);
ticketRouter.get("/:ticketId/audit", requireRole("admin"), getTicketAudit);
