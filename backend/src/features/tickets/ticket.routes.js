import { Router } from "express";
import { requireRole } from "../../shared/middleware/rbac.js";
import { validateObjectIdParam } from "../../shared/middleware/validate-object-id.js";
import {
    addReply,
    assignTicket,
    bulkAssign,
    bulkPriority,
    bulkStatus,
    createTicket,
    deleteReply,
    getTicket,
    getTicketAudit,
    getTicketHistory,
    getMergeCandidates,
    getTicketStats,
    listReplies,
    listTickets,
    mergeTicket,
    updateReply,
    updateTicket,
} from "./ticket.controller.js";

export const ticketRouter = Router();

ticketRouter.param("ticketId", validateObjectIdParam);
ticketRouter.param("replyId", validateObjectIdParam);

ticketRouter.get("/", listTickets);
// Before "/:ticketId", so "stats" is not read as an id.
ticketRouter.get("/stats", getTicketStats);
// Customers raise tickets; agents and admins work them, so the button is theirs alone.
ticketRouter.post("/", requireRole("customer"), createTicket);
// Acting on several tickets at once belongs to the support team, and is registered before
// "/:ticketId" so "bulk" is never read as an id.
ticketRouter.post("/bulk/assign", requireRole("admin", "agent"), bulkAssign);
ticketRouter.post("/bulk/status", requireRole("admin", "agent"), bulkStatus);
ticketRouter.post("/bulk/priority", requireRole("admin", "agent"), bulkPriority);
ticketRouter.get("/:ticketId", getTicket);
// Open to every role: the service decides what each one may change, so a customer can close or
// reopen their own ticket without being able to touch its priority or anyone else's ticket.
ticketRouter.put("/:ticketId", updateTicket);
ticketRouter.post("/:ticketId/replies", addReply);
// The ticket itself carries the latest page of its conversation; this is how the page walks back
// through the older ones, under the same view rules as the ticket.
ticketRouter.get("/:ticketId/replies", listReplies);
// Only internal notes can be changed after the fact, and only by their author or an admin inside the
// edit window, so these two belong to the support team alone.
ticketRouter.put("/:ticketId/replies/:replyId", requireRole("admin", "agent"), updateReply);
ticketRouter.delete("/:ticketId/replies/:replyId", requireRole("admin", "agent"), deleteReply);
ticketRouter.post("/:ticketId/assign", requireRole("admin", "agent"), assignTicket);
// Folding a duplicate into another ticket is the support team's call, made from the ticket page.
ticketRouter.get("/:ticketId/merge-candidates", requireRole("admin", "agent"), getMergeCandidates);
ticketRouter.post("/:ticketId/merge", requireRole("admin", "agent"), mergeTicket);
// The status history is part of the ticket everyone who can see it gets; the full audit trail,
// which includes internal activity, stays with the admins.
ticketRouter.get("/:ticketId/history", getTicketHistory);
ticketRouter.get("/:ticketId/audit", requireRole("admin"), getTicketAudit);
