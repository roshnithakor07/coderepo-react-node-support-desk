import { getRedis } from "../../shared/config/redis.js";
import { analyticsRepository } from "./analytics.repository.js";

const CACHE_TTL_SECONDS = 60;

function cacheKey(filters) {
    return `analytics:dashboard:${filters.dateFrom || "-"}:${filters.dateTo || "-"}`;
}

export const analyticsService = {
    async getDashboard(filters = {}) {
        const redis = getRedis();
        const key = cacheKey(filters);
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached);

        const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
        const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

        const [volumeOverTime, resolutionByPriority, agentPerformance, slaComplianceRows, statusCounts] = await Promise.all([
            analyticsRepository.volumeOverTime(dateFrom, dateTo),
            analyticsRepository.avgResolutionByPriority(dateFrom, dateTo),
            analyticsRepository.agentPerformance(dateFrom, dateTo),
            analyticsRepository.slaCompliance(dateFrom, dateTo),
            analyticsRepository.statusCounts(dateFrom, dateTo),
        ]);

        const slaRow = slaComplianceRows[0] || { total: 0, breached: 0 };
        const slaComplianceRate = slaRow.total > 0 ? Number((((slaRow.total - slaRow.breached) / slaRow.total) * 100).toFixed(1)) : 100;

        const statusMap = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
        const openCount = (statusMap.open || 0) + (statusMap.in_progress || 0) + (statusMap.pending || 0);
        const resolvedCount = (statusMap.resolved || 0) + (statusMap.closed || 0);

        const dashboard = {
            volumeOverTime: volumeOverTime.map((row) => ({ date: row._id, count: row.count })),
            resolutionByPriority: resolutionByPriority.map((row) => ({
                priority: row._id,
                avgResolutionHours: Number((row.avgResolutionHours || 0).toFixed(1)),
                count: row.count,
            })),
            agentPerformance,
            slaComplianceRate,
            totalTickets: slaRow.total,
            breachedTickets: slaRow.breached,
            openCount,
            resolvedCount,
            statusCounts: statusMap,
        };

        await redis.set(key, JSON.stringify(dashboard), "EX", CACHE_TTL_SECONDS);
        return dashboard;
    },
};
