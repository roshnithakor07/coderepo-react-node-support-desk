import { request } from "../../shared/api/client.js";

export const authApi = {
    register: (input) => request("/auth/register", { method: "POST", body: JSON.stringify(input) }),
    login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    logout: () => request("/auth/logout", { method: "POST" }),
    me: () => request("/auth/me"),
};
