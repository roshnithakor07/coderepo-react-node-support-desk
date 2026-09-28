// A neutral stat card. The danger tone colors only the number and the icon, so a problem stands out
// without the whole card shouting.
export function StatCard({ icon, value, label, tone }) {
    return (
        <div className={`stat-tile ${tone ? `stat-tile-${tone}` : ""}`}>
            <span className="stat-tile-icon">{icon}</span>
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}
