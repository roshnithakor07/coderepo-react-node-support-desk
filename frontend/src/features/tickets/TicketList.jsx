import { StatusBadge } from "../../shared/components/Badge.jsx";
import { SearchField } from "../../shared/components/SearchField.jsx";
import { Table } from "../../shared/components/Table.jsx";
import { formatDateTime, formatSlaCountdown, getSlaProgress, initials, titleCase } from "../../shared/utils/format.js";
import { toHash } from "../../shared/utils/router.js";
import { ticketPath } from "../../shared/utils/routes.js";
import { DEFAULT_SORT, PRIORITY_OPTIONS, queryFromFilters, SORT_OPTIONS, STATUS_OPTIONS, UNASSIGNED_VIEW } from "./ticket-filters.js";

function PriorityCell({ priority }) {
    return (
        <span className="priority-cell">
            <span className={`priority-dot priority-dot-${priority}`} aria-hidden="true" />
            {titleCase(priority)}
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
    const { percent, tone } = getSlaProgress(ticket.slaStartedAt || ticket.createdAt, ticket.slaDeadline, ticket.slaBreached);
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

// What the list means depends on who is looking: a customer sees their own tickets, an agent the
// ones assigned to them, an admin everything.
const SUBTITLES = {
    admin: "Every ticket in the workspace.",
    agent: "Tickets assigned to you.",
    customer: "Tickets you have opened.",
};

const EMPTY_DESCRIPTIONS = {
    admin: "Tickets will show up here as soon as customers create them.",
    agent: "Nothing is assigned to you right now. Check the Unassigned queue for tickets in your categories.",
    customer: "Create your first ticket to get help from our team.",
};

// The unassigned queue is scoped by team, so it says whose categories it is showing.
function queueSubtitle(categories) {
    if (!categories || categories.length === 0) {
        return "You have no categories yet, so no tickets can reach your queue. Ask an admin to set them on the Agents page.";
    }
    return `Tickets nobody has picked up, in your categories: ${categories.map(titleCase).join(", ")}.`;
}

function ClaimCell({ ticket, onClaim, isClaiming }) {
    return (
        <div className="row-actions">
            <button type="button" className="button-secondary button-compact" onClick={() => onClaim(ticket._id)} disabled={isClaiming}>
                Claim
            </button>
        </div>
    );
}

export function TicketList({
    tickets,
    total,
    filters,
    onFilterChange,
    onSelectTicket,
    onNewTicket,
    onClaim,
    claimingId,
    isLoading,
    isRefreshing,
    role,
    categories,
}) {
    const search = filters.search || "";
    const hasActiveFilters = Boolean(search || filters.status || filters.priority);
    const canCreate = role === "customer";
    const isQueue = filters.view === UNASSIGNED_VIEW;
    // Only an agent can take a ticket for themselves; an admin opens it and picks somebody.
    const canClaim = isQueue && role === "agent";
    const pageSize = filters.pageSize || 20;
    const page = filters.page || 1;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    function clearFilters() {
        onFilterChange({ page: 1, pageSize, sort: filters.sort || DEFAULT_SORT, view: filters.view });
    }

    // The two views are links, so each has its own URL, opens in a new tab and comes back on a
    // refresh. Switching keeps the filters and starts again at page one.
    function viewHref(view) {
        return toHash("/tickets", queryFromFilters({ ...filters, view, page: 1 }));
    }

    const columns = [
        {
            key: "title",
            header: "Title",
            sort: ["title_asc", "title_desc"],
            // A real link, so the ticket can be opened in a new tab; the rest of the row opens it here.
            render: (row) => (
                <a className="ticket-title-cell ticket-title-link" href={toHash(ticketPath(row._id))}>
                    {row.title}
                </a>
            ),
        },
        { key: "status", header: "Status", sort: ["status"], render: (row) => <StatusBadge status={row.status} /> },
        {
            key: "priority",
            header: "Priority",
            sort: ["priority_desc"],
            render: (row) => <PriorityCell priority={row.priority} />,
        },
        { key: "category", header: "Category", render: (row) => titleCase(row.category || "general") },
        { key: "assignedTo", header: "Assigned to", render: (row) => <AgentCell agent={row.assignedTo} /> },
        { key: "sla", header: "SLA", render: (row) => <SlaCell ticket={row} /> },
        {
            key: "createdAt",
            header: "Created",
            sort: ["oldest", "newest"],
            render: (row) => <span className="mono">{formatDateTime(row.createdAt)}</span>,
        },
    ];

    // In the queue nobody owns anything, so that column is replaced by the action that changes it.
    const visibleColumns = isQueue
        ? [
              ...columns.filter((column) => column.key !== "assignedTo"),
              ...(canClaim
                  ? [
                        {
                            key: "claim",
                            header: "",
                            render: (row) => <ClaimCell ticket={row} onClaim={onClaim} isClaiming={claimingId === row._id} />,
                        },
                    ]
                  : []),
          ]
        : columns;

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <p className="panel-count">
                        {total} {total === 1 ? "ticket" : "tickets"}
                        {hasActiveFilters ? " match your filters" : ""}
                    </p>
                    <p className="panel-subtitle">
                        {isQueue ? (role === "agent" ? queueSubtitle(categories) : "Tickets nobody has picked up yet.") : SUBTITLES[role]}
                    </p>
                </div>
                {canCreate && (
                    <button type="button" className="button-primary" onClick={onNewTicket}>
                        New ticket
                    </button>
                )}
            </div>

            {role !== "customer" && (
                <nav className="view-tabs" aria-label="Ticket views">
                    <a className={isQueue ? "" : "active"} aria-current={isQueue ? undefined : "page"} href={viewHref("")}>
                        {role === "admin" ? "All tickets" : "Assigned to me"}
                    </a>
                    <a className={isQueue ? "active" : ""} aria-current={isQueue ? "page" : undefined} href={viewHref(UNASSIGNED_VIEW)}>
                        Unassigned
                    </a>
                </nav>
            )}

            <div className="filter-bar">
                <SearchField
                    id="ticket-search"
                    value={search}
                    onChange={(value) => onFilterChange({ ...filters, search: value, page: 1 })}
                    label="Search tickets"
                    placeholder="Search tickets..."
                />
                <select
                    value={filters.status || ""}
                    onChange={(event) => onFilterChange({ ...filters, status: event.target.value, page: 1 })}
                    aria-label="Filter by status"
                >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                            {titleCase(status)}
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
                            {titleCase(priority)}
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
                emptyTitle={
                    search
                        ? `No tickets match "${search}"`
                        : hasActiveFilters
                          ? "No tickets match your filters"
                          : isQueue
                            ? "Nothing waiting"
                            : "No tickets yet"
                }
                emptyDescription={
                    hasActiveFilters
                        ? "Try a different term, or clear the filters to see everything."
                        : isQueue
                          ? role === "agent"
                              ? queueSubtitle(categories)
                              : "Every ticket in the workspace has an agent on it."
                          : EMPTY_DESCRIPTIONS[role]
                }
                emptyAction={
                    hasActiveFilters
                        ? { label: "Clear filters", onClick: clearFilters }
                        : canCreate
                          ? { label: "New ticket", onClick: onNewTicket }
                          : undefined
                }
                rows={tickets}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                sortValue={filters.sort || DEFAULT_SORT}
                sortOptions={SORT_OPTIONS}
                onSortChange={(value) => onFilterChange({ ...filters, sort: value, page: 1 })}
                columns={visibleColumns}
            />

            {!isLoading && totalPages > 1 && (
                <div className="pagination">
                    <button
                        type="button"
                        disabled={page <= 1 || isRefreshing}
                        onClick={() => onFilterChange({ ...filters, page: page - 1 })}
                    >
                        Previous
                    </button>
                    <span>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        type="button"
                        disabled={page >= totalPages || isRefreshing}
                        onClick={() => onFilterChange({ ...filters, page: page + 1 })}
                    >
                        Next
                    </button>
                </div>
            )}
        </section>
    );
}
