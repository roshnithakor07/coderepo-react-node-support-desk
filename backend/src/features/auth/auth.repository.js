import { User } from "./user.model.js";

export const authRepository = {
    findByEmail: (email) => User.findOne({ email }).select("+password"),
    findById: (id) => User.findById(id).lean(),
    create: (input) => User.create(input),
    findAdminIds: async () => (await User.find({ role: "admin", isActive: true }).select("_id").lean()).map((admin) => admin._id),
    // How many agents each of these categories is on the team for, which is what stops a category
    // being deleted out from under them.
    countAgentsByCategories: async (categories) => {
        const rows = await User.aggregate([
            { $match: { role: "agent", categories: { $in: categories } } },
            { $unwind: "$categories" },
            { $match: { categories: { $in: categories } } },
            { $group: { _id: "$categories", count: { $sum: 1 } } },
        ]);
        return Object.fromEntries(rows.map((row) => [row._id, row.count]));
    },

    // Auto-assignment asks for the agents who cover one category, least loaded first. The id breaks
    // ties, so the same board always picks the same agent.
    findAgentsWithWorkload: async ({ activeOnly = true, category } = {}) => {
        return User.aggregate([
            {
                $match: {
                    role: "agent",
                    ...(activeOnly ? { isActive: true } : {}),
                    ...(category ? { categories: String(category).toLowerCase() } : {}),
                },
            },
            {
                $lookup: {
                    from: "tickets",
                    let: { agentId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [{ $eq: ["$assignedTo", "$$agentId"] }, { $in: ["$status", ["open", "in_progress", "pending"]] }],
                                },
                            },
                        },
                        { $count: "count" },
                    ],
                    as: "openTickets",
                },
            },
            { $addFields: { openTicketCount: { $ifNull: [{ $first: "$openTickets.count" }, 0] } } },
            { $project: { openTickets: 0, password: 0 } },
            { $sort: { openTicketCount: 1, _id: 1 } },
        ]);
    },
};
