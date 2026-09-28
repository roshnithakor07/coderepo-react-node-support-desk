import { z } from "zod";
import { settingsService } from "./settings.service.js";

const slaHourValue = z.number().int("Use whole hours.").min(1, "Use at least 1 hour.").max(720, "Use at most 720 hours (30 days).");

// Category names are stored in lower case and shown in title case.
const categoryName = z
    .string()
    .trim()
    .min(1, "Category names can't be empty.")
    .max(30, "Category names can be at most 30 characters.")
    .transform((name) => name.toLowerCase());

const updateSchema = z
    .object({
        slaHours: z
            .object({
                critical: slaHourValue.optional(),
                high: slaHourValue.optional(),
                medium: slaHourValue.optional(),
                low: slaHourValue.optional(),
            })
            .strict()
            .optional(),
        categories: z
            .array(categoryName)
            .min(1, "Keep at least one category.")
            .max(20, "Use at most 20 categories.")
            .refine((names) => new Set(names).size === names.length, "Category names must be unique.")
            .optional(),
    })
    .strict()
    .refine((input) => input.slaHours || input.categories, "Change the SLA hours or the categories.");

export async function getSettings(request, response, next) {
    try {
        const settings = await settingsService.getSettings();
        response.json({ data: settings });
    } catch (error) {
        next(error);
    }
}

export async function updateSettings(request, response, next) {
    try {
        const input = updateSchema.parse(request.body);
        const settings = await settingsService.updateSettings(input);
        response.json({ data: settings });
    } catch (error) {
        next(error);
    }
}
