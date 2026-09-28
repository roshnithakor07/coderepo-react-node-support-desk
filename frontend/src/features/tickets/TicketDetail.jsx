import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PriorityBadge, StatusBadge } from "../../shared/components/Badge.jsx";
import { ArrowLeftIcon, LockIcon } from "../../shared/components/Icon.jsx";
import { SlaProgress, SlaText } from "../../shared/components/Sla.jsx";
import { formatDateTime, initials, ticketNumber, titleCase } from "../../shared/utils/format.js";

const STATUS_OPTIONS = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];
const COMPOSER_MAX_HEIGHT = 200;

function MessageCard({ author, body, isInternal, createdAt }) {
    return (
        <li className={`message-card ${isInternal ? "message-card-internal" : ""}`}>
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

function PropertyRow({ label, htmlFor, children }) {
    return (
        <div className="ticket-info-row">
            {htmlFor ? (
                <label htmlFor={htmlFor} className="ticket-info-label">
                    {label}
                </label>
            ) : (
                <span className="ticket-info-label">{label}</span>
            )}
            {children}
        </div>
    );
}

export function TicketDetail({
    ticket,
    currentUser,
    agents,
    cannedResponses,
    auditTrail,
    onBack,
    onUpdate,
    onReply,
    onAssign,
    isReplying,
    isUpdating,
}) {
    const [replyBody, setReplyBody] = useState("");
    const [replyError, setReplyError] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [showCanned, setShowCanned] = useState(false);
    const replyFieldRef = useRef(null);
    const threadEndRef = useRef(null);
    const messageListRef = useRef(null);

    const canManage = currentUser.role === "admin" || currentUser.role === "agent";
    const visibleReplies = canManage ? ticket.replies : ticket.replies.filter((reply) => !reply.isInternal);

    // Open on the latest message and keep it in view while the reader stays at the bottom, including
    // when fonts or late layout change the height. The composer follows the list in the layout, so
    // scrolling to the end always leaves the last message fully visible above it.
    useEffect(() => {
        const scroller = threadEndRef.current?.closest(".app-content");
        if (!scroller) return undefined;
        let followLatest = true;
        const scrollToLatest = () => {
            if (followLatest) scroller.scrollTop = scroller.scrollHeight;
        };
        const trackReader = () => {
            followLatest = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
        };
        scrollToLatest();
        const observer = new ResizeObserver(scrollToLatest);
        observer.observe(messageListRef.current);
        scroller.addEventListener("scroll", trackReader, { passive: true });
        return () => {
            observer.disconnect();
            scroller.removeEventListener("scroll", trackReader);
        };
    }, [ticket._id, visibleReplies.length]);

    // The composer starts at two lines and grows with its content up to a maximum height.
    useLayoutEffect(() => {
        const field = replyFieldRef.current;
        field.style.height = "auto";
        field.style.height = `${Math.min(field.scrollHeight + 2, COMPOSER_MAX_HEIGHT)}px`;
    }, [replyBody]);

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
        replyFieldRef.current.focus();
        replyFieldRef.current.scrollIntoView({ block: "center" });
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
                            <SlaText ticket={ticket} />
                            <SlaProgress ticket={ticket} />
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
                            <button type="button" className="link-button jump-to-reply" onClick={jumpToReply}>
                                Jump to reply
                            </button>
                        </div>
                        <ol className="message-list" ref={messageListRef}>
                            <MessageCard
                                author={ticket.createdBy}
                                body={ticket.description}
                                isInternal={false}
                                createdAt={ticket.createdAt}
                            />
                            {visibleReplies.map((reply) => (
                                <MessageCard
                                    key={reply._id}
                                    author={reply.author}
                                    body={reply.body}
                                    isInternal={reply.isInternal}
                                    createdAt={reply.createdAt}
                                />
                            ))}
                        </ol>
                        <div ref={threadEndRef} />
                    </div>

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
                </div>

                <aside className="ticket-detail-sidebar" aria-label="Ticket properties">
                    <div className="properties-card">
                        <div className="properties-card-header">
                            <h4>Properties</h4>
                            {isUpdating && (
                                <span className="ticket-controls-status">
                                    <span className="spinner" aria-hidden="true" /> Saving...
                                </span>
                            )}
                        </div>
                        <div className="ticket-info-list">
                            <PropertyRow label="Status" htmlFor={canManage ? "ticket-status" : undefined}>
                                {canManage ? (
                                    <select
                                        id="ticket-status"
                                        value={ticket.status}
                                        onChange={(event) => onUpdate({ status: event.target.value })}
                                        disabled={isUpdating}
                                    >
                                        {STATUS_OPTIONS.map((status) => (
                                            <option key={status} value={status}>
                                                {titleCase(status)}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="ticket-info-value">{titleCase(ticket.status)}</span>
                                )}
                            </PropertyRow>
                            <PropertyRow label="Priority" htmlFor={canManage ? "ticket-priority-select" : undefined}>
                                {canManage ? (
                                    <select
                                        id="ticket-priority-select"
                                        value={ticket.priority}
                                        onChange={(event) => onUpdate({ priority: event.target.value })}
                                        disabled={isUpdating}
                                    >
                                        {PRIORITY_OPTIONS.map((priority) => (
                                            <option key={priority} value={priority}>
                                                {titleCase(priority)}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="ticket-info-value">{titleCase(ticket.priority)}</span>
                                )}
                            </PropertyRow>
                            <PropertyRow label="Assignee" htmlFor={canManage ? "ticket-assignee" : undefined}>
                                {canManage ? (
                                    <select
                                        id="ticket-assignee"
                                        value={ticket.assignedTo?._id || ""}
                                        onChange={(event) => onAssign(event.target.value)}
                                        disabled={isUpdating}
                                    >
                                        <option value="" disabled>
                                            Select agent
                                        </option>
                                        {agents
                                            .filter((agent) => agent.isActive || agent._id === ticket.assignedTo?._id)
                                            .map((agent) => (
                                                <option key={agent._id} value={agent._id} disabled={!agent.isActive}>
                                                    {agent.isActive ? agent.name : `${agent.name} (inactive)`}
                                                </option>
                                            ))}
                                    </select>
                                ) : (
                                    <span className="ticket-info-value">{ticket.assignedTo?.name || "Unassigned"}</span>
                                )}
                            </PropertyRow>
                            <PropertyRow label="Requester">
                                <span className="ticket-info-value">{ticket.createdBy?.name}</span>
                            </PropertyRow>
                            <PropertyRow label="Category">
                                <span className="ticket-info-value">{titleCase(ticket.category || "general")}</span>
                            </PropertyRow>
                            <PropertyRow label="Created">
                                <span className="ticket-info-value">{formatDateTime(ticket.createdAt)}</span>
                            </PropertyRow>
                            <PropertyRow label="SLA due">
                                <span className={`ticket-info-value ${ticket.slaBreached ? "sla-breached-text" : ""}`}>
                                    {formatDateTime(ticket.slaDeadline)}
                                </span>
                            </PropertyRow>
                        </div>

                        {currentUser.role === "admin" && auditTrail && (
                            <details className="audit-trail">
                                <summary>Audit trail</summary>
                                {auditTrail.length === 0 ? (
                                    <p className="table-empty">No activity recorded yet.</p>
                                ) : (
                                    <ul>
                                        {auditTrail.map((entry) => (
                                            <li key={entry._id}>
                                                <span className="audit-action">{titleCase(entry.action)}</span> by{" "}
                                                {entry.performedBy?.name || "system"} &middot; {formatDateTime(entry.createdAt)}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </details>
                        )}
                    </div>
                </aside>
            </div>
        </section>
    );
}
