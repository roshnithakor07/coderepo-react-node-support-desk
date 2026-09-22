import { Router } from "express";
import { clearNotifications, listNotifications, markNotificationsRead } from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.get("/", listNotifications);
notificationRouter.put("/read", markNotificationsRead);
notificationRouter.delete("/clear", clearNotifications);
