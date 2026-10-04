// One headline figure: a round tinted icon badge, the number, and what it counts. The Dashboard and
// Analytics both use it, so the two pages' tiles stay identical. The number turns red only when it
// flags a problem (isAlert); otherwise it keeps the normal text color.
export function StatTile({ icon: Icon, tone, value, label, isAlert = false }) {
    return (
        <div className="stat-tile">
            <span className={`stat-tile-icon stat-tile-icon-${tone}`}>
                <Icon />
            </span>
            <span className={`stat-value ${isAlert ? "stat-value-danger" : ""}`}>{value}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}

// The same tile while its figure loads, with the badge's space kept so nothing moves on arrival.
export function StatTileSkeleton() {
    return (
        <div className="stat-tile" aria-hidden="true">
            <span className="skeleton stat-tile-icon" />
            <span className="skeleton skeleton-block" style={{ height: "28px", width: "50%" }} />
            <span className="skeleton skeleton-block" style={{ height: "12px", width: "70%" }} />
        </div>
    );
}
