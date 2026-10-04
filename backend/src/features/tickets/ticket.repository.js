import mongoose from "mongoose";
import { Ticket } from "./ticket.model.js";

// The assignee's categories come along because the team rules are checked against them: refiling a
// ticket has to know whether whoever owns it covers the new category.
const populateFields = [
    { path: "createdBy", select: "name email role avatar" },
    { path: "assignedTo", select: "name email role avatar categories" },
    { path: "replies.author", select: "name email role avatar" },
    // A merged duplicate links to the ticket its conversation moved to.
    { path: "mergedInto", select: "title status" },
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

// A list row is a summary: it says how many replies the conversation has, never the replies themselves,
// which can run to hundreds per ticket. `publicReplyCount` is what a customer may be told, since the
// internal notes among the replies are not theirs to count. Computed after the page is cut, so only the
// rows on screen are measured.
const REPLY_COUNTS = {
    replyCount: { $size: { $ifNull: ["$replies", []] } },
    publicReplyCount: {
        $size: { $filter: { input: { $ifNull: ["$replies", []] }, cond: { $ne: ["$$this.isInternal", true] } } },
    },
};

const HIDE_SORT_FIELDS = { ...Object.fromEntries(Object.keys(SORT_FIELDS).map((field) => [field, 0])), replies: 0 };

export const ticketRepository = {
    findById: (id) => Ticket.findById(id).populate(populateFields),

    findByIdLean: (id) => Ticket.findById(id).populate(populateFields).lean(),

    // The ticket as its page shows it: the latest page of the conversation rather than all of it, plus
    // how many replies there are in all. A ticket with hundreds of replies then answers with a small
    // document, and the page asks for the older ones only when somebody scrolls back.
    async findByIdDetail(id, pageSize) {
        const ticket = await Ticket.findById(id, { replies: { $slice: -pageSize } })
            .populate(populateFields)
            .lean();
        if (!ticket) return null;
        const counts = await this.countReplies(id);
        return { ...ticket, replyCount: counts.total, publicReplyCount: counts.public, publicStaffReplyCount: counts.publicStaff };
    },

    // Just enough of the ticket to decide who may read its conversation, with none of it loaded.
    findByIdForAccess: (id) => Ticket.findById(id, { replies: 0 }).populate(listPopulateFields).lean(),

    // Counted in the database, because the point of the page window is never to load every reply.
    // `publicStaff` is what the "resolving needs an answer the customer can read" rule asks about: a
    // reply from somebody other than the requester, which may well be older than the page on screen.
    async countReplies(id) {
        const [row] = await Ticket.aggregate([
            { $match: Ticket.find({ _id: id }).cast(Ticket) },
            {
                $project: {
                    total: { $size: "$replies" },
                    public: { $size: { $filter: { input: "$replies", cond: { $ne: ["$$this.isInternal", true] } } } },
                    publicStaff: {
                        $size: {
                            $filter: {
                                input: "$replies",
                                cond: { $and: [{ $ne: ["$$this.isInternal", true] }, { $ne: ["$$this.author", "$createdBy"] }] },
                            },
                        },
                    },
                },
            },
        ]);
        return row ? { total: row.total, public: row.public, publicStaff: row.publicStaff } : { total: 0, public: 0, publicStaff: 0 };
    },

    // The page of replies immediately before one of them, oldest first, with the next cursor and
    // whether anything is left behind it. Positions in the array are the order the conversation was
    // written in, which is also the order a merge leaves it in, so paging follows the thread exactly.
    // `beforeReplyId` is null for the latest page.
    async findRepliesBefore(id, beforeReplyId, limit) {
        const cursor = beforeReplyId ? new mongoose.Types.ObjectId(String(beforeReplyId)) : null;
        const [row] = await Ticket.aggregate([
            { $match: Ticket.find({ _id: id, ...(cursor ? { "replies._id": cursor } : {}) }).cast(Ticket) },
            // Where the page ends: at the cursor, or at the end of the conversation when there is none.
            { $project: { replies: 1, end: cursor ? { $indexOfArray: ["$replies._id", cursor] } : { $size: "$replies" } } },
            { $project: { replies: 1, end: 1, start: { $max: [0, { $subtract: ["$end", limit] }] } } },
            {
                $project: {
                    start: 1,
                    // $slice needs a positive count, so an empty page is answered as one.
                    page: { $cond: [{ $lte: ["$end", 0] }, [], { $slice: ["$replies", "$start", { $subtract: ["$end", "$start"] }] }] },
                },
            },
        ]);
        if (!row) return null;
        await Ticket.populate(row, { path: "page.author", model: "User", select: "name email role avatar" });
        return { replies: row.page, hasEarlier: row.start > 0 };
    },

    // Atomic by design: the push matches only while the conversation is still under the limit, because
    // `replies.<limit - 1>` exists exactly when it is full. Two replies sent in the same moment both
    // run this, and the second one matches nothing rather than taking the ticket past the limit.
    pushReply: (id, reply, limit) =>
        Ticket.updateOne({ _id: id, [`replies.${limit - 1}`]: { $exists: false } }, { $push: { replies: reply } }),

    exists: (id) => Ticket.exists({ _id: id }),

    // Documents rather than plain objects, because a bulk action checks the same rules the single
    // action does, and those read the ticket the way a saved document presents it.
    findManyByIds: (ids) => Ticket.find({ _id: { $in: ids } }).populate(populateFields),

    // What an agent is working right now: the tickets that move when they are deactivated. Oldest
    // first, so the plan is the same every time it is made.
    findOpenAssignedTo: (agentId, activeStatuses) =>
        Ticket.find({ assignedTo: agentId, status: { $in: activeStatuses } })
            .sort({ createdAt: 1, _id: 1 })
            .populate(populateFields),

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
            { $addFields: REPLY_COUNTS },
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

    // How many tickets still in the working queue sit in each of these categories, which is what
    // stops a category being deleted while work is filed under it.
    async countOpenByCategories(categories, activeStatuses) {
        const rows = await Ticket.aggregate([
            { $match: { category: { $in: categories }, status: { $in: activeStatuses } } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
        ]);
        return Object.fromEntries(rows.map((row) => [row._id, row.count]));
    },

    // The customer's other tickets still in play: the only ones a duplicate can be merged into.
    findMergeCandidates: (createdBy, excludeId) =>
        Ticket.find({ createdBy, _id: { $ne: excludeId }, status: { $ne: "closed" } })
            .sort({ createdAt: -1 })
            .populate(populateFields),

    create: (input) => Ticket.create(input),

    save: (ticketDocument) => ticketDocument.save(),

    findOverdueUnbreached: (now) =>
        Ticket.find({
            slaDeadline: { $lte: now },
            slaBreached: false,
            status: { $nin: ["resolved", "closed"] },
        }),

    // Tickets still in the working queue with nobody on them, that the admins have not been told
    // about yet.
    findUnassignedUnnotified: (activeStatuses) =>
        Ticket.find({
            assignedTo: null,
            unassignedNotifiedAt: null,
            status: { $in: activeStatuses },
        }),

    findApproachingSla: (windowStart, windowEnd) =>
        Ticket.find({
            slaDeadline: { $gt: windowStart, $lte: windowEnd },
            slaBreached: false,
            slaWarningNotifiedAt: null,
            status: { $nin: ["resolved", "closed"] },
        }),
};
