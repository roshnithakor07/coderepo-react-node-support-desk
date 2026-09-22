import { InboxIcon } from "./Icon.jsx";

export function Table({
    columns,
    rows,
    rowKey,
    onRowClick,
    emptyMessage = "Nothing to show yet.",
    emptyTitle = "Nothing here yet",
    emptyDescription,
    emptyAction,
    isLoading = false,
    skeletonRows = 5,
    sort,
    onSortChange,
}) {
    if (isLoading) {
        return (
            <div className="table-scroll">
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th key={column.key}>{column.header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                            <tr key={`skeleton-row-${rowIndex}`}>
                                {columns.map((column) => (
                                    <td key={column.key}>
                                        <span className="skeleton skeleton-text" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="empty-state">
                <InboxIcon className="empty-state-icon" />
                <p className="empty-state-title">{emptyTitle}</p>
                <p className="empty-state-description">{emptyDescription || emptyMessage}</p>
                {emptyAction && (
                    <button type="button" className="button-primary" onClick={emptyAction.onClick}>
                        {emptyAction.label}
                    </button>
                )}
            </div>
        );
    }

    function handleKeyDown(event, row) {
        if (!onRowClick) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onRowClick(row);
        }
    }

    function handleSort(column) {
        if (!column.sortable || !onSortChange) return;
        const isSameColumn = sort?.key === column.key;
        const nextDirection = isSameColumn && sort.direction === "asc" ? "desc" : "asc";
        onSortChange({ key: column.key, direction: nextDirection });
    }

    return (
        <div className="table-scroll">
            <table className="data-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>
                                {column.sortable ? (
                                    <button type="button" className="sortable-header" onClick={() => handleSort(column)}>
                                        {column.header}
                                        <span className={`sort-indicator ${sort?.key === column.key ? "active" : ""}`}>
                                            {sort?.key === column.key ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
                                        </span>
                                    </button>
                                ) : (
                                    column.header
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={rowKey(row)}
                            className={onRowClick ? "clickable" : ""}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
                            tabIndex={onRowClick ? 0 : undefined}
                            role={onRowClick ? "button" : undefined}
                        >
                            {columns.map((column) => (
                                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
