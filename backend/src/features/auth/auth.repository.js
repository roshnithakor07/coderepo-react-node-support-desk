import { User } from "./user.model.js";

export const authRepository = {
    findByEmail: (email) => User.findOne({ email }).select("+password"),
    findById: (id) => User.findById(id).lean(),
    create: (input) => User.create(input),
    findMany: (filter) => User.find(filter).sort({ createdAt: -1 }).lean(),
    countActiveAgents: () => User.countDocuments({ role: "agent", isActive: true }),
    findAgentsWithWorkload: async () => {
        return User.aggregate([
            { $match: { role: "agent", isActive: true } },
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
    update: (id, input) => User.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean(),
};
