import { request } from "../../shared/api/client.js";

export const agentApi = {
    list: () => request("/agents"),
    create: (agent) => request("/agents", { method: "POST", body: JSON.stringify(agent) }),
    // `options.sendBlockedToQueue` is the admin's explicit choice to deactivate the last cover for a
    // category anyway, sending that work to the unassigned queue.
    setActive: (id, isActive, options = {}) =>
        request(`/agents/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive, ...options }) }),
    // What deactivating would do (tickets handed on, or why it is refused), asked before anything changes.
    previewDeactivation: (id) => request(`/agents/${id}/deactivation-preview`),
    setCategories: (id, categories) => request(`/agents/${id}/categories`, { method: "PATCH", body: JSON.stringify({ categories }) }),
};
