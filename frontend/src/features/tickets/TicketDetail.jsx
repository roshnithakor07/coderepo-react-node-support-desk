import { useState } from "react";
import { PriorityBadge, StatusBadge } from "../../shared/components/Badge.jsx";
import { formatDateTime, formatSlaCountdown, initials } from "../../shared/utils/format.js";

const STATUS_OPTIONS = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

export function TicketDetail({ ticket, currentUser, agents, cannedResponses, auditTrail, onBack, onUpdate, onReply, onAssign, isReplying, isUpdating }) {
    const [replyBody, setReplyBody] = useState("");
    const [replyError, setReplyError] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [showCanned, setShowCanned] = useState(false);

    const canManage = currentUser.role === "admin" || currentUser.role === "agent";

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
                    <span className={ticket.slaBreached ? "sla-breached" : "sla-ok"}>{formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached)}</span>
                </div>
            </div>

            <p className="ticket-description">{ticket.description}</p>

            {canManage && (
                <div className="ticket-controls">
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
                    <label htmlFor="ticket-assignee">
                        Assigned to
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
                    </label>
                    {isUpdating && (
                        <span className="ticket-controls-status">
                            <span className="spinner" aria-hidden="true" /> Saving...
                        </span>
                    )}
                </div>
            )}

            <div className="ticket-thread">
                <h3>Conversation</h3>
                {ticket.replies.length === 0 && <p className="table-empty ticket-thread-empty">No replies yet. Be the first to respond.</p>}
                {ticket.replies.map((reply) => (
                    <div key={reply._id} className={`reply-item ${reply.isInternal ? "reply-internal" : ""}`}>
                        <div className="reply-avatar">{initials(reply.author?.name)}</div>
                        <div className="reply-body-wrap">
                            <div className="reply-header">
                                <span className="reply-author">{reply.author?.name}</span>
                                {reply.isInternal && <span className="badge badge-warning">Internal note</span>}
                                <span className="reply-time">{formatDateTime(reply.createdAt)}</span>
                            </div>
                            <p className="reply-body">{reply.body}</p>
                        </div>
                    </div>
                ))}
            </div>

            <form className="reply-form" onSubmit={submitReply} noValidate>
                <div className="reply-form-toolbar">
                    {canManage && cannedResponses.length > 0 && (
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
                    )}
                    {canManage && (
                        <label className="internal-toggle">
                            <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
                            Internal note
                        </label>
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
                    placeholder="Write a reply..."
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
                <button type="submit" className="button-primary" disabled={isReplying}>
                    {isReplying && <span className="spinner" aria-hidden="true" />}
                    {isReplying ? "Sending..." : "Send reply"}
                </button>
            </form>

            {currentUser.role === "admin" && auditTrail && (
                <div className="audit-trail">
                    <h3>Audit trail</h3>
                    {auditTrail.length === 0 ? (
                        <p className="table-empty">No activity recorded yet.</p>
                    ) : (
                        <ul>
                            {auditTrail.map((entry) => (
                                <li key={entry._id}>
                                    <span className="audit-action">{entry.action}</span> by {entry.performedBy?.name || "system"} &middot;{" "}
                                    {formatDateTime(entry.createdAt)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}
