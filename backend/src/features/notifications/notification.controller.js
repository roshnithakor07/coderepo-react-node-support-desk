import { z } from "zod";
import { notificationService } from "./notification.service.js";

const markReadSchema = z
    .object({
        ids: z.array(z.string()).optional(),
    })
    .strict();

export async function listNotifications(request, response, next) {
    try {
        const result = await notificationService.listForUser(request.user.id, {});
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function markNotificationsRead(request, response, next) {
    try {
        const { ids } = markReadSchema.parse(request.body ?? {});
        await notificationService.markRead(request.user.id, ids);
        response.json({ data: { success: true } });
    } catch (error) {
        next(error);
    }
}

export async function clearNotifications(request, response, next) {
    try {
        await notificationService.clearAll(request.user.id);
        response.json({ data: { success: true } });
    } catch (error) {
        next(error);
    }
}
