import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { addReply, assignTicket, createTicket, getTicket, getTicketAudit, listTickets, updateTicket } from "./ticket.controller.js";

export const ticketRouter = Router();

ticketRouter.get("/", listTickets);
ticketRouter.post("/", createTicket);
ticketRouter.get("/:ticketId", getTicket);
ticketRouter.put("/:ticketId", requireRole("admin", "agent"), updateTicket);
ticketRouter.post("/:ticketId/replies", addReply);
ticketRouter.post("/:ticketId/assign", requireRole("admin", "agent"), assignTicket);
ticketRouter.get("/:ticketId/audit", requireRole("admin"), getTicketAudit);
