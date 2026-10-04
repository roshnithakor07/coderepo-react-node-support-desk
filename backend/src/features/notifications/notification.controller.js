import { notificationService } from "./notification.service.js";

export async function listNotifications(request, response, next) {
    try {
        const result = await notificationService.listForUser(request.user.id, {});
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

// Both marks answer with the list as it now stands, so the badge and the rows are right straight away
// instead of waiting for the next poll.
export async function markOneRead(request, response, next) {
    try {
        const result = await notificationService.markOneRead(request.user.id, request.params.notificationId);
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function markAllRead(request, response, next) {
    try {
        const result = await notificationService.markAllRead(request.user.id);
        response.json({ data: result });
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
