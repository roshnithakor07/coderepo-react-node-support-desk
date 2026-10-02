import { BarChart, DonutChart, LineChart } from "../../shared/components/Charts.jsx";
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, TicketIcon } from "../../shared/components/Icon.jsx";

const PRESETS = [
    { label: "7D", days: 7 },
    { label: "30D", days: 30 },
    { label: "90D", days: 90 },
];

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function presetRange(days) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    return { dateFrom: toIsoDate(from), dateTo: toIsoDate(to) };
}

export function AnalyticsPage({ dashboard, filters, onFilterChange, isLoading }) {
    if (isLoading || !dashboard) {
        return (
            <section className="panel">
                <h2>Analytics</h2>
                <div className="stat-row">
                    {["critical", "high", "medium", "low"].map((key) => (
                        <div className="stat-tile" key={key}>
                            <span className="skeleton skeleton-block" style={{ height: "1.6rem", width: "50%" }} />
                            <span className="skeleton skeleton-block" style={{ height: "0.8rem", width: "70%" }} />
                        </div>
                    ))}
                </div>
                <span className="skeleton skeleton-block" style={{ height: "220px", marginBottom: "20px" }} />
                <div className="chart-grid">
                    {["status", "resolution"].map((key) => (
                        <div className="chart-card" key={key}>
                            <span className="skeleton skeleton-block" style={{ height: "1rem", width: "40%", marginBottom: "1rem" }} />
                            <span className="skeleton skeleton-block" style={{ height: "140px" }} />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    const statusSegments = [
        { label: "Open", value: dashboard.openCount, color: "var(--info)" },
        { label: "Resolved/Closed", value: dashboard.resolvedCount, color: "var(--success)" },
        { label: "Breached", value: dashboard.breachedTickets, color: "var(--danger)" },
    ];

    const isPresetActive = (days) => {
        const preset = presetRange(days);
        return filters.dateFrom === preset.dateFrom && filters.dateTo === preset.dateTo;
    };
    const isAllTimeActive = !filters.dateFrom && !filters.dateTo;

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h2>Analytics</h2>
                    <p className="panel-subtitle">Ticket trends, SLA health, and agent performance at a glance.</p>
                </div>
                <div className="filter-bar">
                    <div className="preset-group" role="group" aria-label="Date range presets">
                        <button type="button" className={isAllTimeActive ? "active" : ""} onClick={() => onFilterChange({})}>
                            All time
                        </button>
                        {PRESETS.map((preset) => (
                            <button
                                type="button"
                                key={preset.label}
                                className={isPresetActive(preset.days) ? "active" : ""}
                                onClick={() => onFilterChange(presetRange(preset.days))}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <label htmlFor="analytics-from">
                        From
                        <input
                            id="analytics-from"
                            type="date"
                            value={filters.dateFrom || ""}
                            max={filters.dateTo || undefined}
                            onChange={(event) => onFilterChange({ ...filters, dateFrom: event.target.value })}
                        />
                    </label>
                    <label htmlFor="analytics-to">
                        To
                        <input
                            id="analytics-to"
                            type="date"
                            value={filters.dateTo || ""}
                            min={filters.dateFrom || undefined}
                            onChange={(event) => onFilterChange({ ...filters, dateTo: event.target.value })}
                        />
                    </label>
                    <span className="date-range-hint">Dates in UTC</span>
                </div>
            </div>

            <div className="stat-row">
                <div className="stat-tile">
                    <span className="stat-tile-icon stat-tile-icon-accent">
                        <TicketIcon />
                    </span>
                    <span className="stat-value">{dashboard.totalTickets}</span>
                    <span className="stat-label">Total tickets</span>
                </div>
                <div className="stat-tile">
                    <span className="stat-tile-icon stat-tile-icon-success">
                        <CheckCircleIcon />
                    </span>
                    <span className="stat-value">{dashboard.slaComplianceRate}%</span>
                    <span className="stat-label">SLA compliance</span>
                </div>
                <div className="stat-tile">
                    <span className="stat-tile-icon stat-tile-icon-info">
                        <ClockIcon />
                    </span>
                    <span className="stat-value">{dashboard.openCount}</span>
                    <span className="stat-label">Open</span>
                </div>
                <div className={`stat-tile ${dashboard.breachedTickets > 0 ? "stat-tile-danger" : ""}`}>
                    <span className="stat-tile-icon stat-tile-icon-danger">
                        <AlertCircleIcon />
                    </span>
                    <span className="stat-value">{dashboard.breachedTickets}</span>
                    <span className="stat-label">SLA breached</span>
                </div>
            </div>

            <div className="chart-card chart-card-hero">
                <h3>Ticket volume over time</h3>
                <LineChart data={dashboard.volumeOverTime} xKey="date" yKey="count" height={220} />
            </div>

            <div className="chart-grid">
                <div className="chart-card">
                    <h3>Status breakdown</h3>
                    <DonutChart segments={statusSegments} centerLabel="Tickets" />
                </div>
                <div className="chart-card">
                    <h3>Avg resolution time by priority (hours)</h3>
                    <BarChart data={dashboard.resolutionByPriority} xKey="priority" yKey="avgResolutionHours" />
                </div>
            </div>

            <div className="chart-card">
                <h3>Agent performance</h3>
                {dashboard.agentPerformance.length === 0 ? (
                    <div className="chart-empty">No agent activity in this range yet.</div>
                ) : (
                    <div className="table-scroll">
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
                                        <td data-label="Agent">{row.agentName}</td>
                                        <td data-label="Assigned">{row.totalAssigned}</td>
                                        <td data-label="Resolved">{row.resolved}</td>
                                        <td data-label="Avg resolution (h)">
                                            {row.avgResolutionHours ? row.avgResolutionHours.toFixed(1) : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
