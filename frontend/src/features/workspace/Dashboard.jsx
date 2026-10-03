import { StatusBadge } from "../../shared/components/Badge.jsx";
import { InboxIcon } from "../../shared/components/Icon.jsx";
import { formatSlaCountdown } from "../../shared/utils/format.js";

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

export function Dashboard({
    currentUser,
    tickets,
    stats,
    onSelectTicket,
    onNewTicket,
    onViewAllTickets,
    analyticsSummary,
    isLoading,
    isRefreshing,
    error,
    onRetry,
}) {
    // Counts come from the server, over every ticket this role may see, not just the few listed.
    const { open = 0, resolved = 0, breached = 0 } = stats || {};
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
                    {["open", "resolved", "breached"].map((key) => (
                        <div className="stat-tile" key={key}>
                            <span className="skeleton skeleton-block" style={{ height: "28px", width: "50%" }} />
                            <span className="skeleton skeleton-block" style={{ height: "12px", width: "70%" }} />
                        </div>
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
                <div className="stat-tile">
                    <span className="stat-value">{open}</span>
                    <span className="stat-label">Open</span>
                </div>
                <div className="stat-tile">
                    <span className="stat-value">{resolved}</span>
                    <span className="stat-label">Resolved</span>
                </div>
                <div className={`stat-tile ${breached > 0 ? "stat-tile-danger" : ""}`}>
                    <span className="stat-value">{breached}</span>
                    <span className="stat-label">SLA breached</span>
                </div>
                {analyticsSummary && (
                    <div className="stat-tile">
                        <span className="stat-value">{analyticsSummary.slaComplianceRate}%</span>
                        <span className="stat-label">SLA compliance</span>
                    </div>
                )}
            </div>

            <div className="panel-subheader">
                <h3>Recent tickets</h3>
                {tickets.length > 0 && (
                    <button type="button" className="link-button" onClick={onViewAllTickets}>
                        View all
                    </button>
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
                            <button type="button" onClick={() => onSelectTicket(ticket._id)}>
                                <span className="ticket-title-cell">{ticket.title}</span>
                                <StatusBadge status={ticket.status} />
                                <span className={ticket.slaBreached ? "sla-breached" : "sla-ok"}>
                                    {formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
