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
import { assertNoteEditable, canEditNote, noteEditBlockedReason } from "./ticket-notes.js";
import {
    assertAssigneeCoversCategory,
    assertInTeam,
    categoryLabel,
    coversCategory,
    isClaimableByTeam,
    normalizeCategories,
    unownedOutsideTeamReason,
} from "./ticket-teams.js";
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

// The ticket goes to the least-loaded active agent who covers its category. Nobody covering it means
// nobody is picked: the ticket waits in the unassigned queue and the admins hear about it, which is
// better than handing it to an agent who is not allowed to work it.
async function pickAutoAssignee(category) {
    const candidates = await authRepository.findAgentsWithWorkload({ category });
    return candidates.length > 0 ? candidates[0] : null;
}

// What a role may see at all: an admin everything, an agent their assignments, a customer their own
// tickets. Both the list and the dashboard counts start from this.
function scopeFor(actor) {
    if (actor.role === "customer") return { createdBy: actor.id };
    if (actor.role === "agent") return { assignedTo: actor.id };
    return {};
}

// The unassigned queue: tickets still in the working queue that nobody owns. An agent sees only the
// categories their team covers, an admin the whole backlog. A customer has no such queue.
function unassignedScopeFor(actor) {
    if (actor.role === "customer") {
        throw new AppError(403, "FORBIDDEN", "The unassigned queue is for the support team. Your tickets are on the Tickets page.");
    }
    const base = { assignedTo: null, status: { $in: ACTIVE_STATUSES } };
    if (actor.role === "admin") return base;
    return { ...base, category: { $in: normalizeCategories(actor.categories) } };
}

function scopeForView(actor, view) {
    return view === "unassigned" ? unassignedScopeFor(actor) : scopeFor(actor);
}

// A filter value the current scope allows, or a condition that matches nothing. `$in: []` is how a
// filter outside the scope returns an empty list instead of silently widening it.
function narrowTo(value, isAllowed) {
    return isAllowed ? value : { $in: [] };
}

function assertCanView(ticket, actor) {
    if (actor.role === "admin") return;
    if (actor.role === "agent" && String(ticket.assignedTo?._id || ticket.assignedTo) === actor.id) return;
    // An agent can open anything in their own queue, which is how they get to the page they claim
    // it from.
    if (isClaimableByTeam(ticket, actor)) return;
    if (actor.role === "customer" && String(ticket.createdBy?._id || ticket.createdBy) === actor.id) return;
    // Refused either way; an agent looking at the shared backlog is told which team it belongs to.
    const outsideTeam = unownedOutsideTeamReason(ticket, actor);
    if (outsideTeam) throw new AppError(403, "OUTSIDE_TEAM", outsideTeam);
    throw new AppError(403, "FORBIDDEN", "You do not have access to this ticket.");
}

// Customers never receive internal notes, whichever endpoint returns the ticket.
function presentTicket(ticket, actor) {
    if (!ticket || actor.role !== "customer") return ticket;
    return { ...ticket, replies: ticket.replies.filter((reply) => !reply.isInternal) };
}

// Each internal note carries whether this viewer may still change it, and why not, so the Edit and
// Delete controls appear on exactly the notes the API would accept them for.
function presentReplies(replies, actor, now) {
    return (replies || []).map((reply) =>
        reply.isInternal
            ? { ...reply, canEdit: canEditNote(reply, actor, now), editBlockedReason: noteEditBlockedReason(reply, actor, now) }
            : reply,
    );
}

