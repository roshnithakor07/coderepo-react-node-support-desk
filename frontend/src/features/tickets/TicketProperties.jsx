import { useState } from "react";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { LockIcon } from "../../shared/components/Icon.jsx";
import { formatDateTime, titleCase } from "../../shared/utils/format.js";

const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

function PropertyRow({ label, htmlFor, children, hint }) {
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
            {hint && <p className="ticket-info-hint">{hint}</p>}
        </div>
    );
}

// The status control offers only the moves the API will accept, and says why anything missing is
// missing. `permissions` comes from the server, so the two can never drift apart.
function StatusControl({ ticket, permissions, canManage, onUpdate, isUpdating }) {
    const nextStatuses = permissions.nextStatuses || [];
    const blockedResolve = permissions.resolveBlockedReason;
    // The banner above already says a closed ticket is locked, so only the reasons it does not
    // cover are repeated here.
    const hint = permissions.reopenBlockedReason || blockedResolve || null;

    if (!canManage || nextStatuses.length === 0) {
        return (
            <PropertyRow label="Status" hint={hint}>
                <span className="ticket-info-value">{titleCase(ticket.status)}</span>
            </PropertyRow>
        );
    }

    return (
        <PropertyRow label="Status" htmlFor="ticket-status" hint={hint}>
            <select
                id="ticket-status"
                value={ticket.status}
                onChange={(event) => onUpdate({ status: event.target.value })}
                disabled={isUpdating}
            >
                <option value={ticket.status}>{titleCase(ticket.status)}</option>
                {nextStatuses.map((status) => (
                    <option key={status} value={status}>
                        {titleCase(status)}
                    </option>
                ))}
                {blockedResolve && (
                    <option value="resolved" disabled>
                        Resolved (needs a public reply)
                    </option>
                )}
            </select>
        </PropertyRow>
    );
}

// A customer's own two moves on their ticket: call it done, or ask for it back.
function RequesterActions({ ticket, permissions, onUpdate, isUpdating }) {
    const [confirming, setConfirming] = useState(null);

    if (!permissions.canCloseAsRequester && !permissions.canReopenAsRequester) {
        if (!permissions.reopenBlockedReason) return null;
        return <p className="ticket-lifecycle-note">{permissions.reopenBlockedReason}</p>;
    }

    const dialogs = {
        closed: {
            title: "Close this ticket?",
            message: "We will stop working on it. You can reopen it within 14 days if the problem comes back.",
            confirmLabel: "Close ticket",
        },
        open: {
            title: "Reopen this ticket?",
            message: "It goes back to our team with a fresh response time, and we will pick it up again.",
            confirmLabel: "Reopen ticket",
        },
    };

    return (
        <div className="ticket-lifecycle-actions">
            {permissions.canCloseAsRequester && (
                <button
                    type="button"
                    className="button-secondary button-compact"
                    onClick={() => setConfirming("closed")}
                    disabled={isUpdating}
                >
                    Close ticket
                </button>
            )}
            {permissions.canReopenAsRequester && (
                <button type="button" className="button-primary button-compact" onClick={() => setConfirming("open")} disabled={isUpdating}>
                    Reopen ticket
                </button>
            )}
            {confirming && (
                <ConfirmationDialog
                    {...dialogs[confirming]}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => {
                        setConfirming(null);
                        onUpdate({ status: confirming });
                    }}
                />
            )}
        </div>
    );
}

// An agent can only be given a ticket in a category their team covers, so the picker shows everyone
// and disables the rest with the reason, rather than quietly hiding half the roster.
function coversCategory(agent, category) {
    return (agent.categories || []).includes(String(category || "general").toLowerCase());
}

function assigneeOptionLabel(agent, category) {
    if (!agent.isActive) return `${agent.name} (inactive)`;
    if (!coversCategory(agent, category)) return `${agent.name} (not on the ${titleCase(category || "general")} team)`;
    return agent.name;
}

