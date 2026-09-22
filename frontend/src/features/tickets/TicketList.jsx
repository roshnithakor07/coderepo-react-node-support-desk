import { PriorityBadge, StatusBadge } from "../../shared/components/Badge.jsx";
import { Table } from "../../shared/components/Table.jsx";
import { formatDateTime, formatSlaCountdown } from "../../shared/utils/format.js";

const STATUS_OPTIONS = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

export function TicketList({ tickets, total, filters, onFilterChange, onSelectTicket, onNewTicket, isLoading, canCreate = true }) {
    return (
        <section className="panel">
            <div className="panel-header">
                <h2>Tickets</h2>
                {canCreate && (
                    <button type="button" className="button-primary" onClick={onNewTicket}>
                        New ticket
                    </button>
                )}
            </div>

            <div className="filter-bar">
                <input
                    type="search"
                    placeholder="Search tickets..."
                    value={filters.search || ""}
                    onChange={(event) => onFilterChange({ ...filters, search: event.target.value, page: 1 })}
                />
                <select value={filters.status || ""} onChange={(event) => onFilterChange({ ...filters, status: event.target.value, page: 1 })}>
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                            {status.replace("_", " ")}
                        </option>
                    ))}
                </select>
                <select value={filters.priority || ""} onChange={(event) => onFilterChange({ ...filters, priority: event.target.value, page: 1 })}>
                    <option value="">All priorities</option>
                    {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                            {priority}
                        </option>
                    ))}
                </select>
            </div>

            {isLoading ? (
                <div className="table-empty">Loading tickets...</div>
            ) : (
                <Table
                    rowKey={(row) => row._id}
                    onRowClick={(row) => onSelectTicket(row._id)}
                    emptyMessage="No tickets match your filters yet."
                    rows={tickets}
                    columns={[
                        { key: "title", header: "Title", render: (row) => <span className="ticket-title-cell">{row.title}</span> },
                        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                        { key: "priority", header: "Priority", render: (row) => <PriorityBadge priority={row.priority} /> },
                        { key: "assignedTo", header: "Assigned to", render: (row) => row.assignedTo?.name || "Unassigned" },
                        {
                            key: "sla",
                            header: "SLA",
                            render: (row) => (
                                <span className={row.slaBreached ? "sla-breached" : "sla-ok"}>{formatSlaCountdown(row.slaDeadline, row.slaBreached)}</span>
                            ),
                        },
                        { key: "createdAt", header: "Created", render: (row) => formatDateTime(row.createdAt) },
                    ]}
                />
            )}

            {total > tickets.length && (
                <div className="pagination">
                    <button type="button" disabled={(filters.page || 1) <= 1} onClick={() => onFilterChange({ ...filters, page: (filters.page || 1) - 1 })}>
                        Previous
                    </button>
                    <span>
                        Page {filters.page || 1} of {Math.ceil(total / (filters.pageSize || 20))}
                    </span>
                    <button type="button" onClick={() => onFilterChange({ ...filters, page: (filters.page || 1) + 1 })}>
                        Next
                    </button>
                </div>
            )}
        </section>
    );
}
