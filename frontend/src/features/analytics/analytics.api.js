import { request } from "../../shared/api/client.js";

export const analyticsApi = {
    getDashboard: (params = {}) => {
        const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
        const queryString = query.toString();
        return request(`/analytics${queryString ? `?${queryString}` : ""}`);
    },
};
