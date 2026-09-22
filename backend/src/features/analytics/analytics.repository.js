import { Ticket } from "../tickets/ticket.model.js";

function buildDateMatch(dateFrom, dateTo) {
    const match = {};
    if (dateFrom || dateTo) {
        match.createdAt = {};
        if (dateFrom) match.createdAt.$gte = dateFrom;
        if (dateTo) match.createdAt.$lte = dateTo;
    }
    return match;
}

export const analyticsRepository = {
    volumeOverTime: (dateFrom, dateTo) =>
        Ticket.aggregate([
            { $match: buildDateMatch(dateFrom, dateTo) },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]),

    avgResolutionByPriority: (dateFrom, dateTo) =>
        Ticket.aggregate([
            { $match: { ...buildDateMatch(dateFrom, dateTo), resolvedAt: { $ne: null } } },
            {
                $group: {
                    _id: "$priority",
                    avgResolutionHours: { $avg: { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000] } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),

    agentPerformance: (dateFrom, dateTo) =>
        Ticket.aggregate([
            { $match: { ...buildDateMatch(dateFrom, dateTo), assignedTo: { $ne: null } } },
            {
                $group: {
                    _id: "$assignedTo",
                    totalAssigned: { $sum: 1 },
                    resolved: { $sum: { $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0] } },
                    avgResolutionHours: {
                        $avg: {
                            $cond: [{ $ne: ["$resolvedAt", null] }, { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000] }, null],
                        },
                    },
                },
            },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "agent" } },
            { $unwind: "$agent" },
            { $project: { agentId: "$_id", agentName: "$agent.name", totalAssigned: 1, resolved: 1, avgResolutionHours: 1, _id: 0 } },
            { $sort: { resolved: -1 } },
        ]),

    slaCompliance: (dateFrom, dateTo) =>
        Ticket.aggregate([
            { $match: buildDateMatch(dateFrom, dateTo) },
            { $group: { _id: null, total: { $sum: 1 }, breached: { $sum: { $cond: ["$slaBreached", 1, 0] } } } },
        ]),

    statusCounts: (dateFrom, dateTo) =>
        Ticket.aggregate([{ $match: buildDateMatch(dateFrom, dateTo) }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
};
