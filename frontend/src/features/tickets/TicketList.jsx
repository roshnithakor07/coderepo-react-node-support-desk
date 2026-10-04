import { useEffect, useState } from "react";
import { StatusBadge } from "../../shared/components/Badge.jsx";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
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

// Acting on several tickets at once. One picker holds every action (give them to an agent, or move
// them to a status), so the bar stays one row wide on a phone. The server holds every ticket to the
// rule the single action enforces and refuses the lot if any breaks it, so the answer is a list of
// which tickets and why, with a way to drop them from the selection and try again.
function BulkBar({ tickets, selected, onSelectedChange, agents, onBulkAssign, onBulkStatus, onBulkPriority }) {
    const [action, setAction] = useState("");
    const [confirming, setConfirming] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [problem, setProblem] = useState(null);

    const ids = tickets.map((ticket) => ticket._id);
    const picked = ids.filter((id) => selected.includes(id));
    const allPicked = ids.length > 0 && picked.length === ids.length;

    function describe(value) {
        const [kind, target] = value.split(":");
        if (kind === "assign") {
            const agent = agents.find((entry) => entry._id === target);
            return {
                kind,
                target,
                summary: `Assign to ${agent?.name || "this agent"}`,
                verb: `assign them to ${agent?.name || "this agent"}`,
            };
        }
        if (kind === "priority") {
            return {
                kind,
                target,
                summary: `Set priority to ${titleCase(target)}`,
                verb: `get ${titleCase(target)} priority, with a fresh response time from now`,
            };
        }
        return { kind, target, summary: `Set status to ${titleCase(target)}`, verb: `move them to ${titleCase(target)}` };
    }

    async function run() {
        const { kind, target } = confirming;
        setConfirming(null);
        setIsBusy(true);
        setProblem(null);
        try {
            if (kind === "assign") await onBulkAssign(picked, target);
            else if (kind === "priority") await onBulkPriority(picked, target);
            else await onBulkStatus(picked, target);
            onSelectedChange([]);
            setAction("");
        } catch (error) {
            setProblem({ message: error.message, rejections: error.details?.rejections || [] });
        } finally {
            setIsBusy(false);
        }
    }

    function dropFailed() {
        const failed = new Set(problem.rejections.map((entry) => entry.ticketId));
        onSelectedChange(selected.filter((id) => !failed.has(id)));
        setProblem(null);
    }

    return (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
            <div className="bulk-bar-row">
                <label className="bulk-select-all">
                    <input
                        type="checkbox"
                        checked={allPicked}
                        ref={(element) => {
                            if (element) element.indeterminate = picked.length > 0 && !allPicked;
                        }}
                        onChange={() => onSelectedChange(allPicked ? [] : ids)}
                        disabled={ids.length === 0 || isBusy}
                    />
                    {picked.length > 0 ? `${picked.length} selected` : "Select all on this page"}
                </label>
                {picked.length > 0 && (
                    <>
                        <label htmlFor="bulk-action" className="visually-hidden">
                            Action for the selected tickets
                        </label>
                        <select id="bulk-action" value={action} onChange={(event) => setAction(event.target.value)} disabled={isBusy}>
                            <option value="">Choose an action...</option>
                            {agents.length > 0 && (
                                <optgroup label="Assign to">
                                    {agents.map((agent) => (
                                        <option key={agent._id} value={`assign:${agent._id}`}>
                                            {agent.name}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            <optgroup label="Set priority to">
                                {PRIORITY_OPTIONS.map((priority) => (
                                    <option key={priority} value={`priority:${priority}`}>
                                        {titleCase(priority)}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Set status to">
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={`status:${status}`}>
                                        {titleCase(status)}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                        <button
                            type="button"
                            className="button-primary button-compact"
                            disabled={!action || isBusy}
                            onClick={() => setConfirming(describe(action))}
                        >
                            {isBusy && <span className="spinner" aria-hidden="true" />}
                            {isBusy ? "Applying..." : "Apply"}
                        </button>
                        <button type="button" className="link-button" onClick={() => onSelectedChange([])} disabled={isBusy}>
                            Clear
                        </button>
                    </>
                )}
            </div>

            {problem && (
                <div className="bulk-problem" role="alert">
                    {problem.rejections.length > 0 ? (
                        <>
                            <p className="bulk-problem-title">
                                Nothing was changed. {problem.rejections.length} of {picked.length} selected{" "}
                                {picked.length === 1 ? "ticket" : "tickets"} can&rsquo;t take this action:
                            </p>
                            <ul>
                                {problem.rejections.map((entry) => (
                                    <li key={entry.ticketId}>
                                        <strong>{entry.title || "Unknown ticket"}</strong>
                                        <span>{entry.message}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="bulk-problem-actions">
                                <button type="button" className="button-secondary button-compact" onClick={dropFailed}>
                                    Deselect {problem.rejections.length === 1 ? "it" : "these"}
                                </button>
                                <button type="button" className="link-button" onClick={() => setProblem(null)}>
                                    Dismiss
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="bulk-problem-title">{problem.message}</p>
                    )}
                </div>
            )}

            {confirming && (
                <ConfirmationDialog
                    title={`${confirming.summary}?`}
                    message={`${picked.length} ${picked.length === 1 ? "ticket" : "tickets"} will ${confirming.verb}. They change together: if any one of them can't, none do.`}
                    confirmLabel="Apply"
                    onCancel={() => setConfirming(null)}
                    onConfirm={run}
                />
            )}
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
    agents,
    onBulkAssign,
    onBulkStatus,
    onBulkPriority,
    isLoading,
    isRefreshing,
    role,
    categories,
}) {
    const [selected, setSelected] = useState([]);
    const search = filters.search || "";
    const hasActiveFilters = Boolean(search || filters.status || filters.priority);
    const canCreate = role === "customer";
    const isQueue = filters.view === UNASSIGNED_VIEW;
    // Only an agent can take a ticket for themselves; an admin opens it and picks somebody.
    const canClaim = isQueue && role === "agent";
    const pageSize = filters.pageSize || 20;
    const page = filters.page || 1;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // A selection belongs to the page it was made on: a new search, filter, sort, page or view starts clean.
    const listKey = JSON.stringify(queryFromFilters(filters));
    useEffect(() => setSelected([]), [listKey]);

    const canBulk = role !== "customer";

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
                <span className="title-with-select">
                    {canBulk && (
                        <input
                            type="checkbox"
                            className="row-select"
                            aria-label={`Select ${row.title}`}
                            checked={selected.includes(row._id)}
                            onChange={() =>
                                setSelected((current) =>
                                    current.includes(row._id) ? current.filter((id) => id !== row._id) : [...current, row._id],
                                )
                            }
                        />
                    )}
                    <a className="ticket-title-cell ticket-title-link" href={toHash(ticketPath(row._id))}>
                        {row.title}
                    </a>
                </span>
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

            {canBulk && !isLoading && tickets.length > 0 && (
                <BulkBar
                    tickets={tickets}
                    selected={selected}
                    onSelectedChange={setSelected}
                    agents={agents}
                    onBulkAssign={onBulkAssign}
                    onBulkStatus={onBulkStatus}
                    onBulkPriority={onBulkPriority}
                />
            )}

            <Table
                rowKey={(row) => row._id}
                rowClassName={(row) => (selected.includes(row._id) ? "is-selected" : "")}
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
