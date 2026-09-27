import { Ticket } from "./ticket.model.js";

const populateFields = [
    { path: "createdBy", select: "name email role avatar" },
    { path: "assignedTo", select: "name email role avatar" },
    { path: "replies.author", select: "name email role avatar" },
];

export const ticketRepository = {
    findById: (id) => Ticket.findById(id).populate(populateFields),

    findByIdLean: (id) => Ticket.findById(id).populate(populateFields).lean(),

    exists: (id) => Ticket.exists({ _id: id }),

    findMany: (filter, { skip = 0, limit = 25, sort = { createdAt: -1 } } = {}) =>
        Ticket.find(filter)
            .populate([
                { path: "createdBy", select: "name email role avatar" },
                { path: "assignedTo", select: "name email role avatar" },
            ])
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),

    count: (filter) => Ticket.countDocuments(filter),

    create: (input) => Ticket.create(input),

    save: (ticketDocument) => ticketDocument.save(),

    findOverdueUnbreached: (now) =>
        Ticket.find({
            slaDeadline: { $lte: now },
            slaBreached: false,
            status: { $nin: ["resolved", "closed"] },
        }),

    findApproachingSla: (windowStart, windowEnd) =>
        Ticket.find({
            slaDeadline: { $gt: windowStart, $lte: windowEnd },
            slaBreached: false,
            slaWarningNotifiedAt: null,
            status: { $nin: ["resolved", "closed"] },
        }),

    aggregateByStatus: () => Ticket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    aggregateByPriority: () => Ticket.aggregate([{ $group: { _id: "$priority", count: { $sum: 1 } } }]),
};
