import { z } from "zod";
import { analyticsService } from "./analytics.service.js";

const calendarDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.")
    .refine((value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, "Use a real calendar date.");

const querySchema = z
    .object({
        dateFrom: calendarDate.optional(),
        dateTo: calendarDate.optional(),
    })
    .refine((range) => !range.dateFrom || !range.dateTo || range.dateFrom <= range.dateTo, {
        message: "The start date must be on or before the end date.",
        path: ["dateFrom"],
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
