import { AppError } from "../../shared/errors/app-error.js";

// Who may change an internal note, and for how long. Pure rules, no database access.

// A note is a working note: its author can correct a typo straight away, but nobody rewrites the
// team's record of a conversation days later.
export const NOTE_EDIT_WINDOW_MINUTES = 15;

export function noteEditWindowEndsAt(reply) {
    const postedAt = reply.createdAt ? new Date(reply.createdAt) : null;
    if (!postedAt) return null;
    return new Date(postedAt.getTime() + NOTE_EDIT_WINDOW_MINUTES * 60 * 1000);
}

function isAuthor(reply, actor) {
    return String(reply.author?._id || reply.author) === actor.id;
}

// What stops this person changing this note, as the status code, error code and message to answer
// with. `null` means they may. Only the author or an admin qualifies, and only inside the window:
// an admin is included because somebody has to be able to remove a note that should never have been
// written.
export function noteEditBlock(reply, actor, now = new Date()) {
    if (!reply.isInternal) {
        return {
            status: 403,
            code: "FORBIDDEN",
            message: "Only internal notes can be edited or deleted. A public reply the customer has already read stays as it was sent.",
        };
    }
    if (actor.role !== "admin" && !isAuthor(reply, actor)) {
        return { status: 403, code: "FORBIDDEN", message: "Only the person who wrote this note, or an admin, can edit or delete it." };
    }
    const windowEnd = noteEditWindowEndsAt(reply);
    if (windowEnd && windowEnd.getTime() < now.getTime()) {
        // The request is valid and the person is allowed; the window has closed. That is a business
        // rule about time, not a permission, hence 422.
        return {
            status: 422,
            code: "EDIT_WINDOW_EXPIRED",
            message: `Internal notes can be edited for ${NOTE_EDIT_WINDOW_MINUTES} minutes after they are posted. This one is now part of the ticket's record.`,
        };
    }
    return null;
}

// Whether the Edit and Delete controls belong on this note for this viewer.
export function canEditNote(reply, actor, now = new Date()) {
    return noteEditBlock(reply, actor, now) === null;
}

// A note whose window has closed is still the author's (or an admin's) note, so the page says why the
// controls are gone instead of showing nothing. Somebody else's note shows no trace of them at all.
export function noteEditBlockedReason(reply, actor, now = new Date()) {
    if (!reply.isInternal) return null;
    if (actor.role !== "admin" && !isAuthor(reply, actor)) return null;
    return noteEditBlock(reply, actor, now)?.message || null;
}

export function assertNoteEditable(reply, actor, now = new Date()) {
    const blocked = noteEditBlock(reply, actor, now);
    if (blocked) throw new AppError(blocked.status, blocked.code, blocked.message);
}
