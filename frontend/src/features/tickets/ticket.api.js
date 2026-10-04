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
    updateReply: (id, replyId, body) => request(`/tickets/${id}/replies/${replyId}`, { method: "PUT", body: JSON.stringify({ body }) }),
    deleteReply: (id, replyId) => request(`/tickets/${id}/replies/${replyId}`, { method: "DELETE" }),
    assign: (id, agentId) => request(`/tickets/${id}/assign`, { method: "POST", body: JSON.stringify({ agentId }) }),
    // All or nothing: a rejection carries `details.rejections`, one entry per ticket that broke a rule.
    bulkAssign: (ticketIds, agentId) => request("/tickets/bulk/assign", { method: "POST", body: JSON.stringify({ ticketIds, agentId }) }),
    bulkStatus: (ticketIds, status) => request("/tickets/bulk/status", { method: "POST", body: JSON.stringify({ ticketIds, status }) }),
    bulkPriority: (ticketIds, priority) =>
        request("/tickets/bulk/priority", { method: "POST", body: JSON.stringify({ ticketIds, priority }) }),
    mergeCandidates: (id) => request(`/tickets/${id}/merge-candidates`),
    merge: (id, primaryId) => request(`/tickets/${id}/merge`, { method: "POST", body: JSON.stringify({ primaryId }) }),
    history: (id) => request(`/tickets/${id}/history`),
    audit: (id) => request(`/tickets/${id}/audit`),
};
