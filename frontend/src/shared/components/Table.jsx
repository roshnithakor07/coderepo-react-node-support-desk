import { InboxIcon } from "./Icon.jsx";

export function Table({ columns, rows, rowKey, onRowClick, emptyMessage = "Nothing to show yet.", isLoading = false, skeletonRows = 5 }) {
    if (isLoading) {
        return (
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
        );
    }

    if (rows.length === 0) {
        return (
            <div className="table-empty">
                <InboxIcon className="table-empty-icon" />
                <p>{emptyMessage}</p>
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

    return (
        <table className="data-table">
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th key={column.key}>{column.header}</th>
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
    );
}