// The ticket page also gets what this viewer may do and why not, so every control is hidden or
// disabled from the same rules the API enforces.
function presentTicketDetail(ticket, actor) {
    const now = new Date();
    const presented = presentTicket(ticket, actor);
    // Permissions are derived from the full ticket: an internal note still counts as a reply even
    // though the customer never sees it.
    return {
        ...presented,
        replies: presentReplies(presented.replies, actor, now),
        permissions: {
            ...permissionsFor(ticket, actor, now),
            canClaim: isClaimableByTeam(ticket, actor),
        },
    };
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

// Loads the ticket and the one reply an edit or a delete names, with every check both actions share:
// the ticket is reachable and not closed, the reply exists, and this person may still change it.
async function findReplyForEdit(ticketId, replyId, actor) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
    assertCanView(ticket, actor);
    assertNotClosed(ticket);

    const reply = ticket.replies.id(replyId);
    if (!reply) throw new AppError(404, "REPLY_NOT_FOUND", "That message is no longer on this ticket.");
    assertNoteEditable(reply, actor);

    return { ticket, reply };
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
        const category = input.category || "general";
        const slaDeadline = await computeSlaDeadline(input.priority, slaStartedAt);
        const autoAssignee = await pickAutoAssignee(category);

        const ticket = await ticketRepository.create({
            title: input.title,
            description: input.description,
            priority: input.priority,
            category,
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
            // Nobody covers this category, so the admins are the ones who have to act: either claim
            // it onto a team or put somebody on that category.
            await notificationService.notifyMany(
                await authRepository.findAdminIds(),
                "ticket_unassigned",
                `Ticket "${ticket.title}" is in ${categoryLabel(category)} with no agent covering it, and is waiting to be picked up.`,
                ticket._id,
            );
        }

        return presentTicketDetail(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async list(filters, actor) {
        const query = scopeForView(actor, filters.view);
        const isUnassignedQueue = filters.view === "unassigned";

        // Inside the unassigned queue a filter can only narrow what the queue already allows, never
        // widen it: asking for a finished status, or for a category the team does not cover, matches
        // nothing rather than reaching past the scope.
        if (filters.status) query.status = narrowTo(filters.status, !isUnassignedQueue || ACTIVE_STATUSES.includes(filters.status));
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) {
            query.category = narrowTo(
                filters.category,
                !isUnassignedQueue || actor.role === "admin" || coversCategory(actor, filters.category),
            );
        }
        if (filters.assignedTo && actor.role === "admin" && !isUnassignedQueue) query.assignedTo = filters.assignedTo;
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
        assertPatchAllowed(patch, ticket, actor);

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
            // Refiling a ticket cannot leave it owned by an agent who is not on that category's
            // team, or the team rule would be true at assignment and false a moment later.
            assertAssigneeCoversCategory(ticket.assignedTo, patch.category);
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
        // The second access rule: an agent works only the categories their team covers, whether they
        // are claiming the ticket themselves or an admin is handing it to them.
        assertInTeam(agent, ticket.category, actor);

        const isClaim = String(agent._id) === actor.id;
        ticket.assignedTo = agent._id;
        // Somebody owns it again, so a later spell without an assignee alerts the admins afresh.
        ticket.unassignedNotifiedAt = null;
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, isClaim ? "claimed" : "assigned", actor.id, { assignedTo: agent.name });
        // Claiming a ticket needs no notification: the agent who did it is looking at the ticket.
        if (!isClaim) {
            await notificationService.notify(agent._id, "ticket_assigned", `You were assigned ticket "${ticket.title}".`, ticket._id);
        }

        return presentTicketDetail(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    // An internal note is a working note: its author (or an admin) can correct it while it is fresh.
    async updateReply(id, replyId, body, actor) {
        const { ticket, reply } = await findReplyForEdit(id, replyId, actor);

        reply.body = body;
        reply.editedAt = new Date();
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "note_edited", actor.id, { replyId: String(reply._id) });

        return presentTicketDetail(await ticketRepository.findByIdLean(ticket._id), actor);
    },

    async deleteReply(id, replyId, actor) {
        const { ticket, reply } = await findReplyForEdit(id, replyId, actor);

        reply.deleteOne();
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "note_deleted", actor.id, { replyId: String(replyId) });

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
        // customer's reply on a pending ticket hands it back to the team, and on a resolved ticket
        // reopens it. Only the reopen starts a fresh SLA period: a pending ticket is still inside
        // the period it was already in, so its clock, and any breach on it, carry on unchanged.
        const isCustomer = actor.role === "customer";
        const autoStatus = isCustomer ? statusAfterCustomerReply(ticket) : statusAfterStaffReply(ticket, internal);
        const changes = {};
        let reopened = false;
        if (autoStatus) reopened = await applyStatusChange(ticket, autoStatus, now, changes);

        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "replied", actor.id, { isInternal: internal });
        if (changes.status) {
            await auditLogService.record(ticket._id, reopened ? "reopened" : "updated", actor.id, { ...changes, trigger: "reply" });
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
