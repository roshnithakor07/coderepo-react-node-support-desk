const CHART_HEIGHT = 160;

export function BarChart({ data, xKey, yKey, color = "var(--accent)" }) {
    if (!data || data.length === 0) return <div className="chart-empty">No data yet.</div>;
    const max = Math.max(...data.map((row) => row[yKey]), 1);
    return (
        <div className="bar-chart" style={{ height: CHART_HEIGHT }}>
            {data.map((row) => (
                <div className="bar-chart-column" key={row[xKey]}>
                    <div className="bar-chart-value">{row[yKey]}</div>
                    <div
                        className="bar-chart-bar"
                        style={{ height: `${Math.max((row[yKey] / max) * 100, 3)}%`, background: color }}
                        title={`${row[xKey]}: ${row[yKey]}`}
                    />
                    <div className="bar-chart-label">{row[xKey]}</div>
                </div>
            ))}
        </div>
    );
}

export function LineChart({ data, xKey, yKey, color = "var(--accent)" }) {
    if (!data || data.length === 0) return <div className="chart-empty">No data yet.</div>;
    const values = data.map((row) => row[yKey]);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const width = 100;
    const points = data.map((row, index) => {
        const x = data.length === 1 ? 0 : (index / (data.length - 1)) * width;
        const y = 100 - ((row[yKey] - min) / range) * 100;
        return `${x},${y}`;
    });

    return (
        <div className="line-chart" style={{ height: CHART_HEIGHT }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-chart-svg">
                <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="line-chart-labels">
                <span>{data[0]?.[xKey]}</span>
                <span>{data[data.length - 1]?.[xKey]}</span>
            </div>
        </div>
    );
}

export function DonutChart({ segments }) {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
    let cumulative = 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="donut-chart">
            <svg viewBox="0 0 100 100" className="donut-chart-svg">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
                {segments.map((segment) => {
                    const fraction = segment.value / total;
                    const dashArray = `${fraction * circumference} ${circumference}`;
                    const dashOffset = -cumulative * circumference;
                    cumulative += fraction;
                    return (
                        <circle
                            key={segment.label}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="14"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            transform="rotate(-90 50 50)"
                        />
                    );
                })}
            </svg>
            <ul className="donut-chart-legend">
                {segments.map((segment) => (
                    <li key={segment.label}>
                        <span className="donut-chart-swatch" style={{ background: segment.color }} />
                        {segment.label}: {segment.value}
                    </li>
                ))}
            </ul>
        </div>
    );
}
