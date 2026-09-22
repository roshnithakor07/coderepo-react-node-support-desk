import { StatusBadge } from "../../shared/components/Badge.jsx";
import { formatSlaCountdown } from "../../shared/utils/format.js";

export function Dashboard({ currentUser, tickets, onSelectTicket, onNewTicket, analyticsSummary }) {
    const breached = tickets.filter((ticket) => ticket.slaBreached).length;
    const open = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
    const resolved = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length;

    return (
        <section className="panel">
            <div className="panel-header">
                <h2>Welcome back, {currentUser.name.split(" ")[0]}</h2>
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
                <div className="stat-tile">
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

            <h3>Recent tickets</h3>
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
                {tickets.length === 0 && <li className="table-empty">No tickets yet.</li>}
            </ul>
        </section>
    );
}
