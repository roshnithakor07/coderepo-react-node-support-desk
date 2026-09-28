import { titleCase } from "../utils/format.js";

// Colors carry meaning only: danger for critical, success for resolved. Low priority is neutral.
const PRIORITY_TONE = { critical: "danger", high: "warning", medium: "attention", low: "neutral" };
const STATUS_TONE = { open: "info", in_progress: "attention", pending: "warning", resolved: "success", closed: "neutral" };

export function PriorityBadge({ priority }) {
    return <span className={`badge badge-${PRIORITY_TONE[priority] || "neutral"}`}>{titleCase(priority)}</span>;
}

export function StatusBadge({ status }) {
    return <span className={`badge badge-${STATUS_TONE[status] || "neutral"}`}>{titleCase(status)}</span>;
}

export function Badge({ tone = "neutral", children }) {
    return <span className={`badge badge-${tone}`}>{children}</span>;
}
