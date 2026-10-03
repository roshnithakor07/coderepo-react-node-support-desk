import { InboxIcon } from "./Icon.jsx";

// One sort model for the whole table: a single option value, shared by the column headers and the
// "Sort by" select that replaces them when rows become cards on narrow screens. A column opts in by
// naming the one or two option values it cycles through.
function columnSortState(column, sortValue) {
    if (!column.sort) return null;
    const [ascending, descending] = column.sort;
    if (sortValue === ascending) return { indicator: "▲", next: descending || ascending };
    if (sortValue === descending) return { indicator: "▼", next: ascending };
    return { indicator: "↕", next: ascending };
}

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
    isRefreshing = false,
    skeletonRows = 5,
    sortValue,
    sortOptions,
    sortLabel = "Sort by",
    onSortChange,
}) {
    const sortControl = sortOptions && sortOptions.length > 0 && onSortChange && (
        <label className="table-sort">
            {sortLabel}
            <select value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
                {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );

    const header = (
        <thead>
            <tr>
                {columns.map((column) => {
                    const state = onSortChange ? columnSortState(column, sortValue) : null;
                    return (
                        <th key={column.key}>
                            {state ? (
                                <button type="button" className="sortable-header" onClick={() => onSortChange(state.next)}>
                                    {column.header}
                                    <span className={`sort-indicator ${state.indicator === "↕" ? "" : "active"}`}>{state.indicator}</span>
                                </button>
                            ) : (
                                column.header
                            )}
                        </th>
                    );
                })}
            </tr>
        </thead>
    );

    // The skeleton keeps the real table's columns and row height, so nothing jumps when data lands.
    if (isLoading) {
        return (
            <div className="table-scroll">
                {sortControl}
                <table className="data-table" aria-busy="true">
                    {header}
                    <tbody>
                        {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                            <tr key={`skeleton-row-${rowIndex}`}>
                                {columns.map((column) => (
                                    <td key={column.key} data-label={column.header}>
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
            <>
                {sortControl}
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
            </>
        );
    }

    function handleKeyDown(event, row) {
        if (!onRowClick) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onRowClick(row);
        }
    }

    return (
        <div className={`table-scroll ${isRefreshing ? "is-refreshing" : ""}`}>
            {sortControl}
            <table className="data-table" aria-busy={isRefreshing || undefined}>
                {header}
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
                                <td key={column.key} data-label={column.header}>
                                    {column.render ? column.render(row) : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
