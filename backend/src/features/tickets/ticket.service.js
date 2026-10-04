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
import { BULK_LIMIT, bulkRejectedError, hasDuplicates, toRejection } from "./ticket-bulk.js";
import { assertMergeAllowed, mergeBlock, mergedReplies, ticketNumber } from "./ticket-merge.js";
import { assertNoteEditable, canEditNote, noteEditBlockedReason } from "./ticket-notes.js";
import { REPLY_LIMIT, REPLY_LIMIT_MESSAGE, REPLY_LIMIT_NOTICE_FROM, REPLY_PAGE_SIZE, replyLimitError } from "./ticket-replies.js";
import { lastCoverBlock, lastCoverMessage, planReassignments } from "./ticket-reassign.js";
import { slaComplianceRate } from "./ticket-sla.js";
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

// The "Assigned to" filter's value for the tickets nobody owns, next to the agent ids it also takes.
export const UNASSIGNED_ASSIGNEE = "unassigned";

// Audit actions that belong on the status history the ticket page shows.
const HISTORY_ACTIONS = ["created", "reopened", "sla_breached", "merged"];

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

function canSee(ticket, actor) {
    try {
        assertCanView(ticket, actor);
        return true;
    } catch {
        return false;
    }
}

// Customers never receive internal notes, whichever endpoint returns the ticket.
function presentTicket(ticket, actor) {
    if (!ticket || actor.role !== "customer") return ticket;
    return { ...ticket, replies: ticket.replies.filter((reply) => !reply.isInternal) };
}

// A row on the list carries the size of its conversation and none of it. A customer is told the number
// they could read, so the count never gives away how many internal notes there are.
function presentListRow(ticket, actor) {
    const { publicReplyCount, ...row } = ticket;
    return { ...row, replyCount: actor.role === "customer" ? publicReplyCount : row.replyCount };
}

