import { AppError } from "../../shared/errors/app-error.js";
import { notificationRepository } from "./notification.repository.js";

export const notificationService = {
    notify(userId, type, message, ticketId) {
        if (!userId) return Promise.resolve(null);
        return notificationRepository.create({ userId, type, message, ticketId });
    },

    notifyMany(userIds, type, message, ticketId) {
        const uniqueIds = [...new Set(userIds.filter(Boolean).map(String))];
        if (uniqueIds.length === 0) return Promise.resolve([]);
        return notificationRepository.createMany(uniqueIds.map((userId) => ({ userId, type, message, ticketId })));
    },

    async listForUser(userId, { limit = 50 } = {}) {
        const [items, unreadCount] = await Promise.all([
            notificationRepository.findForUser(userId, limit),
            notificationRepository.unreadCount(userId),
        ]);
        return { items, unreadCount };
    },

    // One notification, and only the reader's own: somebody else's is not theirs to mark, and saying so
    // as a 404 keeps it from telling them it exists at all.
    async markOneRead(userId, notificationId) {
        const result = await notificationRepository.markOneRead(userId, notificationId);
        if (result.matchedCount === 0) {
            throw new AppError(404, "NOTIFICATION_NOT_FOUND", "That notification is not on your list.");
        }
        return this.listForUser(userId, {});
    },

    async markAllRead(userId) {
        await notificationRepository.markAllRead(userId);
        return this.listForUser(userId, {});
    },

    clearAll(userId) {
        return notificationRepository.clearAll(userId);
    },
};
