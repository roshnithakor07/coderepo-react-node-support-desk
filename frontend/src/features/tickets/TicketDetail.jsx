import { useState } from "react";
import { PriorityBadge, StatusBadge } from "../../shared/components/Badge.jsx";
import { formatDateTime, formatSlaCountdown, initials } from "../../shared/utils/format.js";

const STATUS_OPTIONS = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

export function TicketDetail({ ticket, currentUser, agents, cannedResponses, auditTrail, onBack, onUpdate, onReply, onAssign, isReplying }) {
    const [replyBody, setReplyBody] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [showCanned, setShowCanned] = useState(false);

    const canManage = currentUser.role === "admin" || currentUser.role === "agent";

    function submitReply(event) {
        event.preventDefault();
        if (!replyBody.trim()) return;
        onReply({ body: replyBody.trim(), isInternal }).then(() => setReplyBody(""));
    }

    function insertCanned(response) {
        setReplyBody((current) => (current ? `${current}\n\n${response.body}` : response.body));
        setShowCanned(false);
    }

    return (
        <section className="panel ticket-detail">
            <button type="button" className="link-button back-link" onClick={onBack}>
                &larr; Back to tickets
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
                    <label>
                        Status
                        <select value={ticket.status} onChange={(event) => onUpdate({ status: event.target.value })}>
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {status.replace("_", " ")}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Priority
                        <select value={ticket.priority} onChange={(event) => onUpdate({ priority: event.target.value })}>
                            {PRIORITY_OPTIONS.map((priority) => (
                                <option key={priority} value={priority}>
                                    {priority}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Assigned to
                        <select value={ticket.assignedTo?._id || ""} onChange={(event) => onAssign(event.target.value)}>
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
                </div>
            )}

            <div className="ticket-thread">
                <h3>Conversation</h3>
                {ticket.replies.length === 0 && <p className="table-empty">No replies yet.</p>}
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

            <form className="reply-form" onSubmit={submitReply}>
                <div className="reply-form-toolbar">
                    {canManage && cannedResponses.length > 0 && (
                        <div className="canned-picker">
                            <button type="button" className="button-secondary" onClick={() => setShowCanned((value) => !value)}>
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
                <textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Write a reply..."
                    rows={4}
                    maxLength={5000}
                    required
                />
                <button type="submit" className="button-primary" disabled={isReplying}>
                    {isReplying ? "Sending..." : "Send reply"}
                </button>
            </form>

            {currentUser.role === "admin" && auditTrail && (
                <div className="audit-trail">
                    <h3>Audit trail</h3>
                    <ul>
                        {auditTrail.map((entry) => (
                            <li key={entry._id}>
                                <span className="audit-action">{entry.action}</span> by {entry.performedBy?.name || "system"} &middot;{" "}
                                {formatDateTime(entry.createdAt)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
