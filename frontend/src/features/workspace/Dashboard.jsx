import { StatusBadge } from "../../shared/components/Badge.jsx";
import { AlertCircleIcon, CheckCircleIcon, InboxIcon, TargetIcon } from "../../shared/components/Icon.jsx";
import { SlaText } from "../../shared/components/Sla.jsx";
import { StatCard } from "../../shared/components/StatCard.jsx";

export function Dashboard({ currentUser, tickets, onSelectTicket, onNewTicket, onViewAllTickets, analyticsSummary }) {
    const breached = tickets.filter((ticket) => ticket.slaBreached).length;
    const open = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
    const resolved = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length;

    return (
        <section className="page">
            <div className="page-header">
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
                <StatCard icon={<InboxIcon />} value={open} label="Open" />
                <StatCard icon={<CheckCircleIcon />} value={resolved} label="Resolved" />
                <StatCard icon={<AlertCircleIcon />} value={breached} label="SLA breached" tone={breached > 0 ? "danger" : undefined} />
                {analyticsSummary && (
                    <StatCard icon={<TargetIcon />} value={`${analyticsSummary.slaComplianceRate}%`} label="SLA compliance" />
                )}
            </div>

            <section className="list-card" aria-labelledby="recent-tickets-title">
                <div className="list-card-header">
                    <h3 id="recent-tickets-title">Recent tickets</h3>
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
                            {currentUser.role === "customer"
                                ? "Create your first ticket to get help from our team."
                                : "Tickets will show up here once customers create them."}
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
                                    <SlaText ticket={ticket} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </section>
    );
}
