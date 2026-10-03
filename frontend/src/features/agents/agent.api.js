import { request } from "../../shared/api/client.js";

export const agentApi = {
    list: () => request("/agents"),
    create: (agent) => request("/agents", { method: "POST", body: JSON.stringify(agent) }),
    setActive: (id, isActive) => request(`/agents/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    setCategories: (id, categories) => request(`/agents/${id}/categories`, { method: "PATCH", body: JSON.stringify({ categories }) }),
};
