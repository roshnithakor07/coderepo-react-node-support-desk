import { AppError } from "../../shared/errors/app-error.js";
import { auditLogService } from "../audit-logs/audit-log.service.js";
import { authRepository } from "../auth/auth.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { settingsService } from "../settings/settings.service.js";
import {
    ACTIVE_STATUSES,
    STATUS_LABELS,
    assertNotClosed,
    assertPatchAllowed,
    assertTransitionAllowed,
    isActiveStatus,
    isReopen,
    permissionsFor,
    statusAfterCustomerReply,
    statusAfterStaffReply,
} from "./ticket-lifecycle.js";
import { ticketRepository } from "./ticket.repository.js";

// Each sort the UI offers maps to one database sort. `priorityRank`, `statusRank` and `titleSort`
// are computed by the repository so word enums order by meaning and titles ignore case.
const SORT_ORDERS = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    title_asc: { titleSort: 1 },
    title_desc: { titleSort: -1 },
    priority_desc: { priorityRank: -1, createdAt: -1 },
    status: { statusRank: 1, createdAt: -1 },
};

export const TICKET_SORT_KEYS = Object.keys(SORT_ORDERS);

// Audit actions that belong on the status history the ticket page shows.
const HISTORY_ACTIONS = ["created", "reopened", "sla_breached"];

async function computeSlaDeadline(priority, fromDate = new Date()) {
    const hours = await settingsService.getSlaHours(priority);
    return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
}

// Search matches part of a word, case-insensitively, in the title or the description. The term is
// escaped so characters like "(" or "*" are searched for literally instead of breaking the regex.
function searchConditions(term) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return [{ title: pattern }, { description: pattern }];
}

async function pickAutoAssignee() {
    const candidates = await authRepository.findAgentsWithWorkload();
    return candidates.length > 0 ? candidates[0] : null;
}

