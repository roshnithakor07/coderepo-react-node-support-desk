import { Router } from "express";
import { validateObjectIdParam } from "../../shared/middleware/validate-object-id.js";
import { clearNotifications, listNotifications, markAllRead, markOneRead } from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.param("notificationId", validateObjectIdParam);

notificationRouter.get("/", listNotifications);
// Reading one is the row being opened; reading the lot is the header's own action. Opening the panel
// marks nothing, so a notification stays unread until it has actually been looked at.
notificationRouter.patch("/read-all", markAllRead);
notificationRouter.patch("/:notificationId/read", markOneRead);
notificationRouter.delete("/clear", clearNotifications);
