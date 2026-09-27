export function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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

export function getSlaProgress(createdAt, slaDeadline, slaBreached) {
    const start = new Date(createdAt).getTime();
    const deadline = new Date(slaDeadline).getTime();
    const totalWindow = Math.max(deadline - start, 1);
    const now = Date.now();
    const elapsedFraction = slaBreached ? 1 : Math.min(Math.max((now - start) / totalWindow, 0), 1);
    const percent = Math.round(elapsedFraction * 100);
    let tone = "success";
    if (slaBreached || elapsedFraction >= 1) tone = "danger";
    else if (elapsedFraction >= 0.7) tone = "warning";
    return { percent, tone };
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