// The conversation is sent one page at a time, so the ticket also says how long it is: `replyCount` is
// what the 500-reply rule counts, and `visibleReplyCount` how many of those this viewer may read, which
// is what the "Show earlier replies" button counts down. `oldestReplyId` is where paging back starts,
// taken before internal notes are stripped so a customer's cursor still lands on the right place.
function replyPaging(ticket, presented, actor) {
    return {
        replyCount: ticket.replyCount ?? ticket.replies.length,
        visibleReplyCount:
            actor.role === "customer"
                ? (ticket.publicReplyCount ?? presented.replies.length)
                : (ticket.replyCount ?? ticket.replies.length),
        oldestReplyId: ticket.replies.length > 0 ? ticket.replies[0]._id : null,
        // The two numbers behind the composer's notice, so the page shows the rule rather than keeping a
        // second copy of it.
        replyLimit: REPLY_LIMIT,
        replyNoticeFrom: REPLY_LIMIT_NOTICE_FROM,
    };
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
    // The counts the page needs; the raw ones they are derived from are left behind here, not deleted
    // from the ticket, which the rules below still read.
    const paging = replyPaging(ticket, presented, actor);
    const { publicReplyCount, publicStaffReplyCount, ...withoutRawCounts } = presented;
    // Permissions are derived from the full ticket: an internal note still counts as a reply even
    // though the customer never sees it, and the answer that allows a resolve may be pages back.
    const permissions = permissionsFor(ticket, actor, now);
    const isFull = paging.replyCount >= REPLY_LIMIT;
    return {
        ...withoutRawCounts,
        ...paging,
        replies: presentReplies(presented.replies, actor, now),
        permissions: {
            ...permissions,
            // A full conversation closes the composer the way a closed ticket does, and says so in the
            // same place, with the reason the API would give.
            canReply: permissions.canReply && !isFull,
            replyLimitReason: isFull ? REPLY_LIMIT_MESSAGE : null,
            canClaim: isClaimableByTeam(ticket, actor),
            // Staff can fold a duplicate into another ticket while it is still in play.
            canMerge: actor.role !== "customer" && ticket.status !== "closed" && !ticket.mergedInto,
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

// Everything that decides whether this actor may give this ticket to this agent, shared by the single
// assignment and the bulk one so the two can never drift apart.
function assertCanAssign(ticket, agent, actor) {
    assertCanView(ticket, actor);
    assertNotClosed(ticket);
    // The second access rule: an agent works only the categories their team covers, whether they are
    // claiming the ticket themselves or an admin is handing it to them.
    assertInTeam(agent, ticket.category, actor);
}

async function loadAssignableAgent(agentId) {
    const agent = await authRepository.findById(agentId);
    if (!agent || agent.role !== "agent" || !agent.isActive) {
        throw new AppError(400, "INVALID_AGENT", "The selected agent is not available for assignment.");
    }
    return agent;
}

// Checks every ticket and returns the ones that break the rule, so a bulk action can refuse the lot.
// A ticket that is not found is a rejection like any other, not a reason to forget the rest.
async function collectRejections(ids, check) {
    const found = new Map((await ticketRepository.findManyByIds(ids)).map((ticket) => [String(ticket._id), ticket]));
    const rejections = [];
    const changing = [];
    for (const id of ids) {
        const ticket = found.get(String(id));
        try {
            if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
            if (check(ticket)) changing.push(String(ticket._id));
        } catch (error) {
            if (!(error instanceof AppError)) throw error;
            rejections.push(toRejection(ticket, error, id));
        }
    }
    return { rejections, changing };
}

function assertBulkSize(ids) {
    if (ids.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Select at least one ticket.");
    if (ids.length > BULK_LIMIT) {
        throw new AppError(400, "VALIDATION_ERROR", `Select at most ${BULK_LIMIT} tickets at a time.`);
    }
    if (hasDuplicates(ids)) throw new AppError(400, "VALIDATION_ERROR", "Each ticket can be selected only once.");
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
        // A merge is on both tickets' histories, each saying which way it went.
        mergedInto: entry.changes?.mergedInto || null,
        mergedFrom: entry.changes?.mergedFrom || null,
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

        return presentTicketDetail(await ticketRepository.findByIdDetail(ticket._id, REPLY_PAGE_SIZE), actor);
    },

    async list(filters, actor) {
        // Who a ticket is with is a staff question: a customer's list is their own tickets either way.
        if (filters.assignee && actor.role === "customer") {
            throw new AppError(403, "FORBIDDEN", "Filtering by assignee is for the support team. Every ticket on your list is your own.");
        }

        const isUnassignedQueue = filters.view === "unassigned";
        const wantsUnowned = filters.assignee === UNASSIGNED_ASSIGNEE;
        // "Unassigned" means on the list what it means in the queue: the tickets nobody owns that this
        // person may work, the admin's whole backlog and an agent's own categories. Taking the queue's
        // own scope is what stops the filter showing more than the queue does.
        const query = wantsUnowned && !isUnassignedQueue ? unassignedScopeFor(actor) : scopeForView(actor, filters.view);
        const unownedOnly = isUnassignedQueue || wantsUnowned;

        // Looking at tickets nobody owns, a filter can only narrow what that scope already allows, never
        // widen it: asking for a finished status, or for a category the team does not cover, matches
        // nothing rather than reaching past the scope.
        if (filters.status) query.status = narrowTo(filters.status, !unownedOnly || ACTIVE_STATUSES.includes(filters.status));
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) {
            query.category = narrowTo(filters.category, !unownedOnly || actor.role === "admin" || coversCategory(actor, filters.category));
        }
        // A named agent: an admin may ask for any of them, an agent only for themselves, because this
        // filter writes over the scope that limits an agent's list to their own tickets. Where nothing is
        // owned, a named agent matches nothing.
        if (filters.assignee && !wantsUnowned) {
            query.assignedTo = unownedOnly
                ? { $in: [] }
                : narrowTo(filters.assignee, actor.role === "admin" || filters.assignee === actor.id);
        }
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
        return { tickets: tickets.map((ticket) => presentListRow(ticket, actor)), total, page, pageSize };
    },

    // Counts for the dashboard tiles. Deliberately independent of the ticket list's filters, so
    // filtering the list cannot change what the home page reports.
    async summarize(actor) {
        const summary = await ticketRepository.summarize(scopeFor(actor));
        return { ...summary, slaComplianceRate: slaComplianceRate(summary.total, summary.breached) };
    },

    // The ticket with the latest page of its conversation. The older pages come from `listReplies`, so
    // a thread with hundreds of replies opens as quickly as a fresh one.
    async getById(id, actor) {
        const ticket = await ticketRepository.findByIdDetail(id, REPLY_PAGE_SIZE);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        return presentTicketDetail(ticket, actor);
    },

    // A page of the replies written before a given one, oldest first: the same view rules as the ticket
    // itself, and internal notes stripped for a customer exactly as they are on the ticket. `nextBefore`
    // is where the page after this one starts, counted before any note is stripped, so a page that holds
    // nothing a customer may read still moves them back through the thread.
    async listReplies(id, { before, limit }, actor) {
        const ticket = await ticketRepository.findByIdForAccess(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);

        const page = await ticketRepository.findRepliesBefore(id, before || null, limit);
        // The ticket is there, so a missing page means the cursor names a reply that is not on it.
        if (!page) throw new AppError(404, "REPLY_NOT_FOUND", "That message is no longer on this ticket.");

        const now = new Date();
        const visible = actor.role === "customer" ? page.replies.filter((reply) => !reply.isInternal) : page.replies;
        return {
            replies: presentReplies(visible, actor, now),
            nextBefore: page.replies.length > 0 ? page.replies[0]._id : null,
            hasEarlier: page.hasEarlier,
        };
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

        return presentTicketDetail(await ticketRepository.findByIdDetail(ticket._id, REPLY_PAGE_SIZE), actor);
    },

    async assign(id, agentId, actor) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        // Visibility and "closed" are answered before the agent is looked at, so a ticket the person
        // may not see never reveals who is or is not available.
        assertCanView(ticket, actor);
        assertNotClosed(ticket);
        const agent = await loadAssignableAgent(agentId);
        assertCanAssign(ticket, agent, actor);

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

        return presentTicketDetail(await ticketRepository.findByIdDetail(ticket._id, REPLY_PAGE_SIZE), actor);
    },

    // Several tickets to one agent, all or nothing. Every ticket is held to the rule the single
    // assignment enforces; if any breaks it nothing moves and the answer lists each one and why. A ticket
    // the agent already has is left alone and counted as unchanged. Mongo here is a single node, so the
    // checks run up front and the writes follow; a ticket changed by someone else in between is
    // re-checked by the single assignment and would be reported, never silently overwritten.
    async bulkAssign(ids, agentId, actor) {
        assertBulkSize(ids);
        const agent = await loadAssignableAgent(agentId);
        const { rejections, changing } = await collectRejections(ids, (ticket) => {
            assertCanAssign(ticket, agent, actor);
            return String(ticket.assignedTo?._id || ticket.assignedTo) !== String(agent._id);
        });
        if (rejections.length > 0) throw bulkRejectedError(rejections, ids.length);

        for (const id of changing) await this.assign(id, String(agent._id), actor);
        return { requested: ids.length, updated: changing.length, unchanged: ids.length - changing.length };
    },

    // Several tickets to one status, all or nothing, each held to the lifecycle the single move enforces
    // (including who may make it). A ticket already in that status is left alone and counted as
    // unchanged, as re-sending a status is for one ticket.
    async bulkStatus(ids, status, actor) {
        assertBulkSize(ids);
        const now = new Date();
        const { rejections, changing } = await collectRejections(ids, (ticket) => {
            assertCanView(ticket, actor);
            if (ticket.status === status) return false;
            assertTransitionAllowed(ticket, status, actor, now);
            return true;
        });
        if (rejections.length > 0) throw bulkRejectedError(rejections, ids.length);

        for (const id of changing) await this.update(id, { status }, actor);
        return { requested: ids.length, updated: changing.length, unchanged: ids.length - changing.length };
    },

    // Several tickets to one priority, all or nothing. A closed ticket is read-only, as it is for one
    // ticket, and each change recomputes that ticket's SLA window from now exactly as the single edit
    // does. A ticket already at that priority is left alone and counted as unchanged.
    async bulkPriority(ids, priority, actor) {
        assertBulkSize(ids);
        const { rejections, changing } = await collectRejections(ids, (ticket) => {
            assertCanView(ticket, actor);
            assertNotClosed(ticket);
            return ticket.priority !== priority;
        });
        if (rejections.length > 0) throw bulkRejectedError(rejections, ids.length);

        for (const id of changing) await this.update(id, { priority }, actor);
        return { requested: ids.length, updated: changing.length, unchanged: ids.length - changing.length };
    },

    // The tickets this one could be merged into: the same customer's other tickets that are still in
    // play and that this person may see. The page offers exactly these, so it never offers a merge the
    // API would refuse.
    async getMergeCandidates(id, actor) {
        const ticket = await ticketRepository.findByIdLean(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        const candidates = await ticketRepository.findMergeCandidates(ticket.createdBy._id, ticket._id);
        return candidates
            .filter((candidate) => canSee(candidate, actor) && !mergeBlock(ticket, candidate))
            .map((candidate) => ({
                _id: candidate._id,
                title: candidate.title,
                status: candidate.status,
                priority: candidate.priority,
                createdAt: candidate.createdAt,
                replyCount: candidate.replies.length,
            }));
    },

    // Folds a duplicate into the ticket the conversation should continue on: every reply moves over in
    // the order it was written (the duplicate's opening message with them), the duplicate is closed for
    // good with a link to the other ticket, both histories record it, and the customer is told where to
    // look. The primary keeps its own SLA clock, status and assignee.
    async merge(duplicateId, primaryId, actor) {
        const [duplicate, primary] = await Promise.all([ticketRepository.findById(duplicateId), ticketRepository.findById(primaryId)]);
        if (!duplicate) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        if (!primary) throw new AppError(404, "TICKET_NOT_FOUND", "The ticket to merge into was not found.");
        assertCanView(duplicate, actor);
        assertCanView(primary, actor);
        assertMergeAllowed(duplicate, primary);

        const now = new Date();
        const moved = duplicate.replies.length;
        const previousStatus = duplicate.status;
        primary.replies = mergedReplies(primary, duplicate);
        duplicate.replies = [];
        duplicate.status = "closed";
        duplicate.closedAt = now;
        duplicate.mergedInto = primary._id;

        await ticketRepository.save(primary);
        await ticketRepository.save(duplicate);
        await auditLogService.record(duplicate._id, "merged", actor.id, {
            mergedInto: { id: String(primary._id), number: ticketNumber(primary), title: primary.title },
            status: { from: previousStatus, to: "closed" },
            repliesMoved: moved,
        });
        await auditLogService.record(primary._id, "merged", actor.id, {
            mergedFrom: { id: String(duplicate._id), number: ticketNumber(duplicate), title: duplicate.title },
            repliesMoved: moved,
        });
        await notificationService.notify(
            primary.createdBy?._id || primary.createdBy,
            "ticket_merged",
            `Your ticket "${duplicate.title}" was merged into "${primary.title}". The conversation continues there.`,
            primary._id,
        );

        return presentTicketDetail(await ticketRepository.findByIdDetail(primary._id, REPLY_PAGE_SIZE), actor);
    },

    // What deactivating this agent would do, for the confirmation to say before anything happens: how
    // many open tickets move and to whom, how many wait in the unassigned queue, and whether the
    // deactivation is refused because they are the last cover for a category that still has work.
    async previewReassignment(agent) {
        const [tickets, candidates] = await Promise.all([
            ticketRepository.findOpenAssignedTo(agent._id, ACTIVE_STATUSES),
            authRepository.findAgentsWithWorkload(),
        ]);
        const others = candidates.filter((candidate) => String(candidate._id) !== String(agent._id));
        const categories = normalizeCategories(agent.categories);
        const [cover, open] = await Promise.all([
            authRepository.countActiveCoverByCategories(categories, agent._id),
            ticketRepository.countOpenByCategories(categories, ACTIVE_STATUSES),
        ]);

        const blocked = lastCoverBlock(agent, cover, open);
        const { moves, toQueue } = planReassignments(tickets, others);
        const perAgent = new Map();
        for (const { to } of moves)
            perAgent.set(String(to._id), { agentId: String(to._id), name: to.name, count: (perAgent.get(String(to._id))?.count || 0) + 1 });

        return {
            openTickets: tickets.length,
            reassignTo: [...perAgent.values()],
            toQueue: toQueue.length,
            blocked: blocked.map((entry) => ({ ...entry, label: categoryLabel(entry.category) })),
            blockedReason: blocked.length > 0 ? lastCoverMessage(agent, blocked) : null,
            moves,
            queued: toQueue,
        };
    },

    // Applies that plan: each open ticket goes to its new agent (told so) or to the unassigned queue
    // (the admins told instead), and every move is on the ticket's audit trail.
    async reassignOpenTickets(agent, plan, actor) {
        for (const { ticket, to } of plan.moves) {
            ticket.assignedTo = to._id;
            ticket.unassignedNotifiedAt = null;
            await ticketRepository.save(ticket);
            await auditLogService.record(ticket._id, "assigned", actor.id, {
                assignedTo: to.name,
                reason: `${agent.name} was deactivated`,
            });
            await notificationService.notify(
                to._id,
                "ticket_assigned",
                `You were assigned ticket "${ticket.title}" because ${agent.name} was deactivated.`,
                ticket._id,
            );
        }
        if (plan.queued.length === 0) return;
        const adminIds = await authRepository.findAdminIds();
        const now = new Date();
        for (const ticket of plan.queued) {
            ticket.assignedTo = null;
            ticket.unassignedNotifiedAt = now;
            await ticketRepository.save(ticket);
            await auditLogService.record(ticket._id, "unassigned", actor.id, { from: agent.name, reason: `${agent.name} was deactivated` });
            await notificationService.notifyMany(
                adminIds,
                "ticket_unassigned",
                `Ticket "${ticket.title}" is in ${categoryLabel(ticket.category)} with no agent covering it, and is waiting to be picked up.`,
                ticket._id,
            );
        }
    },

    // An internal note is a working note: its author (or an admin) can correct it while it is fresh.
    async updateReply(id, replyId, body, actor) {
        const { ticket, reply } = await findReplyForEdit(id, replyId, actor);

        reply.body = body;
        reply.editedAt = new Date();
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "note_edited", actor.id, { replyId: String(reply._id) });

        return presentTicketDetail(await ticketRepository.findByIdDetail(ticket._id, REPLY_PAGE_SIZE), actor);
    },

    async deleteReply(id, replyId, actor) {
        const { ticket, reply } = await findReplyForEdit(id, replyId, actor);

        reply.deleteOne();
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "note_deleted", actor.id, { replyId: String(replyId) });

        return presentTicketDetail(await ticketRepository.findByIdDetail(ticket._id, REPLY_PAGE_SIZE), actor);
    },

    async addReply(id, actor, { body, isInternal }) {
        const ticket = await ticketRepository.findById(id);
        if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
        assertCanView(ticket, actor);
        // A closed ticket's conversation is a record of what happened.
        assertNotClosed(ticket);

        const internal = actor.role === "customer" ? false : Boolean(isInternal);
        const now = new Date();

        // A public staff reply starts work on an open ticket; an internal note never moves it. A
        // customer's reply on a pending ticket hands it back to the team, and on a resolved ticket
        // reopens it. Only the reopen starts a fresh SLA period: a pending ticket is still inside
        // the period it was already in, so its clock, and any breach on it, carry on unchanged.
        // Where the reply puts the ticket is decided before it is written, so a reply the ticket has
        // no room for leaves the status alone as well.
        const isCustomer = actor.role === "customer";
        const autoStatus = isCustomer ? statusAfterCustomerReply(ticket) : statusAfterStaffReply(ticket, internal);

        // The conversation is capped, and the cap is applied by the write itself rather than by a count
        // read beforehand: the push matches only while the ticket is still under the limit, so two
        // replies sent in the same moment cannot both get in past it. No match means it is full.
        const pushed = await ticketRepository.pushReply(id, { body, author: actor.id, isInternal: internal, createdAt: now }, REPLY_LIMIT);
        if (pushed.matchedCount === 0) {
            // The ticket was there a moment ago, so a push that matches nothing means it is full,
            // unless it has been removed in between.
            if (!(await ticketRepository.exists(id))) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
            throw replyLimitError();
        }

        const changes = {};
        let reopened = false;
        if (autoStatus) reopened = await applyStatusChange(ticket, autoStatus, now, changes);

        // The reply is already stored, and this document's own `replies` was never touched, so saving
        // it writes the status and the clock without putting a stale conversation back.
        await ticketRepository.save(ticket);
        await auditLogService.record(ticket._id, "replied", actor.id, { isInternal: internal });
        if (changes.status) {
            await auditLogService.record(ticket._id, reopened ? "reopened" : "updated", actor.id, { ...changes, trigger: "reply" });
        }

        // Only a public reply is announced, and it says who wrote it: a notification that names the
        // person is worth opening. An internal note tells nobody, least of all the customer, who must
        // never learn it exists.
        if (!internal) {
            const announcement = `${actor.name} replied on "${ticket.title}".`;
            if (actor.role === "customer" && ticket.assignedTo) {
                await notificationService.notify(ticket.assignedTo, "ticket_reply", announcement, ticket._id);
            } else if (actor.role !== "customer" && String(ticket.createdBy) !== actor.id) {
                await notificationService.notify(ticket.createdBy, "ticket_reply", announcement, ticket._id);
            }
        }

        return presentTicketDetail(await ticketRepository.findByIdDetail(ticket._id, REPLY_PAGE_SIZE), actor);
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
