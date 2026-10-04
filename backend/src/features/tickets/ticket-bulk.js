import { AppError } from "../../shared/errors/app-error.js";

// Rules for acting on several tickets at once. Pure, with no database access. A bulk action is
// all-or-nothing: every ticket is checked against the same rule the single-ticket action enforces, and
// if any of them fails nothing is changed and the answer says which ones failed and why.

// One request cannot move an unbounded part of the board, and the page only selects from one page of
// the list anyway.
export const BULK_LIMIT = 50;

// What a person reads about one ticket that blocked the action. The title is there because a list of
// ids tells them nothing.
export function toRejection(ticket, error, ticketId) {
    return {
        ticketId: String(ticket?._id || ticketId),
        title: ticket?.title || null,
        code: error.code,
        message: error.message,
    };
}

function countPhrase(count, singular) {
    return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

// 422: the request is well formed and the person is allowed to ask, but at least one ticket breaks a
// rule. Nothing was changed, and the message says so first because that is what they most need to know.
export function bulkRejectedError(rejections, total) {
    const first = rejections[0];
    const lead = `Nothing was changed. ${rejections.length} of ${countPhrase(total, "ticket")} cannot be updated`;
    const detail = first.title ? `, for example "${first.title}": ${first.message}` : `: ${first.message}`;
    return new AppError(422, "BULK_REJECTED", `${lead}${detail}`, { rejections });
}

// The same id twice would be counted and applied twice, so it is refused up front.
export function hasDuplicates(ids) {
    return new Set(ids.map(String)).size !== ids.length;
}
