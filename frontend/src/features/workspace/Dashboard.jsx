import { StatusBadge } from "../../shared/components/Badge.jsx";
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, InboxCheckIcon, InboxIcon } from "../../shared/components/Icon.jsx";
import { StatTile, StatTileSkeleton } from "../../shared/components/StatTile.jsx";
import { formatSlaCountdown } from "../../shared/utils/format.js";
import { toHash } from "../../shared/utils/router.js";
import { ticketPath } from "../../shared/utils/routes.js";

// Each role is looking at a different set of tickets, so the subtitle has to say which.
const SUBTITLES = {
    admin: "Every ticket in the workspace, newest first.",
    agent: "The tickets assigned to you, newest first.",
    customer: "The tickets you have opened, newest first.",
};

const EMPTY_DESCRIPTIONS = {
    admin: "Tickets will show up here once customers create them.",
    agent: "Nothing is assigned to you yet. Assigned tickets show up here.",
    customer: "Create your first ticket to get help from our team.",
};

export function Dashboard({ currentUser, tickets, stats, onNewTicket, isLoading, isRefreshing, error, onRetry }) {
    // Counts come from the server, over every ticket this role may see, not just the few listed.
    const { open = 0, resolved = 0, breached = 0, slaComplianceRate = 100 } = stats || {};
    const canCreate = currentUser.role === "customer";

    // Nothing claims "no tickets" until the first response has actually arrived.
    if (isLoading) {
        return (
            <section className="panel" aria-busy="true">
                <div className="panel-header">
                    <div>
                        <h2>Welcome back, {currentUser.name.split(" ")[0]}</h2>
                        <p className="panel-subtitle">{SUBTITLES[currentUser.role]}</p>
                    </div>
                </div>
                <div className="stat-row">
                    {["open", "resolved", "compliance", "breached"].map((key) => (
                        <StatTileSkeleton key={key} />
                    ))}
                </div>
                <div className="panel-subheader">
                    <h3>Recent tickets</h3>
                </div>
                <ul className="dashboard-ticket-list">
                    {[0, 1, 2, 3].map((row) => (
                        <li key={row}>
                            <span className="skeleton skeleton-block" style={{ height: "40px" }} />
                        </li>
                    ))}
                </ul>
            </section>
        );
    }

    if (error) {
        return (
            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Welcome back, {currentUser.name.split(" ")[0]}</h2>
                        <p className="panel-subtitle">{SUBTITLES[currentUser.role]}</p>
                    </div>
                </div>
                <div className="form-error" role="alert">
                    {error}{" "}
                    <button type="button" className="link-button" onClick={onRetry}>
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className={`panel ${isRefreshing ? "is-refreshing" : ""}`}>
            <div className="panel-header">
                <div>
                    <h2>Welcome back, {currentUser.name.split(" ")[0]}</h2>
                    <p className="panel-subtitle">{SUBTITLES[currentUser.role]}</p>
                </div>
                {canCreate && (
                    <button type="button" className="button-primary" onClick={onNewTicket}>
                        New ticket
                    </button>
                )}
            </div>

            <div className="stat-row">
                <StatTile icon={ClockIcon} tone="info" value={open} label="Open" />
                <StatTile icon={InboxCheckIcon} tone="success" value={resolved} label="Resolved" />
                <StatTile icon={CheckCircleIcon} tone="success" value={`${slaComplianceRate}%`} label="SLA compliance" />
                <StatTile icon={AlertCircleIcon} tone="danger" value={breached} label="SLA breached" isAlert={breached > 0} />
            </div>

            <div className="panel-subheader">
                <h3>Recent tickets</h3>
                {tickets.length > 0 && (
                    <a className="link-button" href={toHash("/tickets")}>
                        View all
                    </a>
                )}
            </div>
            {tickets.length === 0 ? (
                <div className="empty-state">
                    <InboxIcon className="empty-state-icon" />
                    <p className="empty-state-title">No tickets yet</p>
                    <p className="empty-state-description">{EMPTY_DESCRIPTIONS[currentUser.role]}</p>
                    {canCreate && (
                        <button type="button" className="button-primary" onClick={onNewTicket}>
                            New ticket
                        </button>
                    )}
                </div>
            ) : (
                <ul className="dashboard-ticket-list">
                    {tickets.map((ticket) => (
                        <li key={ticket._id}>
                            <a href={toHash(ticketPath(ticket._id))}>
                                <span className="ticket-title-cell">{ticket.title}</span>
                                <StatusBadge status={ticket.status} />
                                <span className={ticket.slaBreached ? "sla-breached" : "sla-ok"}>
                                    {formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached)}
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
