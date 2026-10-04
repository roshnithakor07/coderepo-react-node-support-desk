import { z } from "zod";
import { REPLY_PAGE_SIZE } from "./ticket-replies.js";
import { TICKET_SORT_KEYS, ticketService } from "./ticket.service.js";

const createSchema = z
    .object({
        title: z.string().trim().min(1).max(140),
        description: z.string().trim().min(1).max(5000),
        priority: z.enum(["low", "medium", "high", "critical"]),
        category: z.string().trim().max(60).optional(),
        tags: z.array(z.string().trim().max(30)).max(10).optional(),
    })
    .strict();

const updateSchema = z
    .object({
        title: z.string().trim().min(1).max(140).optional(),
        description: z.string().trim().min(1).max(5000).optional(),
        status: z.enum(["open", "in_progress", "pending", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        category: z.string().trim().max(60).optional(),
        tags: z.array(z.string().trim().max(30)).max(10).optional(),
    })
    .strict();

const replySchema = z
    .object({
        body: z.string().trim().min(1).max(5000),
        isInternal: z.boolean().optional(),
    })
    .strict();

// Paging back through a long conversation: `before` is the reply the page stops at (the latest page
// when it is left out), and a page is at most REPLY_PAGE_SIZE replies.
const replyPageQuerySchema = z
    .object({
        before: z
            .string()
            .regex(/^[a-f\d]{24}$/i, "That message id is not valid.")
            .optional(),
        limit: z.coerce.number().int().min(1).max(REPLY_PAGE_SIZE).optional(),
    })
    .strict();

const assignSchema = z.object({ agentId: z.string().regex(/^[a-f\d]{24}$/i, "Select a valid agent.") }).strict();

// The ids are checked here for shape only; whether each ticket exists, may be seen and may take the
// action is the service's job, so one bad id is reported with the rest instead of failing the request.
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "One of the selected tickets has an invalid id.");
const ticketIds = z.array(objectId).min(1, "Select at least one ticket.");

const bulkAssignSchema = z.object({ ticketIds, agentId: z.string().regex(/^[a-f\d]{24}$/i, "Select a valid agent.") }).strict();

const bulkStatusSchema = z.object({ ticketIds, status: z.enum(["open", "in_progress", "pending", "resolved", "closed"]) }).strict();

const bulkPrioritySchema = z.object({ ticketIds, priority: z.enum(["low", "medium", "high", "critical"]) }).strict();

const mergeSchema = z.object({ primaryId: z.string().regex(/^[a-f\d]{24}$/i, "Choose the ticket to merge into.") }).strict();

const replyEditSchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();

const listQuerySchema = z.object({
    status: z.enum(["open", "in_progress", "pending", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    category: z.string().optional(),
    assignedTo: z.string().optional(),
    // "unassigned" is the team's queue of tickets nobody owns; anything else is the viewer's own list.
    view: z.enum(["unassigned"]).optional(),
    search: z.string().max(140).optional(),
    sort: z.enum(TICKET_SORT_KEYS).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export async function listTickets(request, response, next) {
    try {
        const filters = listQuerySchema.parse(request.query);
        const result = await ticketService.list(filters, request.user);
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function getTicketStats(request, response, next) {
    try {
        const summary = await ticketService.summarize(request.user);
        response.json({ data: summary });
    } catch (error) {
        next(error);
    }
}

export async function createTicket(request, response, next) {
    try {
        const input = createSchema.parse(request.body);
        const ticket = await ticketService.create(input, request.user);
        response.status(201).json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function getTicket(request, response, next) {
    try {
        const ticket = await ticketService.getById(request.params.ticketId, request.user);
        response.json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function updateTicket(request, response, next) {
    try {
        const patch = updateSchema.parse(request.body);
        const ticket = await ticketService.update(request.params.ticketId, patch, request.user);
        response.json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function addReply(request, response, next) {
    try {
        const input = replySchema.parse(request.body);
        const ticket = await ticketService.addReply(request.params.ticketId, request.user, input);
        response.status(201).json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function listReplies(request, response, next) {
    try {
        const { before, limit } = replyPageQuerySchema.parse(request.query);
        const page = await ticketService.listReplies(request.params.ticketId, { before, limit: limit || REPLY_PAGE_SIZE }, request.user);
        response.json({ data: page });
    } catch (error) {
        next(error);
    }
}

export async function updateReply(request, response, next) {
    try {
        const { body } = replyEditSchema.parse(request.body);
        const ticket = await ticketService.updateReply(request.params.ticketId, request.params.replyId, body, request.user);
        response.json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function deleteReply(request, response, next) {
    try {
        const ticket = await ticketService.deleteReply(request.params.ticketId, request.params.replyId, request.user);
        response.json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function bulkAssign(request, response, next) {
    try {
        const { ticketIds: ids, agentId } = bulkAssignSchema.parse(request.body);
        const result = await ticketService.bulkAssign(ids, agentId, request.user);
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function bulkStatus(request, response, next) {
    try {
        const { ticketIds: ids, status } = bulkStatusSchema.parse(request.body);
        const result = await ticketService.bulkStatus(ids, status, request.user);
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function bulkPriority(request, response, next) {
    try {
        const { ticketIds: ids, priority } = bulkPrioritySchema.parse(request.body);
        const result = await ticketService.bulkPriority(ids, priority, request.user);
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function getMergeCandidates(request, response, next) {
    try {
        const candidates = await ticketService.getMergeCandidates(request.params.ticketId, request.user);
        response.json({ data: candidates });
    } catch (error) {
        next(error);
    }
}

export async function mergeTicket(request, response, next) {
    try {
        const { primaryId } = mergeSchema.parse(request.body);
        const ticket = await ticketService.merge(request.params.ticketId, primaryId, request.user);
        response.json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function assignTicket(request, response, next) {
    try {
        const { agentId } = assignSchema.parse(request.body);
        const ticket = await ticketService.assign(request.params.ticketId, agentId, request.user);
        response.json({ data: ticket });
    } catch (error) {
        next(error);
    }
}

export async function getTicketHistory(request, response, next) {
    try {
        const entries = await ticketService.getStatusHistory(request.params.ticketId, request.user);
        response.json({ data: entries });
    } catch (error) {
        next(error);
    }
}

export async function getTicketAudit(request, response, next) {
    try {
        const entries = await ticketService.getAuditTrail(request.params.ticketId);
        response.json({ data: entries });
    } catch (error) {
        next(error);
    }
}
