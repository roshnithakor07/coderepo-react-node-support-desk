import { StatusBadge } from "../../shared/components/Badge.jsx";
import { InboxIcon } from "../../shared/components/Icon.jsx";
import { formatSlaCountdown } from "../../shared/utils/format.js";

export function Dashboard({ currentUser, tickets, onSelectTicket, onNewTicket, onViewAllTickets, analyticsSummary }) {
    const breached = tickets.filter((ticket) => ticket.slaBreached).length;
    const open = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
    const resolved = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length;

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h2>Welcome back, {currentUser.name.split(" ")[0]}</h2>
                    <p className="panel-subtitle">Here&rsquo;s what&rsquo;s happening with your tickets today.</p>
                </div>
                {currentUser.role === "customer" && (
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
                    <p className="empty-state-description">
                        {currentUser.role === "customer" ? "Create your first ticket to get help from our team." : "Tickets will show up here once customers create them."}
                    </p>
                    {currentUser.role === "customer" && (
                        <button type="button" className="button-primary" onClick={onNewTicket}>
                            New ticket
                        </button>
                    )}
                </div>
            ) : (
                <ul className="dashboard-ticket-list">
                    {tickets.slice(0, 6).map((ticket) => (
                        <li key={ticket._id}>
                            <button type="button" onClick={() => onSelectTicket(ticket._id)}>
                                <span className="ticket-title-cell">{ticket.title}</span>
                                <StatusBadge status={ticket.status} />
                                <span className={ticket.slaBreached ? "sla-breached" : "sla-ok"}>{formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
