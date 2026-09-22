export function Table({ columns, rows, rowKey, onRowClick, emptyMessage = "Nothing to show yet." }) {
    if (rows.length === 0) {
        return <div className="table-empty">{emptyMessage}</div>;
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
                    <tr key={rowKey(row)} className={onRowClick ? "clickable" : ""} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                        {columns.map((column) => (
                            <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
