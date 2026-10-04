import { AppError } from "../../shared/errors/app-error.js";

// Every lifecycle rule lives here: one pure module with no database access, so the service reads as
// a sequence of decisions and the rules can be reasoned about (and tested) on their own.

export const TICKET_STATUSES = ["open", "in_progress", "pending", "resolved", "closed"];

// Statuses where the SLA clock is running. Moving back into one of them from a finished status
// restarts the clock.
export const ACTIVE_STATUSES = ["open", "in_progress", "pending"];

export const FINISHED_STATUSES = ["resolved", "closed"];

// A closed ticket is archived after this long: the conversation is over and the customer opens a
// new ticket instead of reviving a two-week-old thread.
export const REOPEN_WINDOW_DAYS = 14;

// How statuses read in messages people see, instead of the raw stored values.
export const STATUS_LABELS = {
    open: "Open",
    in_progress: "In Progress",
    pending: "Pending",
    resolved: "Resolved",
    closed: "Closed",
};

// The lifecycle, exactly one step at a time:
//
//   open -> in_progress -> pending <-> in_progress -> resolved -> closed
//                                                        |          |
//                                                        +-> open <-+   (reopen)
//
// Nothing skips a step (an open ticket cannot jump to closed) and nothing runs backwards except the
// reopen, which is the one deliberate way back and carries its own rules.
const TRANSITIONS = {
    open: ["in_progress"],
    in_progress: ["pending", "resolved"],
    pending: ["in_progress"],
    resolved: ["closed", "open"],
    closed: ["open"],
};

// What a customer may do to their own ticket: finish it once the team has resolved it, or ask for it
// back. Everything else on the board is the support team's to move.
const CUSTOMER_TRANSITIONS = {
    resolved: ["closed", "open"],
    closed: ["open"],
};

// Fields only the support team may edit, whatever state the ticket is in: how urgent it is, where it
// is filed and how it is tagged are the team's calls, not the requester's.
export const STAFF_ONLY_FIELDS = ["priority", "category", "tags"];

// What a requester may correct on their own ticket, while the correction can still be acted on.
export const REQUESTER_FIELDS = ["title", "description"];

export function isActiveStatus(status) {
    return ACTIVE_STATUSES.includes(status);
}

// A move from a finished status back into the working queue. The one way backwards.
export function isReopen(from, to) {
    return FINISHED_STATUSES.includes(from) && ACTIVE_STATUSES.includes(to);
}

// When the ticket entered `closed`. `closedAt` is written from the moment the rule shipped; older
// tickets fall back to the resolve stamp and then to the last write, so the window can always be
// measured on records that predate the field.
export function closedAtOf(ticket) {
    return ticket.closedAt || ticket.resolvedAt || ticket.updatedAt || ticket.createdAt;
}

