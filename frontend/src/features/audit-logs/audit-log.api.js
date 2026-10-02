import { request } from "../../shared/api/client.js";

export const auditLogApi = {
    list: ({ page = 1, pageSize = 25 } = {}) => request(`/audit-logs?page=${page}&pageSize=${pageSize}`),
};
