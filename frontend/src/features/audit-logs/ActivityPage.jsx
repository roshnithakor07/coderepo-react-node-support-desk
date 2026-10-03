import { useCallback, useEffect, useState } from "react";
import { Table } from "../../shared/components/Table.jsx";
import { formatDateTime, titleCase } from "../../shared/utils/format.js";
import { auditLogApi } from "./audit-log.api.js";
import { toHash } from "../../shared/utils/router.js";
import { ticketPath } from "../../shared/utils/routes.js";

const PAGE_SIZE = 25;

const ACTION_LABELS = {
    created: "Created",
    assigned: "Assigned",
    updated: "Updated",
    replied: "Replied",
    sla_breached: "SLA breached",
};

function describeChanges(entry) {
    const changes = entry.changes || {};
    if (entry.action === "created") return changes.priority ? `${titleCase(changes.priority)} priority` : "";
    if (entry.action === "assigned") return changes.assignedTo ? `To ${changes.assignedTo}` : "";
    if (entry.action === "replied") return changes.isInternal ? "Internal note" : "Public reply";
    if (entry.action === "sla_breached") return "Deadline passed";
    return Object.entries(changes)
        .map(([field, change]) => {
            if (field === "title") return "Title edited";
            if (field === "slaRestartedAt") return "SLA clock restarted";
            if (change && typeof change === "object" && "to" in change)
                return `${titleCase(field)}: ${titleCase(String(change.from))} → ${titleCase(String(change.to))}`;
            return `${titleCase(field)} edited`;
        })
        .join(", ");
}

// Admin-only: every recorded change to every ticket, newest first.
export function ActivityPage({ onOpenTicket }) {
    const [page, setPage] = useState(1);
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(() => {
        setIsLoading(true);
        setError("");
        auditLogApi
            .list({ page, pageSize: PAGE_SIZE })
            .then(setResult)
            .catch(() => setError("Couldn't load the activity log. Please try again."))
            .finally(() => setIsLoading(false));
    }, [page]);

    useEffect(load, [load]);

    const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <p className="panel-count">{result ? `${result.total} ${result.total === 1 ? "entry" : "entries"}` : "\u00a0"}</p>
                    <p className="panel-subtitle">Every change to every ticket, newest first.</p>
                </div>
            </div>

            {error ? (
                <div className="form-error" role="alert">
                    {error}{" "}
                    <button type="button" className="link-button" onClick={load}>
                        Retry
                    </button>
                </div>
            ) : (
                <Table
                    rowKey={(row) => row._id}
                    rows={result?.entries || []}
                    isLoading={isLoading && !result}
                    isRefreshing={isLoading && Boolean(result)}
                    onRowClick={(row) => row.ticketId?._id && onOpenTicket(row.ticketId._id)}
                    emptyTitle="No activity yet"
                    emptyDescription="Changes to tickets will show up here."
                    columns={[
                        {
                            key: "ticket",
                            header: "Ticket",
                            render: (row) =>
                                row.ticketId?._id ? (
                                    <a className="ticket-title-cell ticket-title-link" href={toHash(ticketPath(row.ticketId._id))}>
                                        {row.ticketId.title}
                                    </a>
                                ) : (
                                    <span className="ticket-title-cell">Deleted ticket</span>
                                ),
                        },
                        { key: "action", header: "Action", render: (row) => ACTION_LABELS[row.action] || titleCase(row.action) },
                        { key: "details", header: "Details", render: (row) => describeChanges(row) },
                        { key: "by", header: "By", render: (row) => row.performedBy?.name || "System" },
                        {
                            key: "createdAt",
                            header: "When",
                            render: (row) => <span className="mono">{formatDateTime(row.createdAt)}</span>,
                        },
                    ]}
                />
            )}

            {!error && result && totalPages > 1 && (
                <div className="pagination">
                    <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)}>
                        Previous
                    </button>
                    <span>
                        Page {page} of {totalPages}
                    </span>
                    <button type="button" disabled={page >= totalPages || isLoading} onClick={() => setPage(page + 1)}>
                        Next
                    </button>
                </div>
            )}
        </section>
    );
}
