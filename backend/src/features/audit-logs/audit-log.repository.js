import { AuditLog } from "./audit-log.model.js";

export const auditLogRepository = {
    create: (input) => AuditLog.create(input),
    findByTicket: (ticketId) => AuditLog.find({ ticketId }).populate("performedBy", "name email role").sort({ createdAt: -1 }).lean(),
    // The lifecycle entries only: the named actions, plus any edit that moved the status.
    findStatusHistory: (ticketId, actions) =>
        AuditLog.find({
            ticketId,
            $or: [{ action: { $in: actions } }, { "changes.status": { $exists: true } }],
        })
            .populate("performedBy", "name role")
            .sort({ createdAt: -1 })
            .lean(),
    findAll: ({ limit, skip }) =>
        AuditLog.find({})
            .populate("performedBy", "name email role")
            .populate("ticketId", "title")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
    count: () => AuditLog.countDocuments({}),
};
