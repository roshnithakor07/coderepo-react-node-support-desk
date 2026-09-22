import { z } from "zod";
import { ticketService } from "./ticket.service.js";

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

const assignSchema = z.object({ agentId: z.string().min(1) }).strict();

const listQuerySchema = z.object({
    status: z.enum(["open", "in_progress", "pending", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    category: z.string().optional(),
    assignedTo: z.string().optional(),
    search: z.string().optional(),
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

export async function assignTicket(request, response, next) {
    try {
        const { agentId } = assignSchema.parse(request.body);
        const ticket = await ticketService.assign(request.params.ticketId, agentId, request.user);
        response.json({ data: ticket });
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
