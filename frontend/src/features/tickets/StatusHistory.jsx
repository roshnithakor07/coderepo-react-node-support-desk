import { StatusBadge } from "../../shared/components/Badge.jsx";
import { ClockIcon, InfoIcon } from "../../shared/components/Icon.jsx";
import { formatDateTime } from "../../shared/utils/format.js";

// How each kind of history entry reads. Anything else falls back to the stored action.
const LABELS = {
    created: "Opened",
    reopened: "Reopened",
    sla_breached: "SLA breached",
    updated: "Status changed",
};

function Entry({ entry }) {
    const isBreach = entry.action === "sla_breached";
    return (
        <li className={`status-history-entry ${isBreach ? "status-history-entry-breach" : ""}`}>
            <span className="status-history-icon" aria-hidden="true">
                {isBreach ? <ClockIcon /> : <InfoIcon />}
            </span>
            <span className="status-history-body">
                <span className="status-history-headline">
                    <span className="status-history-action">{LABELS[entry.action] || entry.action}</span>
                    {entry.to && (
                        <span className="status-history-move">
                            {entry.from && (
                                <>
                                    <StatusBadge status={entry.from} />
                                    <span aria-hidden="true">&rarr;</span>
                                </>
                            )}
                            <StatusBadge status={entry.to} />
                        </span>
                    )}
                </span>
                <span className="status-history-meta">
                    {entry.performedBy ? `${entry.performedBy.name} (${entry.performedBy.role})` : "Automatic"} &middot;{" "}
                    {formatDateTime(entry.createdAt)}
                </span>
                {entry.slaRestartedAt && <span className="status-history-note">Response time restarted from here.</span>}
            </span>
        </li>
    );
}

// Every move the ticket has made, for whoever can see the ticket. Internal notes and field edits
// stay out of it; the admin-only audit trail covers those.
export function StatusHistory({ entries, isLoading }) {
    return (
        <div className="properties-card status-history">
            <div className="properties-card-header">
                <h4>Status history</h4>
            </div>
            {isLoading ? (
                <div className="status-history-loading">
                    <span className="skeleton skeleton-block" style={{ height: "40px" }} />
                    <span className="skeleton skeleton-block" style={{ height: "40px" }} />
                </div>
            ) : entries.length === 0 ? (
                <p className="table-empty">No status changes recorded yet.</p>
            ) : (
                <ol className="status-history-list">
                    {entries.map((entry) => (
                        <Entry key={entry._id} entry={entry} />
                    ))}
                </ol>
            )}
        </div>
    );
}
