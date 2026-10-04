import { Notification } from "./notification.model.js";

export const notificationRepository = {
    create: (input) => Notification.create(input),
    createMany: (inputs) => Notification.insertMany(inputs),
    findForUser: (userId, limit) => Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
    unreadCount: (userId) => Notification.countDocuments({ userId, isRead: false }),
    // Scoped to the owner, so another user's notification simply matches nothing.
    markOneRead: (userId, id) => Notification.updateOne({ _id: id, userId }, { $set: { isRead: true } }),
    markAllRead: (userId) => Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } }),
    clearAll: (userId) => Notification.deleteMany({ userId }),
};
