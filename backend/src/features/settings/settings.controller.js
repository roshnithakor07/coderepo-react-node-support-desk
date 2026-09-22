import { z } from "zod";
import { settingsService } from "./settings.service.js";

const updateSchema = z
    .object({
        slaHours: z
            .object({
                critical: z.number().positive().optional(),
                high: z.number().positive().optional(),
                medium: z.number().positive().optional(),
                low: z.number().positive().optional(),
            })
            .optional(),
        categories: z.array(z.string().trim().min(1)).optional(),
    })
    .strict();

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
