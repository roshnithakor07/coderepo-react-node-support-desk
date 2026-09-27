import { useState } from "react";
import { PriorityBadge, StatusBadge } from "../../shared/components/Badge.jsx";
import { formatDateTime, formatSlaCountdown, getSlaProgress, initials } from "../../shared/utils/format.js";

const STATUS_OPTIONS = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

function MessageCard({ author, body, isInternal, createdAt }) {
    return (
        <div className={`message-card ${isInternal ? "message-card-internal" : ""}`}>
            <div className="message-card-header">
                <span className="message-card-avatar">{initials(author?.name)}</span>
                <span className="message-card-meta">
                    <span className="message-card-name">{author?.name}</span>
                    {author?.role && <span className="tag">{author.role}</span>}
                </span>
                <span className="message-card-trailer">
                    {isInternal && <span className="internal-note-chip">🔒 Internal Note</span>}
                    <span className="message-card-time">{formatDateTime(createdAt)}</span>
                </span>
            </div>
            <p className="message-card-body">{body}</p>
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

    const canManage = currentUser.role === "admin" || currentUser.role === "agent";
    const sla = getSlaProgress(ticket.createdAt, ticket.slaDeadline, ticket.slaBreached);

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

    return (
        <section className="panel ticket-detail">
            <button type="button" className="link-button back-link" onClick={onBack}>
                <span aria-hidden="true">&larr;</span> Back to tickets
            </button>

            <div className="ticket-detail-header">
                <div>
                    <h2>{ticket.title}</h2>
                    <p className="ticket-meta">
                        Opened by {ticket.createdBy?.name} &middot; {formatDateTime(ticket.createdAt)}
                    </p>
                </div>
                <div className="ticket-detail-badges">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <span className="sla-timer-pill">
                        <span className={ticket.slaBreached ? "sla-breached" : "sla-ok"}>
                            {formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached)}
                        </span>
                        <span className="sla-progress-track sla-timer-pill-track">
                            <span className={`sla-progress-fill sla-progress-fill-${sla.tone}`} style={{ width: `${sla.percent}%` }} />
                        </span>
                    </span>
                </div>
            </div>

            <div className="ticket-detail-layout">
                <div className="ticket-detail-main">
                    <div className="ticket-thread">
                        <h3>Conversation</h3>
                        <MessageCard author={ticket.createdBy} body={ticket.description} isInternal={false} createdAt={ticket.createdAt} />
                        {ticket.replies.map((reply) => (
                            <MessageCard
                                key={reply._id}
                                author={reply.author}
                                body={reply.body}
                                isInternal={reply.isInternal}
                                createdAt={reply.createdAt}
                            />
                        ))}
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
                            value={replyBody}
                            onChange={(event) => {
                                setReplyBody(event.target.value);
                                if (replyError) setReplyError("");
                            }}
                            placeholder={isInternal ? "Write an internal note visible only to your team..." : "Write a reply..."}
                            rows={4}
                            maxLength={5000}
                            aria-invalid={Boolean(replyError)}
                            aria-describedby={replyError ? "reply-body-error" : undefined}
                            className={replyError ? "field-invalid" : ""}
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
                                        className="button-secondary"
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
                            <button type="submit" className="button-primary" disabled={isReplying}>
                                {isReplying && <span className="spinner" aria-hidden="true" />}
                                {isReplying ? "Sending..." : isInternal ? "Save Note" : "Send Reply"}
                            </button>
                        </div>
                    </form>

                    {currentUser.role === "admin" && auditTrail && (
                        <details className="audit-trail">
                            <summary>Audit trail</summary>
                            {auditTrail.length === 0 ? (
                                <p className="table-empty">No activity recorded yet.</p>
                            ) : (
                                <ul>
                                    {auditTrail.map((entry) => (
                                        <li key={entry._id}>
                                            <span className="audit-action">{entry.action}</span> by {entry.performedBy?.name || "system"}{" "}
                                            &middot; {formatDateTime(entry.createdAt)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </details>
                    )}
                </div>

                <div className="ticket-detail-sidebar">
                    {canManage && (
                        <div className="ticket-sidebar-card">
                            <h4>Ticket Details</h4>
                            <label htmlFor="ticket-status">
                                Status
                                <select
                                    id="ticket-status"
                                    value={ticket.status}
                                    onChange={(event) => onUpdate({ status: event.target.value })}
                                    disabled={isUpdating}
                                >
                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                            {status.replace("_", " ")}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label htmlFor="ticket-priority-select">
                                Priority
                                <select
                                    id="ticket-priority-select"
                                    value={ticket.priority}
                                    onChange={(event) => onUpdate({ priority: event.target.value })}
                                    disabled={isUpdating}
                                >
                                    {PRIORITY_OPTIONS.map((priority) => (
                                        <option key={priority} value={priority}>
                                            {priority}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {isUpdating && (
                                <span className="ticket-controls-status">
                                    <span className="spinner" aria-hidden="true" /> Saving...
                                </span>
                            )}
                        </div>
                    )}

                    {canManage && (
                        <div className="ticket-sidebar-card">
                            <h4>Assigned To</h4>
                            <label htmlFor="ticket-assignee" className="visually-hidden">
                                Assigned to
                            </label>
                            <select
                                id="ticket-assignee"
                                value={ticket.assignedTo?._id || ""}
                                onChange={(event) => onAssign(event.target.value)}
                                disabled={isUpdating}
                            >
                                <option value="" disabled>
                                    Select agent
                                </option>
                                {agents.map((agent) => (
                                    <option key={agent._id} value={agent._id}>
                                        {agent.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="ticket-sidebar-card">
                        <h4>Ticket Info</h4>
                        <div className="ticket-info-list">
                            <div className="ticket-info-row">
                                <span className="ticket-info-label">Requester</span>
                                <span className="ticket-info-value">{ticket.createdBy?.name}</span>
                            </div>
                            <div className="ticket-info-row">
                                <span className="ticket-info-label">Category</span>
                                <span className="ticket-info-value">{ticket.category || "General"}</span>
                            </div>
                            <div className="ticket-info-row">
                                <span className="ticket-info-label">Created</span>
                                <span className="ticket-info-value">{formatDateTime(ticket.createdAt)}</span>
                            </div>
                            <div className="ticket-info-row">
                                <span className="ticket-info-label">SLA deadline</span>
                                <span className="ticket-info-value">{formatDateTime(ticket.slaDeadline)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
