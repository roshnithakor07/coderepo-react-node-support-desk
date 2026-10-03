import { Ticket } from "./ticket.model.js";

const populateFields = [
    { path: "createdBy", select: "name email role avatar" },
    { path: "assignedTo", select: "name email role avatar" },
    { path: "replies.author", select: "name email role avatar" },
];

const listPopulateFields = [
    { path: "createdBy", select: "name email role avatar" },
    { path: "assignedTo", select: "name email role avatar" },
];

// Priority and status are word enums, so ordering them by meaning needs a rank, and titles sort
// case-insensitively. All three are added to every list query, which keeps one code path for
// every sort order the UI offers.
const SORT_FIELDS = {
    priorityRank: {
        $switch: {
            branches: [
                { case: { $eq: ["$priority", "critical"] }, then: 4 },
                { case: { $eq: ["$priority", "high"] }, then: 3 },
                { case: { $eq: ["$priority", "medium"] }, then: 2 },
                { case: { $eq: ["$priority", "low"] }, then: 1 },
            ],
            default: 0,
        },
    },
    statusRank: {
        $switch: {
            branches: [
                { case: { $eq: ["$status", "open"] }, then: 1 },
                { case: { $eq: ["$status", "in_progress"] }, then: 2 },
                { case: { $eq: ["$status", "pending"] }, then: 3 },
                { case: { $eq: ["$status", "resolved"] }, then: 4 },
                { case: { $eq: ["$status", "closed"] }, then: 5 },
            ],
            default: 9,
        },
    },
    titleSort: { $toLower: "$title" },
};

const HIDE_SORT_FIELDS = Object.fromEntries(Object.keys(SORT_FIELDS).map((field) => [field, 0]));

export const ticketRepository = {
    findById: (id) => Ticket.findById(id).populate(populateFields),

    findByIdLean: (id) => Ticket.findById(id).populate(populateFields).lean(),

    exists: (id) => Ticket.exists({ _id: id }),

    // Sorting runs in the database so it holds across pages, not only inside the page on screen.
    async findMany(filter, { skip = 0, limit = 25, sort = { createdAt: -1 } } = {}) {
        // An aggregation gets the filter exactly as written, with none of the casting a query does,
        // so id strings have to be turned into ObjectIds first or they quietly match nothing.
        const match = Ticket.find(filter).cast(Ticket);
        const tickets = await Ticket.aggregate([
            { $match: match },
            { $addFields: SORT_FIELDS },
            { $sort: { ...sort, _id: 1 } },
            { $skip: skip },
            { $limit: limit },
            { $project: HIDE_SORT_FIELDS },
        ]);
        return Ticket.populate(tickets, listPopulateFields);
    },

    count: (filter) => Ticket.countDocuments(filter),

    // The counts behind the dashboard tiles, over everything the viewer may see rather than the
    // page of rows on screen.
    async summarize(filter) {
        const match = Ticket.find(filter).cast(Ticket);
        const [summary] = await Ticket.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    open: { $sum: { $cond: [{ $in: ["$status", ["open", "in_progress", "pending"]] }, 1, 0] } },
                    resolved: { $sum: { $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0] } },
                    breached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
                },
            },
            { $project: { _id: 0 } },
        ]);
        return summary || { total: 0, open: 0, resolved: 0, breached: 0 };
    },

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
};
