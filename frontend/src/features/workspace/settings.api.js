import { request } from "../../shared/api/client.js";

export const settingsApi = {
    get: () => request("/settings"),
    update: (patch) => request("/settings", { method: "PUT", body: JSON.stringify(patch) }),
};
