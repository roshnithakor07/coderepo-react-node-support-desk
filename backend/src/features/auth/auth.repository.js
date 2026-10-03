import { User } from "./user.model.js";

export const authRepository = {
    findByEmail: (email) => User.findOne({ email }).select("+password"),
    findById: (id) => User.findById(id).lean(),
    create: (input) => User.create(input),
    findAdminIds: async () => (await User.find({ role: "admin", isActive: true }).select("_id").lean()).map((admin) => admin._id),
    findAgentsWithWorkload: async ({ activeOnly = true } = {}) => {
        return User.aggregate([
            { $match: activeOnly ? { role: "agent", isActive: true } : { role: "agent" } },
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
            { $sort: { openTicketCount: 1 } },
        ]);
    },
};
