import { request } from "../../shared/api/client.js";

export const cannedResponseApi = {
    list: () => request("/canned-responses"),
    create: (input) => request("/canned-responses", { method: "POST", body: JSON.stringify(input) }),
    remove: (id) => request(`/canned-responses/${id}`, { method: "DELETE" }),
};
