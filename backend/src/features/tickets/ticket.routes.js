import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { validateObjectIdParam } from "../../shared/middleware/validate-object-id.js";
import {
    addReply,
    assignTicket,
    createTicket,
    getTicket,
    getTicketAudit,
    getTicketHistory,
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
// Open to every role: the service decides what each one may change, so a customer can close or
// reopen their own ticket without being able to touch its priority or anyone else's ticket.
ticketRouter.put("/:ticketId", updateTicket);
ticketRouter.post("/:ticketId/replies", addReply);
ticketRouter.post("/:ticketId/assign", requireRole("admin", "agent"), assignTicket);
// The status history is part of the ticket everyone who can see it gets; the full audit trail,
// which includes internal activity, stays with the admins.
ticketRouter.get("/:ticketId/history", getTicketHistory);
ticketRouter.get("/:ticketId/audit", requireRole("admin"), getTicketAudit);
