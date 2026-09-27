import { useMemo, useState } from "react";
import { StatusBadge } from "../../shared/components/Badge.jsx";
import { SearchIcon } from "../../shared/components/Icon.jsx";
import { Table } from "../../shared/components/Table.jsx";
import { formatDateTime, formatSlaCountdown, getSlaProgress, initials } from "../../shared/utils/format.js";

function PriorityCell({ priority }) {
    return (
        <span className="priority-cell">
            <span className={`priority-dot priority-dot-${priority}`} aria-hidden="true" />
            {priority}
        </span>
    );
}

function AgentCell({ agent }) {
    if (!agent) return <span className="table-muted-cell">Unassigned</span>;
    return (
        <span className="agent-cell">
            <span className="agent-cell-avatar">{initials(agent.name)}</span>
            {agent.name}
        </span>
    );
}

function SlaCell({ ticket }) {
    const { percent, tone } = getSlaProgress(ticket.createdAt, ticket.slaDeadline, ticket.slaBreached);
    return (
        <span className="sla-cell">
            <span className={ticket.slaBreached ? "sla-breached" : "sla-ok"}>
                {formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached)}
            </span>
            <span className="sla-progress-track">
                <span className={`sla-progress-fill sla-progress-fill-${tone}`} style={{ width: `${percent}%` }} />
            </span>
        </span>
    );
}

const STATUS_OPTIONS = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

export function TicketList({ tickets, total, filters, onFilterChange, onSelectTicket, onNewTicket, isLoading, canCreate = true }) {
    const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
    const hasActiveFilters = Boolean(filters.search || filters.status || filters.priority);

    const sortedTickets = useMemo(() => {
        const copy = [...tickets];
        copy.sort((a, b) => {
            const left = sort.key === "createdAt" ? new Date(a.createdAt).getTime() : a[sort.key];
            const right = sort.key === "createdAt" ? new Date(b.createdAt).getTime() : b[sort.key];
            const comparison = typeof left === "string" ? left.localeCompare(right) : left - right;
            return sort.direction === "asc" ? comparison : -comparison;
        });
        return copy;
    }, [tickets, sort]);

    function clearFilters() {
        onFilterChange({ page: 1, pageSize: filters.pageSize || 20 });
    }

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h2>Tickets</h2>
                    <p className="panel-subtitle">{total} total &middot; showing your current filters</p>
                </div>
                {canCreate && (
                    <button type="button" className="button-primary" onClick={onNewTicket}>
                        New ticket
                    </button>
                )}
            </div>

            <div className="filter-bar">
                <div className="search-input">
                    <SearchIcon />
                    <input
                        type="search"
                        placeholder="Search tickets..."
                        value={filters.search || ""}
                        onChange={(event) => onFilterChange({ ...filters, search: event.target.value, page: 1 })}
                        aria-label="Search tickets"
                    />
                </div>
                <select
                    value={filters.status || ""}
                    onChange={(event) => onFilterChange({ ...filters, status: event.target.value, page: 1 })}
                    aria-label="Filter by status"
                >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                            {status.replace("_", " ")}
                        </option>
                    ))}
                </select>
                <select
                    value={filters.priority || ""}
                    onChange={(event) => onFilterChange({ ...filters, priority: event.target.value, page: 1 })}
                    aria-label="Filter by priority"
                >
                    <option value="">All priorities</option>
                    {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                            {priority}
                        </option>
                    ))}
                </select>
                {hasActiveFilters && (
                    <button type="button" className="link-button" onClick={clearFilters}>
                        Clear filters
                    </button>
                )}
            </div>

            <Table
                rowKey={(row) => row._id}
                onRowClick={(row) => onSelectTicket(row._id)}
                emptyTitle={hasActiveFilters ? "No matching tickets" : "No tickets yet"}
                emptyDescription={
                    hasActiveFilters
                        ? "Try clearing your filters to see more results."
                        : canCreate
                          ? "Create your first ticket to get help from our team."
                          : "Tickets will show up here once they're created."
                }
                emptyAction={
                    hasActiveFilters
                        ? { label: "Clear filters", onClick: clearFilters }
                        : canCreate
                          ? { label: "New ticket", onClick: onNewTicket }
                          : undefined
                }
                rows={sortedTickets}
                isLoading={isLoading}
                sort={sort}
                onSortChange={setSort}
                columns={[
                    {
                        key: "title",
                        header: "Title",
                        sortable: true,
                        render: (row) => <span className="ticket-title-cell">{row.title}</span>,
                    },
                    { key: "status", header: "Status", sortable: true, render: (row) => <StatusBadge status={row.status} /> },
                    { key: "priority", header: "Priority", sortable: true, render: (row) => <PriorityCell priority={row.priority} /> },
                    { key: "assignedTo", header: "Assigned to", render: (row) => <AgentCell agent={row.assignedTo} /> },
                    { key: "sla", header: "SLA", render: (row) => <SlaCell ticket={row} /> },
                    {
                        key: "createdAt",
                        header: "Created",
                        sortable: true,
                        render: (row) => <span className="mono">{formatDateTime(row.createdAt)}</span>,
                    },
                ]}
            />

            {!isLoading && total > tickets.length && (
                <div className="pagination">
                    <button
                        type="button"
                        disabled={(filters.page || 1) <= 1}
                        onClick={() => onFilterChange({ ...filters, page: (filters.page || 1) - 1 })}
                    >
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
