import { AppError } from "../../shared/errors/app-error.js";
import { auditLogService } from "../audit-logs/audit-log.service.js";
import { authRepository } from "../auth/auth.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { settingsService } from "../settings/settings.service.js";
import { ticketRepository } from "./ticket.repository.js";

const STATUS_TRANSITIONS = {
    open: ["in_progress", "pending", "resolved", "closed"],
    in_progress: ["open", "pending", "resolved", "closed"],
    pending: ["open", "in_progress", "resolved", "closed"],
    resolved: ["closed", "open"],
    closed: ["open"],
};

function assertTransitionAllowed(current, next) {
    if (current === next) return;
    const allowed = STATUS_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
        throw new AppError(400, "INVALID_STATUS_TRANSITION", `Cannot move a ticket from "${current}" to "${next}".`);
    }
}

function serializeTicket(ticket) {
    const plain = typeof ticket.toObject === "function" ? ticket.toObject() : ticket;
    return plain;
}

async function computeSlaDeadline(priority, fromDate = new Date()) {
    const hours = await settingsService.getSlaHours(priority);
    return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
}

async function pickAutoAssignee() {
    const candidates = await authRepository.findAgentsWithWorkload();
    return candidates.length > 0 ? candidates[0] : null;
}

function assertCanView(ticket, actor) {
    if (actor.role === "admin") return;
    if (actor.role === "agent" && String(ticket.assignedTo?._id || ticket.assignedTo) === actor.id) return;
    if (actor.role === "customer" && String(ticket.createdBy?._id || ticket.createdBy) === actor.id) return;
    throw new AppError(403, "FORBIDDEN", "You do not have access to this ticket.");
}

// Customers never receive internal notes, whichever endpoint returns the ticket.
function presentTicket(ticket, actor) {
    if (!ticket || actor.role !== "customer") return ticket;
    return { ...ticket, replies: ticket.replies.filter((reply) => !reply.isInternal) };
}

