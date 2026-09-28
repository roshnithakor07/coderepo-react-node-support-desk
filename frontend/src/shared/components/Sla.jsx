import { formatSlaCountdown, getSlaProgress, isFinished } from "../utils/format.js";
import { AlertCircleIcon, ClockIcon } from "./Icon.jsx";

// Urgent states also carry an icon, so they never rely on color alone.
const URGENT_ICON = { warning: ClockIcon, danger: AlertCircleIcon };

function slaLabel(ticket) {
    if (isFinished(ticket.status)) return ticket.slaBreached ? "SLA missed" : "SLA met";
    return formatSlaCountdown(ticket.slaDeadline, ticket.slaBreached);
}

function progressOf(ticket) {
    return getSlaProgress(ticket.createdAt, ticket.slaDeadline, ticket.slaBreached, ticket.status);
}

export function SlaText({ ticket }) {
    const { tone } = progressOf(ticket);
    const Icon = URGENT_ICON[tone];
    return (
        <span className={`sla-text sla-text-${tone}`}>
            {Icon && <Icon className="sla-text-icon" />}
            {slaLabel(ticket)}
        </span>
    );
}

export function SlaProgress({ ticket }) {
    const { percent, tone } = progressOf(ticket);
    return (
        <span className="sla-progress-track">
            <span className={`sla-progress-fill sla-progress-fill-${tone}`} style={{ width: `${percent}%` }} />
        </span>
    );
}
