// The share of tickets that never breached their response target, to one decimal place. With no
// tickets nothing has been missed, so it reads 100. Used by the dashboard tiles and by Analytics,
// so the two pages can never disagree on the same set of tickets.
export function slaComplianceRate(total, breached) {
    return total > 0 ? Number((((total - breached) / total) * 100).toFixed(1)) : 100;
}
