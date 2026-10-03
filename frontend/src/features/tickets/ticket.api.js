import { request } from "../../shared/api/client.js";

export const ticketApi = {
    list: (params = {}) => {
        const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ""));
        const queryString = query.toString();
        return request(`/tickets${queryString ? `?${queryString}` : ""}`);
    },
    stats: () => request("/tickets/stats"),
    get: (id) => request(`/tickets/${id}`),
    create: (ticket) => request("/tickets", { method: "POST", body: JSON.stringify(ticket) }),
    update: (id, patch) => request(`/tickets/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
    reply: (id, reply) => request(`/tickets/${id}/replies`, { method: "POST", body: JSON.stringify(reply) }),
    assign: (id, agentId) => request(`/tickets/${id}/assign`, { method: "POST", body: JSON.stringify({ agentId }) }),
    history: (id) => request(`/tickets/${id}/history`),
    audit: (id) => request(`/tickets/${id}/audit`),
};
