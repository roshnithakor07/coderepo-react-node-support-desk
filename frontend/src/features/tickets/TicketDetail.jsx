import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PriorityBadge, StatusBadge } from "../../shared/components/Badge.jsx";
import { ArrowLeftIcon, LockIcon } from "../../shared/components/Icon.jsx";
import { formatDateTime, formatSlaCountdown, getSlaProgress, initials, ticketNumber } from "../../shared/utils/format.js";
import { useFitsInView } from "../../shared/utils/pinning.js";
import { StatusHistory } from "./StatusHistory.jsx";
import { TicketProperties } from "./TicketProperties.jsx";

const COMPOSER_MAX_HEIGHT = 200;
// The pinned header (64px) plus the gaps above and below the right-hand column.
const SIDE_COLUMN_RESERVED_HEIGHT = 64 + 8 + 12;

function MessageCard({ author, body, isInternal, createdAt, innerRef }) {
    return (
        <li ref={innerRef} className={`message-card ${isInternal ? "message-card-internal" : ""}`}>
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
                    <span className="message-card-time">{formatDateTime(createdAt)}</span>
                </span>
            </div>
            <p className="message-card-body">{body}</p>
        </li>
    );
}

export function TicketDetail({
    ticket,
    currentUser,
    agents,
    cannedResponses,
    auditTrail,
    statusHistory,
    onBack,
    onUpdate,
    onReply,
    onAssign,
    isReplying,
    isUpdating,
}) {
    const sideColumnRef = useRef(null);
    const sideColumnFits = useFitsInView(sideColumnRef, ".app-content", SIDE_COLUMN_RESERVED_HEIGHT);
    const [replyBody, setReplyBody] = useState("");
    const [replyError, setReplyError] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [showCanned, setShowCanned] = useState(false);
    const replyFieldRef = useRef(null);
    const latestMessageRef = useRef(null);

    const canManage = currentUser.role === "admin" || currentUser.role === "agent";
    const permissions = ticket.permissions || {};
    // A closed ticket's conversation is a record of what happened, so the composer is replaced by
    // the reason it is locked rather than left there to fail on submit.
    const canReply = permissions.canReply !== false;
    const visibleReplies = canManage ? ticket.replies : ticket.replies.filter((reply) => !reply.isInternal);
    const sla = getSlaProgress(ticket.slaStartedAt || ticket.createdAt, ticket.slaDeadline, ticket.slaBreached);

    // The ticket opens at its header (App scrolls the content area to the top). Only a message added
    // during this visit scrolls, and then only to the new message, never on the way in.
    const replyCountRef = useRef(visibleReplies.length);
    useEffect(() => {
        if (visibleReplies.length > replyCountRef.current) {
            latestMessageRef.current?.scrollIntoView({ block: "nearest" });
        }
        replyCountRef.current = visibleReplies.length;
    }, [ticket._id, visibleReplies.length]);

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
                <p className="ticket-meta">
                    Opened by {ticket.createdBy?.name} &middot; {formatDateTime(ticket.createdAt)}
                </p>
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
                        <ol className="message-list">
                            <MessageCard
                                author={ticket.createdBy}
                                body={ticket.description}
                                isInternal={false}
                                createdAt={ticket.createdAt}
                            />
                            {visibleReplies.map((reply, index) => (
                                <MessageCard
                                    key={reply._id}
                                    author={reply.author}
                                    body={reply.body}
                                    isInternal={reply.isInternal}
                                    createdAt={reply.createdAt}
                                    innerRef={index === visibleReplies.length - 1 ? latestMessageRef : undefined}
                                />
                            ))}
                        </ol>
                    </div>

                    {!canReply ? (
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
                            onUpdate={onUpdate}
                            onAssign={onAssign}
                            isUpdating={isUpdating}
                        />
                    </aside>

                    <aside className="ticket-detail-history-column" aria-label="Status history">
                        <StatusHistory entries={statusHistory || []} isLoading={!statusHistory} />
                    </aside>
                </div>
            </div>
        </section>
    );
}
