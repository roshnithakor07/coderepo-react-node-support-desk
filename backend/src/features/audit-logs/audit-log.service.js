import { auditLogRepository } from "./audit-log.repository.js";

export const auditLogService = {
    record(ticketId, action, performedById, changes = {}) {
        return auditLogRepository.create({ ticketId, action, performedBy: performedById, changes });
    },

    listForTicket(ticketId) {
        return auditLogRepository.findByTicket(ticketId);
    },

    async listAll({ page = 1, pageSize = 25 } = {}) {
        const skip = (page - 1) * pageSize;
        const [entries, total] = await Promise.all([auditLogRepository.findAll({ limit: pageSize, skip }), auditLogRepository.count()]);
        return { entries, total, page, pageSize };
    },
};
