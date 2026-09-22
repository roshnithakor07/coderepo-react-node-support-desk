import { z } from "zod";
import { analyticsService } from "./analytics.service.js";

const querySchema = z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

export async function getDashboard(request, response, next) {
    try {
        const filters = querySchema.parse(request.query);
        const dashboard = await analyticsService.getDashboard(filters);
        response.json({ data: dashboard });
    } catch (error) {
        next(error);
    }
}
