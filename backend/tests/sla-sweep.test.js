import { describe, expect, test } from "bun:test";
import { AuditLog } from "../src/features/audit-logs/audit-log.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { ticketService } from "../src/features/tickets/ticket.service.js";
import { api, loginAs } from "./helpers/api.js";

describe("SLA sweep", () => {
    test("flags an overdue ticket and records the breach as the system, not the customer", async () => {
        const customer = await loginAs("customer");
        const admin = await loginAs("admin");
        const created = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: { title: "SLA sweep attribution check", description: "Overdue on purpose.", priority: "high" },
        });
        expect(created.status).toBe(201);
        const ticketId = created.body.data._id;
        await Ticket.updateOne({ _id: ticketId }, { $set: { slaDeadline: new Date(Date.now() - 60 * 1000) } });

        await ticketService.runSlaSweep();

        expect((await Ticket.findById(ticketId).lean()).slaBreached).toBe(true);
        const entry = await AuditLog.findOne({ ticketId, action: "sla_breached" }).lean();
        expect(entry.performedBy).toBeNull();

        const trail = await api(`/tickets/${ticketId}/audit`, { token: admin.token });
        const breach = trail.body.data.find((item) => item.action === "sla_breached");
        expect(breach.performedBy).toBeNull();
        expect(trail.body.data.some((item) => item.action === "sla_breached" && item.performedBy?.role === "customer")).toBe(false);
    });
});
