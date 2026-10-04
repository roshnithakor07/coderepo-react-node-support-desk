import { slaComplianceRate } from "../tickets/ticket-sla.js";
import { analyticsRepository } from "./analytics.repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Ranges are whole UTC days: from the start of dateFrom up to the end of dateTo, inclusive.
function startOfDay(date) {
    return new Date(`${date}T00:00:00.000Z`);
}

export const analyticsService = {
    async getDashboard(filters = {}) {
        const dateFrom = filters.dateFrom ? startOfDay(filters.dateFrom) : undefined;
        const dateTo = filters.dateTo ? new Date(startOfDay(filters.dateTo).getTime() + DAY_MS) : undefined;

        const [volumeOverTime, resolutionByPriority, agentPerformance, slaComplianceRows, statusCounts] = await Promise.all([
            analyticsRepository.volumeOverTime(dateFrom, dateTo),
            analyticsRepository.avgResolutionByPriority(dateFrom, dateTo),
            analyticsRepository.agentPerformance(dateFrom, dateTo),
            analyticsRepository.slaCompliance(dateFrom, dateTo),
            analyticsRepository.statusCounts(dateFrom, dateTo),
        ]);

        const slaRow = slaComplianceRows[0] || { total: 0, breached: 0 };

        const statusMap = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
        const openCount = (statusMap.open || 0) + (statusMap.in_progress || 0) + (statusMap.pending || 0);
        const resolvedCount = (statusMap.resolved || 0) + (statusMap.closed || 0);

        return {
            volumeOverTime: volumeOverTime.map((row) => ({ date: row._id, count: row.count })),
            resolutionByPriority: resolutionByPriority.map((row) => ({
                priority: row._id,
                avgResolutionHours: Number((row.avgResolutionHours || 0).toFixed(1)),
                count: row.count,
            })),
            agentPerformance,
            slaComplianceRate: slaComplianceRate(slaRow.total, slaRow.breached),
            totalTickets: slaRow.total,
            breachedTickets: slaRow.breached,
            openCount,
            resolvedCount,
            statusCounts: statusMap,
        };
    },
};
