import { request } from "../../shared/api/client.js";

export const notificationApi = {
    list: () => request("/notifications"),
    // Both answer with the list as it now stands, so the badge is right without another round trip.
    markOneRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
    clear: () => request("/notifications/clear", { method: "DELETE" }),
};
