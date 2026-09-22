const PRIORITY_TONE = { critical: "danger", high: "warning", medium: "attention", low: "success" };
const STATUS_TONE = { open: "info", in_progress: "attention", pending: "warning", resolved: "success", closed: "neutral" };

export function PriorityBadge({ priority }) {
    return <span className={`badge badge-${PRIORITY_TONE[priority] || "neutral"}`}>{priority}</span>;
}

export function StatusBadge({ status }) {
    const label = status.replace("_", " ");
    return <span className={`badge badge-${STATUS_TONE[status] || "neutral"}`}>{label}</span>;
}

export function Badge({ tone = "neutral", children }) {
    return <span className={`badge badge-${tone}`}>{children}</span>;
}
