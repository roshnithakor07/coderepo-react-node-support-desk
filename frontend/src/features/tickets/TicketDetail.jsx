import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PriorityBadge, StatusBadge } from "../../shared/components/Badge.jsx";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { ArrowLeftIcon, LockIcon } from "../../shared/components/Icon.jsx";
import { formatDateTime, formatSlaCountdown, getSlaProgress, initials, ticketNumber } from "../../shared/utils/format.js";
import { useFitsInView } from "../../shared/utils/pinning.js";
import { MergeTicketModal } from "./MergeTicketModal.jsx";
import { REPLY_PAGE_SIZE, earlierReplyCount, mergeReplyWindow } from "./reply-thread.js";
import { StatusHistory } from "./StatusHistory.jsx";
import { TicketProperties } from "./TicketProperties.jsx";

const COMPOSER_MAX_HEIGHT = 200;
// The pinned header (64px) plus the gaps above and below the right-hand column.
const SIDE_COLUMN_RESERVED_HEIGHT = 64 + 8 + 12;

// An internal note its author (or an admin) may still change, while the edit window is open. The
// server sends `canEdit` and, once the window has closed, the reason it is gone.
function NoteActions({ reply, onEdit, onDelete, isBusy }) {
    if (reply.canEdit) {
        return (
            <div className="message-card-actions">
                <button type="button" className="link-button row-action" onClick={onEdit} disabled={isBusy}>
                    Edit
                </button>
                <button type="button" className="link-button row-action" onClick={onDelete} disabled={isBusy}>
                    Delete
                </button>
            </div>
        );
    }
    if (!reply.editBlockedReason) return null;
    return <p className="message-card-note-reason">{reply.editBlockedReason}</p>;
}

function NoteEditor({ reply, onSave, onCancel, isBusy }) {
    const [body, setBody] = useState(reply.body);
    const [error, setError] = useState("");

    function submit(event) {
        event.preventDefault();
        const trimmed = body.trim();
        if (!trimmed) {
            setError("An internal note cannot be empty. Delete it instead.");
            return;
        }
        setError("");
        onSave(trimmed);
    }

    return (
        <form className="message-card-editor" onSubmit={submit} noValidate>
            <label htmlFor={`note-${reply._id}`} className="visually-hidden">
                Edit internal note
            </label>
            <textarea
                id={`note-${reply._id}`}
                value={body}
                onChange={(event) => {
                    setBody(event.target.value);
                    if (error) setError("");
                }}
                rows={3}
                maxLength={5000}
                aria-invalid={Boolean(error)}
                className={`reply-body-internal ${error ? "field-invalid" : ""}`}
                disabled={isBusy}
                autoFocus
            />
            {error && <span className="field-error">{error}</span>}
            <div className="message-card-editor-actions">
                <button type="button" className="button-secondary button-compact" onClick={onCancel} disabled={isBusy}>
                    Cancel
                </button>
                <button type="submit" className="button-primary button-compact" disabled={isBusy}>
                    {isBusy && <span className="spinner" aria-hidden="true" />}
                    {isBusy ? "Saving..." : "Save note"}
                </button>
            </div>
        </form>
    );
}

function MessageCard({ replyId, author, body, isInternal, createdAt, editedAt, innerRef, actions, editor }) {
    return (
        <li ref={innerRef} data-reply-id={replyId} className={`message-card ${isInternal ? "message-card-internal" : ""}`}>
            <div className="message-card-header">
                <span className="message-card-avatar">{initials(author?.name)}</span>
                <span className="message-card-meta">
                    <span className="message-card-name">{author?.name}</span>
                    {author?.role && <span className="tag">{author.role}</span>}
                </span>
                <span className="message-card-trailer">
                    {isInternal && (
                        <span className="internal-note-chip">
                            <LockIcon /> Internal Note
                        </span>
                    )}
                    <span className="message-card-time">
                        {formatDateTime(createdAt)}
                        {editedAt && <span className="message-card-edited"> · edited</span>}
                    </span>
                </span>
            </div>
            {editor || <p className="message-card-body">{body}</p>}
            {!editor && actions}
        </li>
    );
}

