// The ticket page is given the latest page of a conversation and walks back through the older ones on
// request, so it has to keep what it has already shown. These are the pure pieces of that: no React,
// no fetching, so each one can be reasoned about (and tested) on its own.

// One page of replies, matching the page the API hands out.
export const REPLY_PAGE_SIZE = 50;

// The thread after folding in the page the server has just sent. That page is the authoritative record
// of its own stretch of the conversation: a reply held from inside it that the page no longer lists was
// deleted, so it goes, while everything older than the page is ours to keep. Without this, sending a
// reply (which moves the latest page on by one) would quietly drop the message that fell off the start.
export function mergeReplyWindow(held, page) {
    if (page.length === 0) return held;
    const pageIds = new Set(page.map((reply) => reply._id));
    const pageStart = new Date(page[0].createdAt).getTime();
    const older = held.filter((reply) => !pageIds.has(reply._id) && new Date(reply.createdAt).getTime() < pageStart);
    return [...older, ...page];
}

// How many replies this viewer could still read behind the ones on screen. A customer's count leaves out
// internal notes, exactly as their thread does, so the button never promises messages they cannot see.
export function earlierReplyCount(visibleReplyCount, shownCount) {
    return Math.max(0, (visibleReplyCount || 0) - shownCount);
}

// The follow-up ticket's title, kept inside the 140 characters a title allows.
export function followUpTitle(title) {
    return `Follow-up: ${title}`.slice(0, 140);
}
