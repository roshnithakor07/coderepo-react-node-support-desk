import { z } from "zod";
import { auditLogService } from "./audit-log.service.js";

const listSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export async function listAuditLogs(request, response, next) {
    try {
        const query = listSchema.parse(request.query);
        const result = await auditLogService.listAll(query);
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}