export function TicketProperties({ ticket, currentUser, agents, auditTrail, onUpdate, onAssign, onClaim, onOpenMerge, isUpdating }) {
    const permissions = ticket.permissions || {};
    const canManage = currentUser.role === "admin" || currentUser.role === "agent";
    const isClosed = ticket.status === "closed";
    const category = ticket.category || "general";

    return (
        <div className="properties-card">
            <div className="properties-card-header">
                <h4>Properties</h4>
                {isUpdating && (
                    <span className="ticket-controls-status">
                        <span className="spinner" aria-hidden="true" /> Saving...
                    </span>
                )}
            </div>
            {isClosed && (
                <p className="ticket-locked-banner">
                    <LockIcon /> {permissions.closedReason}
                </p>
            )}
            <div className="ticket-info-list">
                <StatusControl
                    ticket={ticket}
                    permissions={permissions}
                    canManage={canManage}
                    onUpdate={onUpdate}
                    isUpdating={isUpdating}
                />
                <PropertyRow label="Priority" htmlFor={permissions.canEditFields ? "ticket-priority-select" : undefined}>
                    {permissions.canEditFields ? (
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
                <PropertyRow label="Assignee" htmlFor={permissions.canAssign ? "ticket-assignee" : undefined}>
                    {permissions.canAssign ? (
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
                                    <option
                                        key={agent._id}
                                        value={agent._id}
                                        disabled={!agent.isActive || !coversCategory(agent, category)}
                                    >
                                        {assigneeOptionLabel(agent, category)}
                                    </option>
                                ))}
                        </select>
                    ) : (
                        <span className="ticket-info-value">{ticket.assignedTo?.name || "Unassigned"}</span>
                    )}
                </PropertyRow>
                {permissions.canClaim && (
                    <PropertyRow label="Your queue" hint="This ticket is in your categories and nobody has picked it up.">
                        <button type="button" className="button-primary button-compact" onClick={onClaim} disabled={isUpdating}>
                            Claim ticket
                        </button>
                    </PropertyRow>
                )}
                <PropertyRow label="Requester">
                    <span className="ticket-info-value">{ticket.createdBy?.name}</span>
                </PropertyRow>
                <PropertyRow label="Category">
                    <span className="ticket-info-value">{titleCase(category)}</span>
                </PropertyRow>
                <PropertyRow label="Created">
                    <span className="ticket-info-value">{formatDateTime(ticket.createdAt)}</span>
                </PropertyRow>
                <PropertyRow label="SLA due">
                    <span className={`ticket-info-value ${ticket.slaBreached ? "sla-breached-text" : ""}`}>
                        {formatDateTime(ticket.slaDeadline)}
                    </span>
                </PropertyRow>
                {isClosed && permissions.reopenWindowEndsAt && !permissions.reopenBlockedReason && (
                    <PropertyRow label="Reopen until">
                        <span className="ticket-info-value">{formatDateTime(permissions.reopenWindowEndsAt)}</span>
                    </PropertyRow>
                )}
            </div>

            {permissions.canMerge && (
                <div className="ticket-merge-action">
                    <button type="button" className="button-secondary button-compact" onClick={onOpenMerge} disabled={isUpdating}>
                        Merge into another ticket
                    </button>
                    <p className="ticket-info-hint">For a duplicate of one of this customer&rsquo;s other open tickets.</p>
                </div>
            )}

            {currentUser.role === "customer" && (
                <RequesterActions ticket={ticket} permissions={permissions} onUpdate={onUpdate} isUpdating={isUpdating} />
            )}

            {currentUser.role === "admin" && auditTrail && (
                <details className="audit-trail">
                    <summary>Audit trail</summary>
                    {auditTrail.length === 0 ? (
                        <p className="table-empty">No activity recorded yet.</p>
                    ) : (
                        <ul>
                            {auditTrail.map((entry) => (
                                <li key={entry._id}>
                                    <span className="audit-action">{titleCase(entry.action)}</span> by {entry.performedBy?.name || "System"}{" "}
                                    &middot; {formatDateTime(entry.createdAt)}
                                </li>
                            ))}
                        </ul>
                    )}
                </details>
            )}
        </div>
    );
}
