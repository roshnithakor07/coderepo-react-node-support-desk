import { request } from "../../shared/api/client.js";

export const notificationApi = {
    list: () => request("/notifications"),
    markRead: (ids) => request("/notifications/read", { method: "PUT", body: JSON.stringify({ ids }) }),
    clear: () => request("/notifications/clear", { method: "DELETE" }),
};