export const ticketService = {
    async create(input, actor) {
        const slaDeadline = await computeSlaDeadline(input.priority);
        const autoAssignee = await pickAutoAssignee();

        const ticket = await ticketRepository.create({
            title: input.title,
            description: input.description,
            priority: input.priority,
            category: input.category || "general",
            tags: input.tags || [],
            createdBy: actor.id,
            assignedTo: autoAssignee ? autoAssignee._id : null,
            slaDeadline,
        });

        await auditLogService.record(ticket._id, "created", actor.id, { priority: input.priority, autoAssigned: Boolean(autoAssignee) });

        if (autoAssignee) {
            await notificationService.notify(
                autoAssignee._id,
                "ticket_assigned",
                `You were auto-assigned ticket "${ticket.title}".`,
                ticket._id,
            );
        }

        return presentTicket(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async list(filters, actor) {
        const query = {};
        if (actor.role === "customer") query.createdBy = actor.id;
        else if (actor.role === "agent") query.assignedTo = actor.id;

        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;
        if (filters.assignedTo && actor.role === "admin") query.assignedTo = filters.assignedTo;
        if (filters.search) query.$text = { $search: filters.search };

        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const skip = (page - 1) * pageSize;

        const [tickets, total] = await Promise.all([
            ticketRepository.findMany(query, { skip, limit: pageSize }),
            ticketRepository.count(query),
        ]);
        return { tickets: tickets.map((ticket) => presentTicket(ticket, actor)), total, page, pageSize };
    },

    async getById(id, actor) {
        const ticket = await ticketRepository.findByIdLean(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        return presentTicket(ticket, actor);
    },

    async update(id, patch, actor) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);

        const changes = {};

        if (patch.status && patch.status !== ticket.status) {
            assertTransitionAllowed(ticket.status, patch.status);
            changes.status = { from: ticket.status, to: patch.status };
            ticket.status = patch.status;
            ticket.resolvedAt = patch.status === "resolved" ? new Date() : ticket.status === "closed" ? ticket.resolvedAt : null;
            if (patch.status === "resolved") ticket.resolvedAt = new Date();
        }

        if (patch.priority && patch.priority !== ticket.priority) {
            changes.priority = { from: ticket.priority, to: patch.priority };
            ticket.priority = patch.priority;
            const newDeadline = await computeSlaDeadline(patch.priority, ticket.createdAt);
            ticket.slaDeadline = newDeadline;
            if (newDeadline.getTime() > Date.now()) {
                ticket.slaBreached = false;
                ticket.slaWarningNotifiedAt = null;
            }
        }

        if (patch.title && patch.title !== ticket.title) {
            changes.title = { from: ticket.title, to: patch.title };
            ticket.title = patch.title;
        }

        if (patch.description && patch.description !== ticket.description) {
            ticket.description = patch.description;
            changes.description = "updated";
        }

        if (patch.category && patch.category !== ticket.category) {
            changes.category = { from: ticket.category, to: patch.category };
            ticket.category = patch.category;
        }

        if (patch.tags) {
            ticket.tags = patch.tags;
            changes.tags = patch.tags;
        }

        await ticketRepository.save(ticket);

        if (Object.keys(changes).length > 0) {
            await auditLogService.record(ticket._id, "updated", actor.id, changes);
        }

        if (changes.status && String(ticket.createdBy) !== actor.id) {
            await notificationService.notify(
                ticket.createdBy,
                "status_changed",
                `Ticket "${ticket.title}" status changed to ${ticket.status}.`,
                ticket._id,
            );
        }

        return presentTicket(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async assign(id, agentId, actor) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");

        const agent = await authRepository.findById(agentId);
        if (!agent || agent.role !== "agent" || !agent.isActive) {
            throw new AppError(400, "INVALID_AGENT", "The selected agent is not available for assignment.");
        }

        ticket.assignedTo = agent._id;
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "assigned", actor.id, { assignedTo: agent.name });
        await notificationService.notify(agent._id, "ticket_assigned", `You were assigned ticket "${ticket.title}".`, ticket._id);

        return presentTicket(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async addReply(id, actor, { body, isInternal }) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);

        const internal = actor.role === "customer" ? false : Boolean(isInternal);
        ticket.replies.push({ body, author: actor.id, isInternal: internal });

        if (actor.role !== "customer" && ticket.status === "open") {
            ticket.status = "in_progress";
        }

        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "replied", actor.id, { isInternal: internal });

        if (!internal) {
            if (actor.role === "customer" && ticket.assignedTo) {
                await notificationService.notify(ticket.assignedTo, "ticket_reply", `New reply on ticket "${ticket.title}".`, ticket._id);
            } else if (actor.role !== "customer" && String(ticket.createdBy) !== actor.id) {
                await notificationService.notify(ticket.createdBy, "ticket_reply", `New reply on ticket "${ticket.title}".`, ticket._id);
            }
        }

        return presentTicket(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    getAuditTrail(id) {
        return auditLogService.listForTicket(id);
    },

    async runSlaSweep() {
        const now = new Date();

        const overdue = await ticketRepository.findOverdueUnbreached(now);
        for (const ticket of overdue) {
            ticket.slaBreached = true;
            await ticketRepository.save(ticket);
            await auditLogService.record(ticket._id, "sla_breached", ticket.createdBy, { slaDeadline: ticket.slaDeadline });
            const recipients = [ticket.assignedTo].filter(Boolean);
            await notificationService.notifyMany(recipients, "sla_breached", `SLA breached for ticket "${ticket.title}".`, ticket._id);
        }

        const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);
        const approaching = await ticketRepository.findApproachingSla(now, windowEnd);
        for (const ticket of approaching) {
            ticket.slaWarningNotifiedAt = now;
            await ticketRepository.save(ticket);
            const recipients = [ticket.assignedTo].filter(Boolean);
            await notificationService.notifyMany(
                recipients,
                "sla_warning",
                `SLA due within 30 minutes for ticket "${ticket.title}".`,
                ticket._id,
            );
        }

        return { breached: overdue.length, warned: approaching.length };
    },

    serializeTicket,
};
