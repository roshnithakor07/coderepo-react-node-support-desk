import { AppError } from "../../shared/errors/app-error.js";

// How long a conversation may grow, and how it is read back a page at a time. Pure rules with no
// database access: the repository applies the limit atomically and the service maps a refused push
// onto the error below.

// Replies live inside the ticket document, and a MongoDB document cannot exceed 16 MB. A capped
// conversation keeps every ticket well inside that, so a long thread ends with a clear refusal and a
// follow-up ticket instead of a 500 nobody can act on. Public replies and internal notes count
// together, because both take up the same room.
export const REPLY_LIMIT = 500;

// One page of a conversation, for the ticket itself (its latest page) and for the older pages behind
// it. Also the largest page the paging endpoint will hand out.
export const REPLY_PAGE_SIZE = 50;

// The threshold where the ticket page starts warning that the conversation is filling up, early
// enough that nobody is surprised by the refusal.
export const REPLY_LIMIT_NOTICE_FROM = 450;

export const REPLY_LIMIT_MESSAGE = `This ticket has reached ${REPLY_LIMIT} replies. Open a follow-up ticket to continue.`;

// The request is valid and the person is allowed; the ticket is full. That is a business rule about
// size, not a permission or a conflicting state, hence 422.
export function replyLimitError() {
    return new AppError(422, "REPLY_LIMIT_REACHED", REPLY_LIMIT_MESSAGE);
}

// Merging carries the duplicate's replies, and its opening message, onto the primary. A merge that
// would push the primary past the limit is refused before anything moves, so the cap holds however
// replies arrive.
export function mergeReplyLimitBlock(duplicate, primary) {
    const total = primary.replies.length + duplicate.replies.length + 1;
    if (total <= REPLY_LIMIT) return null;
    return {
        status: 422,
        code: "MERGE_REPLY_LIMIT",
        message: `Merging would give the ticket ${total} replies, over the limit of ${REPLY_LIMIT}. Answer on each ticket separately instead.`,
    };
}
