export function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Compact date for tables: the year is left out when it is the current year.
export function formatShortDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: sameYear ? undefined : "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function formatRelativeTime(value) {
    if (!value) return "-";
    const diffMs = new Date(value).getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    const absMinutes = Math.abs(diffMinutes);

    if (absMinutes < 1) return "just now";
    if (absMinutes < 60) return diffMinutes > 0 ? `in ${absMinutes}m` : `${absMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return diffHours > 0 ? `in ${Math.abs(diffHours)}h` : `${Math.abs(diffHours)}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return diffDays > 0 ? `in ${Math.abs(diffDays)}d` : `${Math.abs(diffDays)}d ago`;
}

export function formatSlaCountdown(slaDeadline, slaBreached) {
    if (slaBreached) return "SLA breached";
    const diffMs = new Date(slaDeadline).getTime() - Date.now();
    if (diffMs <= 0) return "SLA breached";
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}

const URGENT_MS = 3600000;

const FINISHED_STATUSES = ["resolved", "closed"];

export function isFinished(status) {
    return FINISHED_STATUSES.includes(status);
}

// SLA time only draws attention when it needs action: under an hour left, or breached. A resolved or
// closed ticket's SLA has stopped, so it never needs attention.
export function slaUrgency(slaDeadline, slaBreached, status) {
    if (isFinished(status)) return "normal";
    const remaining = new Date(slaDeadline).getTime() - Date.now();
    if (slaBreached || remaining <= 0) return "danger";
    if (remaining < URGENT_MS) return "warning";
    return "normal";
}

export function getSlaProgress(createdAt, slaDeadline, slaBreached, status) {
    const start = new Date(createdAt).getTime();
    const deadline = new Date(slaDeadline).getTime();
    const totalWindow = Math.max(deadline - start, 1);
    const elapsedFraction = slaBreached ? 1 : Math.min(Math.max((Date.now() - start) / totalWindow, 0), 1);
    return { percent: Math.round(elapsedFraction * 100), tone: slaUrgency(slaDeadline, slaBreached, status) };
}

export function initials(name) {
    if (!name) return "?";
    return name
        .split(" ")
        .map((part) => part.charAt(0))
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

// The short ticket number people see, matching the one in inbound email confirmations.
export function ticketNumber(id) {
    return `#${String(id).slice(-6)}`;
}

export function titleCase(value) {
    if (!value) return "";
    return String(value)
        .split(/[_\s]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