export function TicketDetail({
    ticket,
    currentUser,
    agents,
    cannedResponses,
    auditTrail,
    auditTrailError,
    onRetryAuditTrail,
    statusHistory,
    statusHistoryError,
    onRetryStatusHistory,
    onBack,
    onUpdate,
    onReply,
    onAssign,
    onClaim,
    onEditNote,
    onDeleteNote,
    onEditDetails,
    onMerge,
    onLoadEarlierReplies,
    onOpenFollowUp,
    isReplying,
    isUpdating,
    isSavingNote,
}) {
    const sideColumnRef = useRef(null);
    const sideColumnFits = useFitsInView(sideColumnRef, ".app-content", SIDE_COLUMN_RESERVED_HEIGHT);
    const [replyBody, setReplyBody] = useState("");
    const [replyError, setReplyError] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [showCanned, setShowCanned] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [noteToDelete, setNoteToDelete] = useState(null);
    const [showMerge, setShowMerge] = useState(false);
    const replyFieldRef = useRef(null);
    const latestMessageRef = useRef(null);
    const messageListRef = useRef(null);

    const canManage = currentUser.role === "admin" || currentUser.role === "agent";
    const permissions = ticket.permissions || {};
    // A closed ticket's conversation is a record of what happened, and a full one has no room left, so
    // the composer is replaced by the reason it is gone rather than left there to fail on submit.
    const canReply = permissions.canReply !== false;
    const replyLimitReason = permissions.replyLimitReason || "";
    const latestReplies = canManage ? ticket.replies : ticket.replies.filter((reply) => !reply.isInternal);
    const sla = getSlaProgress(ticket.slaStartedAt || ticket.createdAt, ticket.slaDeadline, ticket.slaBreached);

    // Only the latest page of a long conversation arrives with the ticket, so the page keeps what it has
    // shown: the pages loaded by "Show earlier replies", and the latest page folded in each time it moves
    // on. `hasEarlier` starts from the reply count, because a full first page means there is more behind it.
    const [thread, setThread] = useState(latestReplies);
    const [earlierCursor, setEarlierCursor] = useState(ticket.oldestReplyId || null);
    const [hasEarlier, setHasEarlier] = useState((ticket.replyCount || 0) > REPLY_PAGE_SIZE);
    const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
    const [earlierError, setEarlierError] = useState("");
    // Where the reader was when they asked for older replies, so the thread can grow above them without
    // the message they were reading jumping off the screen.
    const scrollAnchorRef = useRef(null);

    // A different ticket starts again from its own latest page.
    useEffect(() => {
        setThread(canManage ? ticket.replies : ticket.replies.filter((reply) => !reply.isInternal));
        setEarlierCursor(ticket.oldestReplyId || null);
        setHasEarlier((ticket.replyCount || 0) > REPLY_PAGE_SIZE);
        setEarlierError("");
        // Only the ticket identity resets the thread; a new reply on the same ticket is folded in below.
    }, [ticket._id]);

    // Replying, editing a note or changing the status all return the ticket with its latest page, which
    // may have moved on by a message. Folding it in keeps the thread whole either way.
    useEffect(() => {
        setThread((current) => mergeReplyWindow(current, latestReplies));
    }, [ticket.replies]);

    // The ticket opens at its header (App scrolls the content area to the top). Only a message added
    // during this visit scrolls, and then only to the new message, never on the way in.
    const replyCountRef = useRef(latestReplies.length);
    useEffect(() => {
        if (latestReplies.length > replyCountRef.current) {
            latestMessageRef.current?.scrollIntoView({ block: "nearest" });
        }
        replyCountRef.current = latestReplies.length;
    }, [ticket._id, latestReplies.length]);

    // Older replies are added above what is on screen, so the scroll position is corrected by however
    // much taller the thread became over the message the reader was on.
    useLayoutEffect(() => {
        const anchor = scrollAnchorRef.current;
        if (!anchor) return;
        scrollAnchorRef.current = null;
        const element = messageListRef.current?.querySelector(`[data-reply-id="${anchor.replyId}"]`);
        const scroller = messageListRef.current?.closest(".app-content");
        if (element && scroller) scroller.scrollTop += element.getBoundingClientRect().top - anchor.top;
    }, [thread]);

    const earlierCount = earlierReplyCount(ticket.visibleReplyCount, thread.length);
    // The conversation is capped, so the composer warns before the cap rather than only at it.
    const isFillingUp = ticket.replyNoticeFrom > 0 && ticket.replyCount >= ticket.replyNoticeFrom;

    async function loadEarlierReplies() {
        if (isLoadingEarlier) return;
        setIsLoadingEarlier(true);
        setEarlierError("");
        const firstShown = thread[0];
        const firstElement = firstShown && messageListRef.current?.querySelector(`[data-reply-id="${firstShown._id}"]`);
        try {
            const page = await onLoadEarlierReplies(earlierCursor);
            if (firstShown && firstElement) {
                scrollAnchorRef.current = { replyId: firstShown._id, top: firstElement.getBoundingClientRect().top };
            }
            setThread((current) => [...page.replies, ...current]);
            setEarlierCursor(page.nextBefore || earlierCursor);
            setHasEarlier(Boolean(page.hasEarlier));
        } catch {
            setEarlierError("Couldn't load the earlier replies.");
        } finally {
            setIsLoadingEarlier(false);
        }
    }

    // The composer starts at two lines and grows with its content up to a maximum height. A closed
    // ticket has no composer at all, so there is nothing to measure.
    useLayoutEffect(() => {
        const field = replyFieldRef.current;
        if (!field) return;
        field.style.height = "auto";
        field.style.height = `${Math.min(field.scrollHeight + 2, COMPOSER_MAX_HEIGHT)}px`;
    }, [replyBody, canReply]);

    function submitReply(event) {
        event.preventDefault();
        const trimmed = replyBody.trim();
        if (!trimmed) {
            setReplyError("Write a reply before sending.");
            return;
        }
        setReplyError("");
        onReply({ body: trimmed, isInternal })
            .then(() => setReplyBody(""))
            .catch(() => {
                // Failure is already surfaced via toast; keep the draft so the user doesn't lose it.
            });
    }

    function insertCanned(response) {
        setReplyBody((current) => (current ? `${current}\n\n${response.body}` : response.body));
        setReplyError("");
        setShowCanned(false);
    }

    function jumpToReply() {
        replyFieldRef.current?.focus();
        replyFieldRef.current?.scrollIntoView({ block: "center" });
    }

    function saveNote(replyId, body) {
        onEditNote(replyId, body)
            .then(() => setEditingNoteId(null))
            .catch(() => {
                // The toast already says what went wrong; the draft stays on screen.
            });
    }

    return (
        <section className="ticket-detail">
            <header className="ticket-detail-header">
                <div className="ticket-detail-heading">
                    <button
                        type="button"
                        className="ticket-back-button"
                        onClick={onBack}
                        aria-label="Back to tickets"
                        title="Back to tickets"
                    >
                        <ArrowLeftIcon />
                    </button>
                    <span className="ticket-number">{ticketNumber(ticket._id)}</span>
                    <h2>{ticket.title}</h2>
                    <div className="ticket-detail-chips">
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        <span className="sla-chip" title={`SLA due ${formatDateTime(ticket.slaDeadline)}`}>
                            <span className={ticket.slaBreached ? "sla-breached" : "sla-ok"}>
                                {formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached)}
                            </span>
                            <span className="sla-progress-track">
                                <span className={`sla-progress-fill sla-progress-fill-${sla.tone}`} style={{ width: `${sla.percent}%` }} />
                            </span>
                        </span>
                    </div>
                </div>
                {/* A merged duplicate's conversation lives on the other ticket, so the page says where. */}
                {ticket.mergedInto && (
                    <p className="ticket-merged-banner">
                        <LockIcon /> Merged into{" "}
                        <a href={`#/tickets/${ticket.mergedInto._id}`}>
                            {ticketNumber(ticket.mergedInto._id)} {ticket.mergedInto.title}
                        </a>
                        . The conversation continues there.
                    </p>
                )}
                <div className="ticket-meta-row">
                    <p className="ticket-meta">
                        Opened by {ticket.createdBy?.name} &middot; {formatDateTime(ticket.createdAt)}
                    </p>
                    {/* A requester can still correct their own wording while nothing has been acted on;
                        after that the button is gone and the reason takes its place. */}
                    {permissions.canEditDetails ? (
                        <button type="button" className="button-secondary button-compact" onClick={onEditDetails} disabled={isUpdating}>
                            Edit ticket
                        </button>
                    ) : (
                        permissions.requesterEditBlockedReason && (
                            <p className="ticket-meta-note">
                                <LockIcon /> {permissions.requesterEditBlockedReason}
                            </p>
                        )
                    )}
                </div>
            </header>

            <div className="ticket-detail-layout">
                <div className="ticket-detail-main">
                    <div className="ticket-thread">
                        <div className="ticket-thread-header">
                            <h3>Conversation</h3>
                            {canReply && (
                                <button type="button" className="link-button jump-to-reply" onClick={jumpToReply}>
                                    Jump to reply
                                </button>
                            )}
                        </div>
                        <ol className="message-list" ref={messageListRef}>
                            <MessageCard
                                author={ticket.createdBy}
                                body={ticket.description}
                                isInternal={false}
                                createdAt={ticket.createdAt}
                            />
                            {/* A long conversation arrives one page at a time, newest page first, and the
                                reader walks back through it from here. */}
                            {hasEarlier && (
                                <li className="message-list-earlier">
                                    <button
                                        type="button"
                                        className="button-secondary button-compact"
                                        onClick={loadEarlierReplies}
                                        disabled={isLoadingEarlier}
                                    >
                                        {isLoadingEarlier && <span className="spinner" aria-hidden="true" />}
                                        {isLoadingEarlier
                                            ? "Loading earlier replies..."
                                            : earlierCount > 0
                                              ? `Show earlier replies (${earlierCount} more)`
                                              : "Show earlier replies"}
                                    </button>
                                    {earlierError && (
                                        <p className="message-list-earlier-error" role="alert">
                                            {earlierError}{" "}
                                            <button type="button" className="link-button" onClick={loadEarlierReplies}>
                                                Try again
                                            </button>
                                        </p>
                                    )}
                                </li>
                            )}
                            {thread.map((reply, index) => (
                                <MessageCard
                                    key={reply._id}
                                    replyId={reply._id}
                                    author={reply.author}
                                    body={reply.body}
                                    isInternal={reply.isInternal}
                                    createdAt={reply.createdAt}
                                    editedAt={reply.editedAt}
                                    innerRef={index === thread.length - 1 ? latestMessageRef : undefined}
                                    editor={
                                        editingNoteId === reply._id ? (
                                            <NoteEditor
                                                reply={reply}
                                                onSave={(body) => saveNote(reply._id, body)}
                                                onCancel={() => setEditingNoteId(null)}
                                                isBusy={isSavingNote}
                                            />
                                        ) : null
                                    }
                                    actions={
                                        reply.isInternal ? (
                                            <NoteActions
                                                reply={reply}
                                                onEdit={() => setEditingNoteId(reply._id)}
                                                onDelete={() => setNoteToDelete(reply)}
                                                isBusy={isSavingNote}
                                            />
                                        ) : null
                                    }
                                />
                            ))}
                        </ol>
                    </div>

                    {replyLimitReason ? (
                        <div className="reply-form reply-form-locked" role="status">
                            <p className="reply-locked-message">
                                <LockIcon /> {replyLimitReason}
                            </p>
                            {/* Only the requester raises tickets, so the button belongs to them; the team
                                is told whose move it is instead of being given one that would be refused. */}
                            {currentUser.role === "customer" ? (
                                <div className="reply-locked-actions">
                                    <button type="button" className="button-primary button-compact" onClick={onOpenFollowUp}>
                                        Open a follow-up ticket
                                    </button>
                                </div>
                            ) : (
                                <p className="reply-locked-note">
                                    The conversation stays readable. Only the requester can open the follow-up ticket it continues on.
                                </p>
                            )}
                        </div>
                    ) : !canReply ? (
                        <div className="reply-form reply-form-locked" role="status">
                            <p className="reply-locked-message">
                                <LockIcon /> {permissions.closedReason}
                            </p>
                            {permissions.reopenBlockedReason ? (
                                <p className="reply-locked-note">{permissions.reopenBlockedReason}</p>
                            ) : (
                                <p className="reply-locked-note">
                                    {canManage
                                        ? "Set the status back to Open to continue the conversation."
                                        : "Reopen the ticket from the panel on the right to continue the conversation."}
                                </p>
                            )}
                        </div>
                    ) : (
                        <form className="reply-form" onSubmit={submitReply} noValidate>
                            {/* Said early enough to act on, so nobody writes a long reply into a ticket
                                that is about to refuse it. */}
                            {isFillingUp && (
                                <p className="reply-limit-notice" role="status">
                                    This ticket has {ticket.replyCount} of {ticket.replyLimit} replies.
                                </p>
                            )}
                            <div className="reply-tabs" role="tablist" aria-label="Reply type">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={!isInternal}
                                    className={!isInternal ? "active" : ""}
                                    onClick={() => setIsInternal(false)}
                                >
                                    Public Reply
                                </button>
                                {canManage && (
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={isInternal}
                                        className={isInternal ? "active" : ""}
                                        onClick={() => setIsInternal(true)}
                                    >
                                        Internal Note
                                    </button>
                                )}
                            </div>
                            <label htmlFor="reply-body" className="visually-hidden">
                                Reply
                            </label>
                            <textarea
                                id="reply-body"
                                ref={replyFieldRef}
                                value={replyBody}
                                onChange={(event) => {
                                    setReplyBody(event.target.value);
                                    if (replyError) setReplyError("");
                                }}
                                placeholder={isInternal ? "Write an internal note visible only to your team..." : "Write a reply..."}
                                rows={2}
                                maxLength={5000}
                                aria-invalid={Boolean(replyError)}
                                aria-describedby={replyError ? "reply-body-error" : undefined}
                                className={`${replyError ? "field-invalid" : ""} ${isInternal ? "reply-body-internal" : ""}`}
                                disabled={isReplying}
                            />
                            {replyError && (
                                <span className="field-error" id="reply-body-error">
                                    {replyError}
                                </span>
                            )}
                            <div className="reply-form-footer">
                                {canManage && cannedResponses.length > 0 ? (
                                    <div className="canned-picker">
                                        <button
                                            type="button"
                                            className="button-secondary button-compact"
                                            onClick={() => setShowCanned((value) => !value)}
                                            aria-expanded={showCanned}
                                            aria-haspopup="true"
                                        >
                                            Insert canned response
                                        </button>
                                        {showCanned && (
                                            <ul className="canned-picker-list">
                                                {cannedResponses.map((response) => (
                                                    <li key={response._id}>
                                                        <button type="button" onClick={() => insertCanned(response)}>
                                                            {response.title}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ) : (
                                    <span />
                                )}
                                <button type="submit" className="button-primary button-compact" disabled={isReplying}>
                                    {isReplying && <span className="spinner" aria-hidden="true" />}
                                    {isReplying ? "Sending..." : isInternal ? "Save Note" : "Send Reply"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div ref={sideColumnRef} className={`ticket-detail-side ${sideColumnFits ? "ticket-detail-side-pinned" : ""}`}>
                    <aside className="ticket-detail-sidebar" aria-label="Ticket properties">
                        <TicketProperties
                            ticket={ticket}
                            currentUser={currentUser}
                            agents={agents}
                            auditTrail={auditTrail}
                            auditTrailError={auditTrailError}
                            onRetryAuditTrail={onRetryAuditTrail}
                            onUpdate={onUpdate}
                            onAssign={onAssign}
                            onClaim={onClaim}
                            onOpenMerge={() => setShowMerge(true)}
                            isUpdating={isUpdating}
                        />
                    </aside>

                    <aside className="ticket-detail-history-column" aria-label="Status history">
                        <StatusHistory
                            entries={statusHistory || []}
                            isLoading={!statusHistory && !statusHistoryError}
                            hasError={statusHistoryError}
                            onRetry={onRetryStatusHistory}
                        />
                    </aside>
                </div>
            </div>

            {showMerge && <MergeTicketModal ticket={ticket} onClose={() => setShowMerge(false)} onMerge={onMerge} />}

            {noteToDelete && (
                <ConfirmationDialog
                    title="Delete this internal note?"
                    message="It disappears from the ticket for everyone on the team. This cannot be undone."
                    confirmLabel="Delete note"
                    danger
                    onCancel={() => setNoteToDelete(null)}
                    onConfirm={() => {
                        const replyId = noteToDelete._id;
                        setNoteToDelete(null);
                        onDeleteNote(replyId);
                    }}
                />
            )}
        </section>
    );
}
