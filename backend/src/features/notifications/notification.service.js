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

    markRead(userId, ids) {
        if (Array.isArray(ids) && ids.length > 0) return notificationRepository.markRead(userId, ids);
        return notificationRepository.markAllRead(userId);
    },

    clearAll(userId) {
        return notificationRepository.clearAll(userId);
    },
};
