import { AppError } from "../../shared/errors/app-error.js";
import { mergeReplyLimitBlock } from "./ticket-replies.js";

// Merging a duplicate into the ticket the conversation should continue on. Pure rules with no
// database access: the service loads both tickets and applies what this module decides.

// The same short number the page shows, so a message names the ticket the way people see it.
export function ticketNumber(ticket) {
    return `#${String(ticket._id).slice(-6)}`;
}

function requesterId(ticket) {
    return String(ticket.createdBy?._id || ticket.createdBy);
}

// Why these two tickets cannot be merged, as the status, code and message to answer with; null when
// they can. Merging into itself and mixing customers are requests that can never make sense (422); a
// closed ticket is a state that would have to change first (409), and its message says how.
export function mergeBlock(duplicate, primary) {
    if (String(duplicate._id) === String(primary._id)) {
        return {
            status: 422,
            code: "MERGE_INTO_ITSELF",
            message: "A ticket can't be merged into itself. Choose the other ticket it duplicates.",
        };
    }
    if (requesterId(duplicate) !== requesterId(primary)) {
        return {
            status: 422,
            code: "MERGE_DIFFERENT_CUSTOMERS",
            message: `${ticketNumber(duplicate)} and ${ticketNumber(primary)} were raised by different customers. Only a customer's own duplicates can be merged, so nobody is shown another customer's conversation.`,
        };
    }
    for (const [ticket, role] of [
        [duplicate, "duplicate"],
        [primary, "ticket to merge into"],
    ]) {
        if (ticket.status === "closed") {
            return {
                status: 409,
                code: "TICKET_CLOSED",
                message: `The ${role}, ${ticketNumber(ticket)}, is closed, and a closed ticket's conversation is a record that can't be merged. Reopen it first if it is still needed.`,
            };
        }
    }
    // Checked last, because it is the one reason that depends on how long the two conversations are
    // rather than on what either ticket is.
    return mergeReplyLimitBlock(duplicate, primary);
}

export function assertMergeAllowed(duplicate, primary) {
    const blocked = mergeBlock(duplicate, primary);
    if (blocked) throw new AppError(blocked.status, blocked.code, blocked.message);
}

function plainReply(reply) {
    return {
        _id: reply._id,
        body: reply.body,
        author: reply.author?._id || reply.author,
        isInternal: reply.isInternal,
        createdAt: reply.createdAt,
        editedAt: reply.editedAt || null,
    };
}

// The primary's conversation after the merge: its own replies and the duplicate's, in the order they
// were written. The duplicate's opening message comes along as a reply from its customer, dated when it
// was sent, so nothing they wrote is lost and the thread still reads in time order.
export function mergedReplies(primary, duplicate) {
    const opening = {
        body: `Merged from ${ticketNumber(duplicate)} "${duplicate.title}":\n\n${duplicate.description}`,
        author: duplicate.createdBy?._id || duplicate.createdBy,
        isInternal: false,
        createdAt: duplicate.createdAt,
        editedAt: null,
    };
    return [...primary.replies.map(plainReply), opening, ...duplicate.replies.map(plainReply)].sort(
        (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
    );
}