export function reopenWindowEndsAt(ticket) {
    const closedAt = closedAtOf(ticket);
    if (!closedAt) return null;
    return new Date(new Date(closedAt).getTime() + REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

// The reopen window applies to closed tickets only: a resolved ticket is still an open conversation
// the customer may not agree is finished.
export function reopenBlockedReason(ticket, now = new Date()) {
    if (ticket.status !== "closed") return null;
    // A merged duplicate has no conversation of its own left to come back to.
    if (ticket.mergedInto) {
        const into = ticket.mergedInto._id || ticket.mergedInto;
        return `This ticket was merged into #${String(into).slice(-6)}, where its conversation now continues. Reply there instead.`;
    }
    const windowEnd = reopenWindowEndsAt(ticket);
    if (!windowEnd || windowEnd.getTime() >= now.getTime()) return null;
    return `This ticket was closed more than ${REOPEN_WINDOW_DAYS} days ago and can no longer be reopened. Please open a new ticket and reference this one.`;
}

// Resolving says "we answered you", so there has to be an answer the customer can read. Internal
// notes are invisible to them and do not count.
export function hasPublicStaffReply(ticket) {
    // The ticket page is sent one page of the conversation at a time, and the answer may be older than
    // that page, so a ticket presented that way carries the count instead of every reply.
    if (typeof ticket.publicStaffReplyCount === "number") return ticket.publicStaffReplyCount > 0;
    return (ticket.replies || []).some((reply) => !reply.isInternal && replyAuthorIsStaff(reply, ticket));
}

// Replies store the author id, not the role, so a reply counts as staff when it is not the
// requester's. Populated and unpopulated documents both reach this code, hence the `_id` dance.
function replyAuthorIsStaff(reply, ticket) {
    const authorId = String(reply.author?._id || reply.author);
    const requesterId = String(ticket.createdBy?._id || ticket.createdBy);
    return authorId !== requesterId;
}

// The statuses this actor may move this ticket to right now. The status control offers exactly
// these, so the UI can never present a move the API will reject.
export function allowedNextStatuses(ticket, actor, now = new Date()) {
    const table = actor.role === "customer" ? CUSTOMER_TRANSITIONS : TRANSITIONS;
    return (table[ticket.status] || []).filter((next) => {
        if (isReopen(ticket.status, next) && reopenBlockedReason(ticket, now)) return false;
        if (next === "resolved" && !hasPublicStaffReply(ticket)) return false;
        return true;
    });
}

// Why `resolved` is not on offer yet, for the UI to show next to the disabled option.
export function resolveBlockedReason(ticket) {
    if (!TRANSITIONS[ticket.status]?.includes("resolved")) return null;
    if (hasPublicStaffReply(ticket)) return null;
    return "Send a public reply to the customer before resolving this ticket.";
}

export function closedReason(ticket) {
    if (ticket.status !== "closed") return null;
    return "This ticket is closed, so its conversation and fields are read-only. Reopen it to make changes.";
}

// A closed ticket is a record of what happened: no replies, no edits, no reassignment. Reopening it
// is a status change, which is why it is checked separately from this guard.
export function assertNotClosed(ticket) {
    if (ticket.status === "closed") {
        throw new AppError(409, "TICKET_CLOSED", closedReason(ticket));
    }
}

export function assertTransitionAllowed(ticket, next, actor, now = new Date()) {
    const current = ticket.status;
    if (current === next) return;

    if (!TRANSITIONS[current]?.includes(next)) {
        const valid = TRANSITIONS[current] || [];
        const options = valid.length > 0 ? valid.map((status) => STATUS_LABELS[status]).join(" or ") : "nothing";
        throw new AppError(
            409,
            "INVALID_TRANSITION",
            `A ${STATUS_LABELS[current]} ticket cannot move straight to ${STATUS_LABELS[next]}. From here it can only move to ${options}.`,
        );
    }

    // A merged duplicate's conversation lives on another ticket now, which is a state, not a window.
    if (isReopen(current, next) && ticket.mergedInto) {
        throw new AppError(409, "TICKET_MERGED", reopenBlockedReason(ticket, now));
    }

    // The reopen window is a business rule on a legal move, not a conflicting state, so it is 422.
    if (isReopen(current, next)) {
        const blocked = reopenBlockedReason(ticket, now);
        if (blocked) throw new AppError(422, "REOPEN_WINDOW_EXPIRED", blocked);
    }

    if (next === "resolved" && !hasPublicStaffReply(ticket)) {
        throw new AppError(422, "RESOLUTION_REQUIRES_REPLY", resolveBlockedReason(ticket));
    }

    // Role check last, so a customer asking for an impossible move hears why it is impossible rather
    // than only that it is not theirs to make.
    if (actor.role === "customer" && !(CUSTOMER_TRANSITIONS[current] || []).includes(next)) {
        throw new AppError(
            403,
            "FORBIDDEN",
            `Only the support team can move this ticket to ${STATUS_LABELS[next]}. You can close or reopen a resolved ticket.`,
        );
    }
}

// A requester can still fix what they wrote while nobody has acted on it: the ticket is open and the
// team has not answered yet. After that the description is what the answer was written against, so
// changing it would leave the conversation talking about a question that is no longer there. A reply
// is the way to add to it.
export function requesterEditBlockedReason(ticket) {
    // The answer is the more specific cause, and the usual one: a staff reply is also what moves an
    // open ticket into progress, so checking the status first would report the symptom.
    if (hasPublicStaffReply(ticket)) {
        return "Our team has already replied to this ticket, so its title and description are fixed. Add a reply instead and we will pick it up.";
    }
    if (ticket.status !== "open") {
        return "Work has already started on this ticket, so its title and description are fixed. Add a reply instead and we will pick it up.";
    }
    return null;
}

// A customer may send `status`, and their own title and description while the ticket is still
// untouched. Priority, category and tags belong to the team working the ticket.
export function assertPatchAllowed(patch, ticket, actor) {
    if (actor.role !== "customer") return;

    const staffField = STAFF_ONLY_FIELDS.find((field) => patch[field] !== undefined);
    if (staffField) {
        throw new AppError(
            403,
            "FORBIDDEN",
            "Only the support team can set a ticket's priority, category and tags. Reply on the ticket if something has changed.",
        );
    }

    const editsOwnFields = REQUESTER_FIELDS.some((field) => patch[field] !== undefined);
    if (!editsOwnFields) return;
    const blocked = requesterEditBlockedReason(ticket);
    // The ticket has moved on, which is a conflict with its state rather than a permission failure.
    if (blocked) throw new AppError(409, "TICKET_LOCKED", blocked);
}

// Where a customer's reply puts a ticket that was waiting or already finished. `pending` means the
// team was waiting on them, so their answer hands it back; `resolved` means they disagree it is done.
export function statusAfterCustomerReply(ticket) {
    if (ticket.status === "pending") return "in_progress";
    if (ticket.status === "resolved") return "open";
    return null;
}

// Only a public staff reply starts work: an internal note is the team talking to itself and must
// leave the status alone.
export function statusAfterStaffReply(ticket, isInternal) {
    if (isInternal) return null;
    return ticket.status === "open" ? "in_progress" : null;
}

// Everything the ticket page needs to hide or disable an action and say why, derived from the same
// rules the API enforces so the two can never drift apart.
export function permissionsFor(ticket, actor, now = new Date()) {
    const isRequester = String(ticket.createdBy?._id || ticket.createdBy) === actor.id;
    const isStaff = actor.role === "admin" || actor.role === "agent";
    const closed = ticket.status === "closed";
    const requesterEditBlocked = isRequester && !isStaff ? requesterEditBlockedReason(ticket) : null;

    return {
        nextStatuses: allowedNextStatuses(ticket, actor, now),
        canChangeStatus: allowedNextStatuses(ticket, actor, now).length > 0,
        canReply: !closed,
        canEditFields: isStaff && !closed,
        canAssign: isStaff && !closed,
        // A requester edits their own wording while the ticket is untouched; the team edits it for as
        // long as the ticket is open at all.
        canEditDetails: isStaff ? !closed : isRequester && !requesterEditBlocked,
        requesterEditBlockedReason: requesterEditBlocked,
        resolveBlockedReason: isStaff ? resolveBlockedReason(ticket) : null,
        closedReason: closedReason(ticket),
        reopenBlockedReason: reopenBlockedReason(ticket, now),
        reopenWindowEndsAt: closed ? reopenWindowEndsAt(ticket) : null,
        // A customer sees their own close and reopen buttons; staff use the status control.
        canCloseAsRequester: isRequester && allowedNextStatuses(ticket, actor, now).includes("closed"),
        canReopenAsRequester: isRequester && FINISHED_STATUSES.includes(ticket.status) && !reopenBlockedReason(ticket, now),
    };
}
