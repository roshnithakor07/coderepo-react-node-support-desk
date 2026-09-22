import { BarChart, DonutChart, LineChart } from "../../shared/components/Charts.jsx";

export function AnalyticsPage({ dashboard, filters, onFilterChange, isLoading }) {
    if (isLoading || !dashboard) {
        return (
            <section className="panel">
                <h2>Analytics</h2>
                <div className="table-empty">Loading analytics...</div>
            </section>
        );
    }

    const statusSegments = [
        { label: "Open", value: dashboard.openCount, color: "var(--info)" },
        { label: "Resolved/Closed", value: dashboard.resolvedCount, color: "var(--success)" },
        { label: "Breached", value: dashboard.breachedTickets, color: "var(--danger)" },
    ];

    return (
        <section className="panel">
            <div className="panel-header">
                <h2>Analytics</h2>
                <div className="filter-bar">
                    <label>
                        From
                        <input type="date" value={filters.dateFrom || ""} onChange={(event) => onFilterChange({ ...filters, dateFrom: event.target.value })} />
                    </label>
                    <label>
                        To
                        <input type="date" value={filters.dateTo || ""} onChange={(event) => onFilterChange({ ...filters, dateTo: event.target.value })} />
                    </label>
                </div>
            </div>

            <div className="stat-row">
                <div className="stat-tile">
                    <span className="stat-value">{dashboard.totalTickets}</span>
                    <span className="stat-label">Total tickets</span>
                </div>
                <div className="stat-tile">
                    <span className="stat-value">{dashboard.slaComplianceRate}%</span>
                    <span className="stat-label">SLA compliance</span>
                </div>
                <div className="stat-tile">
                    <span className="stat-value">{dashboard.openCount}</span>
                    <span className="stat-label">Open</span>
                </div>
                <div className="stat-tile">
                    <span className="stat-value">{dashboard.breachedTickets}</span>
                    <span className="stat-label">SLA breached</span>
                </div>
            </div>

            <div className="chart-grid">
                <div className="chart-card">
                    <h3>Ticket volume over time</h3>
                    <LineChart data={dashboard.volumeOverTime} xKey="date" yKey="count" />
                </div>
                <div className="chart-card">
                    <h3>Status breakdown</h3>
                    <DonutChart segments={statusSegments} />
                </div>
                <div className="chart-card">
                    <h3>Avg resolution time by priority (hours)</h3>
                    <BarChart data={dashboard.resolutionByPriority} xKey="priority" yKey="avgResolutionHours" />
                </div>
                <div className="chart-card">
                    <h3>Agent performance</h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Agent</th>
                                <th>Assigned</th>
                                <th>Resolved</th>
                                <th>Avg resolution (h)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.agentPerformance.map((row) => (
                                <tr key={row.agentId}>
                                    <td>{row.agentName}</td>
                                    <td>{row.totalAssigned}</td>
                                    <td>{row.resolved}</td>
                                    <td>{row.avgResolutionHours ? row.avgResolutionHours.toFixed(1) : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
