import { beforeAll, describe, expect, test } from "bun:test";
import { api, loginAs } from "./helpers/api.js";

let admin;

beforeAll(async () => {
    admin = await loginAs("admin");
});

describe("ticket audit trail", () => {
    test("returns the trail for an existing ticket", async () => {
        const { body: list } = await api("/tickets?pageSize=1", { token: admin.token });
        const { status, body } = await api(`/tickets/${list.data.tickets[0]._id}/audit`, { token: admin.token });
        expect(status).toBe(200);
        expect(body.data.map((entry) => entry.action)).toContain("created");
    });

    test("returns 404 for a well-formed id that matches no ticket", async () => {
        const { status, body } = await api("/tickets/000000000000000000000000/audit", { token: admin.token });
        expect(status).toBe(404);
        expect(body.error.code).toBe("TICKET_NOT_FOUND");
    });
});
