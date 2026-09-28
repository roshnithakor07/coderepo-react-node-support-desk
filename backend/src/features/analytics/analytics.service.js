import { withRedis } from "../../shared/config/redis.js";
import { analyticsRepository } from "./analytics.repository.js";

const CACHE_TTL_SECONDS = 60;
const CACHE_VERSION_KEY = "analytics:version";
const DAY_MS = 24 * 60 * 60 * 1000;

// Bumping the version makes every cached dashboard stale at once; old keys expire on their own.
async function cacheKey(redis, filters) {
    const version = (await redis.get(CACHE_VERSION_KEY)) || "0";
    return `analytics:dashboard:v${version}:${filters.dateFrom || "-"}:${filters.dateTo || "-"}`;
}

// Ranges are whole UTC days: from the start of dateFrom up to the end of dateTo, inclusive.
function startOfDay(date) {
    return new Date(`${date}T00:00:00.000Z`);
}

export const analyticsService = {
    invalidate() {
        return withRedis((redis) => redis.incr(CACHE_VERSION_KEY), null);
    },

    // Without Redis the dashboard is computed on every request instead of cached.
    async getDashboard(filters = {}) {
        const key = await withRedis((redis) => cacheKey(redis, filters), null);
        const cached = key && (await withRedis((redis) => redis.get(key), null));
        if (cached) return JSON.parse(cached);

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

        if (key) await withRedis((redis) => redis.set(key, JSON.stringify(dashboard), "EX", CACHE_TTL_SECONDS), null);
        return dashboard;
    },
};