// What a role may see at all: an admin everything, an agent their assignments, a customer their own
// tickets. Both the list and the dashboard counts start from this.
function scopeFor(actor) {
    if (actor.role === "customer") return { createdBy: actor.id };
    if (actor.role === "agent") return { assignedTo: actor.id };
    return {};
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

// The ticket page also gets what this viewer may do and why not, so every control is hidden or
// disabled from the same rules the API enforces.
function presentTicketDetail(ticket, actor) {
    const presented = presentTicket(ticket, actor);
    // Permissions are derived from the full ticket: an internal note still counts as a reply even
    // though the customer never sees it.
    return { ...presented, permissions: permissionsFor(ticket, actor) };
}

// Reopening restarts the SLA clock from this moment. Measuring it from the original creation time
// would hand a revived ticket a deadline that has already passed.
async function restartSla(ticket, at, changes) {
    ticket.slaStartedAt = at;
    const deadline = await computeSlaDeadline(ticket.priority, at);
    changes.slaDeadline = { from: ticket.slaDeadline, to: deadline };
    ticket.slaDeadline = deadline;
    ticket.slaBreached = false;
    ticket.slaWarningNotifiedAt = null;
    ticket.resolvedAt = null;
    ticket.closedAt = null;
    changes.slaRestartedAt = at;
}

// Applies a status move that has already been checked, plus the stamps and clock that go with it.
async function applyStatusChange(ticket, next, at, changes) {
    const reopening = isReopen(ticket.status, next);
    changes.status = { from: ticket.status, to: next };
    ticket.status = next;

    if (next === "resolved") ticket.resolvedAt = at;
    // Closing keeps the resolve stamp and starts the reopen window.
    if (next === "closed") ticket.closedAt = at;
    if (reopening) await restartSla(ticket, at, changes);

    return reopening;
}

function statusChangeMessage(ticket) {
    return `Ticket "${ticket.title}" status changed to ${STATUS_LABELS[ticket.status] || ticket.status}.`;
}

// One audit entry per history row: who moved the ticket, from what to what, and when.
function toHistoryEntry(entry) {
    const status = entry.changes?.status;
    return {
        _id: entry._id,
        action: entry.action,
        from: status?.from || null,
        to: entry.action === "created" ? "open" : status?.to || null,
        slaRestartedAt: entry.changes?.slaRestartedAt || null,
        performedBy: entry.performedBy ? { name: entry.performedBy.name, role: entry.performedBy.role } : null,
        createdAt: entry.createdAt,
    };
}

export const ticketService = {
    async create(input, actor) {
        const slaStartedAt = new Date();
        const slaDeadline = await computeSlaDeadline(input.priority, slaStartedAt);
        const autoAssignee = await pickAutoAssignee();

        const ticket = await ticketRepository.create({
            title: input.title,
            description: input.description,
            priority: input.priority,
            category: input.category || "general",
            tags: input.tags || [],
            createdBy: actor.id,
            assignedTo: autoAssignee ? autoAssignee._id : null,
            slaStartedAt,
            slaDeadline,
            // A ticket nobody could be assigned to is reported to the admins now, so the sweep does
            // not repeat the alert a minute later.
            unassignedNotifiedAt: autoAssignee ? null : slaStartedAt,
        });

        await auditLogService.record(ticket._id, "created", actor.id, { priority: input.priority, autoAssigned: Boolean(autoAssignee) });

        if (autoAssignee) {
            await notificationService.notify(
                autoAssignee._id,
                "ticket_assigned",
                `You were auto-assigned ticket "${ticket.title}".`,
                ticket._id,
            );
        } else {
            await notificationService.notifyMany(
                await authRepository.findAdminIds(),
                "ticket_unassigned",
                `Ticket "${ticket.title}" has no assignee and is waiting to be picked up.`,
                ticket._id,
            );
        }

        return presentTicketDetail(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async list(filters, actor) {
        const query = scopeFor(actor);

        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;
        if (filters.assignedTo && actor.role === "admin") query.assignedTo = filters.assignedTo;
        const search = (filters.search || "").trim();
        if (search) query.$or = searchConditions(search);

        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const sort = SORT_ORDERS[filters.sort] || SORT_ORDERS.newest;

        const [tickets, total] = await Promise.all([
            ticketRepository.findMany(query, { skip, limit: pageSize, sort }),
            ticketRepository.count(query),
        ]);
        return { tickets: tickets.map((ticket) => presentTicket(ticket, actor)), total, page, pageSize };
    },

    // Counts for the dashboard tiles. Deliberately independent of the ticket list's filters, so
    // filtering the list cannot change what the home page reports.
    summarize(actor) {
        return ticketRepository.summarize(scopeFor(actor));
    },

    async getById(id, actor) {
        const ticket = await ticketRepository.findByIdLean(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        return presentTicketDetail(ticket, actor);
    },

    async update(id, patch, actor) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        assertPatchAllowed(patch, actor);

        const now = new Date();
        const nextStatus = patch.status && patch.status !== ticket.status ? patch.status : null;
        const editsFields = ["title", "description", "priority", "category", "tags"].some((field) => patch[field] !== undefined);

        // A closed ticket is read-only. The reopen is the one change it still accepts, so the status
        // is checked by the lifecycle rules below rather than blocked here.
        if (ticket.status === "closed" && editsFields) assertNotClosed(ticket);

        const changes = {};
        let reopened = false;

        if (nextStatus) {
            assertTransitionAllowed(ticket, nextStatus, actor, now);
            reopened = await applyStatusChange(ticket, nextStatus, now, changes);
        }

        if (patch.priority && patch.priority !== ticket.priority) {
            changes.priority = { from: ticket.priority, to: patch.priority };
            ticket.priority = patch.priority;
            // The new window runs from the change, not from when the ticket was created: a ticket
            // raised to critical gets a full critical window to answer in. A breach already on the
            // record stays on it.
            if (isActiveStatus(ticket.status)) {
                const deadline = await computeSlaDeadline(patch.priority, now);
                changes.slaDeadline = { from: changes.slaDeadline?.to || ticket.slaDeadline, to: deadline };
                ticket.slaStartedAt = now;
                ticket.slaDeadline = deadline;
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
            await auditLogService.record(ticket._id, reopened ? "reopened" : "updated", actor.id, changes);
        }

        if (changes.status && String(ticket.createdBy) !== actor.id) {
            await notificationService.notify(ticket.createdBy, "status_changed", statusChangeMessage(ticket), ticket._id);
        }

        return presentTicketDetail(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async assign(id, agentId, actor) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        assertNotClosed(ticket);

        const agent = await authRepository.findById(agentId);
        if (!agent || agent.role !== "agent" || !agent.isActive) {
            throw new AppError(400, "INVALID_AGENT", "The selected agent is not available for assignment.");
        }

        ticket.assignedTo = agent._id;
        // Somebody owns it again, so a later spell without an assignee alerts the admins afresh.
        ticket.unassignedNotifiedAt = null;
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "assigned", actor.id, { assignedTo: agent.name });
        await notificationService.notify(agent._id, "ticket_assigned", `You were assigned ticket "${ticket.title}".`, ticket._id);

        return presentTicketDetail(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async addReply(id, actor, { body, isInternal }) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        // A closed ticket's conversation is a record of what happened.
        assertNotClosed(ticket);

        const internal = actor.role === "customer" ? false : Boolean(isInternal);
        const now = new Date();
        ticket.replies.push({ body, author: actor.id, isInternal: internal });

        // A public staff reply starts work on an open ticket; an internal note never moves it. A
        // customer's reply revives a ticket that was waiting on them or already resolved, under the
        // same reopen rules: a fresh SLA window and a "reopened" entry.
        const isCustomer = actor.role === "customer";
        const autoStatus = isCustomer ? statusAfterCustomerReply(ticket) : statusAfterStaffReply(ticket, internal);
        const changes = {};
        if (autoStatus) {
            const reopening = await applyStatusChange(ticket, autoStatus, now, changes);
            // A ticket that was only waiting on the customer is still inside its own SLA window, so
            // the restart has to be asked for explicitly there.
            if (isCustomer && !reopening) await restartSla(ticket, now, changes);
        }

        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "replied", actor.id, { isInternal: internal });
        if (changes.status) {
            const action = isCustomer ? "reopened" : "updated";
            await auditLogService.record(ticket._id, action, actor.id, { ...changes, trigger: "reply" });
        }

        if (!internal) {
            if (actor.role === "customer" && ticket.assignedTo) {
                await notificationService.notify(ticket.assignedTo, "ticket_reply", `New reply on ticket "${ticket.title}".`, ticket._id);
            } else if (actor.role !== "customer" && String(ticket.createdBy) !== actor.id) {
                await notificationService.notify(ticket.createdBy, "ticket_reply", `New reply on ticket "${ticket.title}".`, ticket._id);
            }
        }

        return presentTicketDetail(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async getAuditTrail(id) {
        if (!(await ticketRepository.exists(id))) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        return auditLogService.listForTicket(id);
    },

    // The status history everyone who can see the ticket gets: the lifecycle only, with no internal
    // notes, assignments or field edits in it.
    async getStatusHistory(id, actor) {
        const ticket = await ticketRepository.findByIdLean(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        const entries = await auditLogService.listStatusHistory(id, HISTORY_ACTIONS);
        return entries.map(toHistoryEntry);
    },

    async runSlaSweep() {
        const now = new Date();
        // Admins watch the whole board, so a missed deadline or an unowned ticket reaches them too.
        const adminIds = await authRepository.findAdminIds();

        const overdue = await ticketRepository.findOverdueUnbreached(now);
        for (const ticket of overdue) {
            ticket.slaBreached = true;
            await ticketRepository.save(ticket);
            await auditLogService.record(ticket._id, "sla_breached", null, { slaDeadline: ticket.slaDeadline });
            await notificationService.notifyMany(
                [ticket.assignedTo, ...adminIds],
                "sla_breached",
                `SLA breached for ticket "${ticket.title}".`,
                ticket._id,
            );
        }

        const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);
        const approaching = await ticketRepository.findApproachingSla(now, windowEnd);
        for (const ticket of approaching) {
            ticket.slaWarningNotifiedAt = now;
            await ticketRepository.save(ticket);
            await notificationService.notifyMany(
                [ticket.assignedTo].filter(Boolean),
                "sla_warning",
                `SLA due within 30 minutes for ticket "${ticket.title}".`,
                ticket._id,
            );
        }

        const unassigned = await ticketRepository.findUnassignedUnnotified(ACTIVE_STATUSES);
        for (const ticket of unassigned) {
            ticket.unassignedNotifiedAt = now;
            await ticketRepository.save(ticket);
            await notificationService.notifyMany(
                adminIds,
                "ticket_unassigned",
                `Ticket "${ticket.title}" has no assignee and is waiting to be picked up.`,
                ticket._id,
            );
        }

        return { breached: overdue.length, warned: approaching.length, unassigned: unassigned.length };
    },
};
