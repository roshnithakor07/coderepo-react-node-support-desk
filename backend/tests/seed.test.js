import { describe, expect, test } from "bun:test";
import { seedBaseline } from "./helpers/baseline.js";

describe("seeded baseline", () => {
    test("inserts the documented collection counts", () => {
        expect(seedBaseline().counts).toEqual({
            admins: 2,
            agents: 5,
            customers: 3,
            tickets: 20,
            auditLogs: 40,
            cannedResponses: 5,
            notifications: 12,
            settings: 1,
        });
    });

    test("seeds notification read state deterministically", () => {
        expect(seedBaseline().assignedReadPattern).toEqual([false, true, false, true, false, true, false, true]);
        expect(seedBaseline().unreadNotifications).toBe(8);
    });

    test("uses American English in seeded content", () => {
        const { cannedTitles } = seedBaseline();
        expect(cannedTitles).toContain("Welcome & Acknowledgment");
        expect(cannedTitles.join(" ")).not.toContain("Acknowledgement");
    });

    test("every seeded deadline follows the seeded SLA hours for its priority", () => {
        const { hours, tickets } = seedBaseline().sla;
        const wrong = tickets.filter(
            (ticket) => new Date(ticket.slaDeadline).getTime() !== new Date(ticket.createdAt).getTime() + hours[ticket.priority] * 3600000,
        );
        expect(wrong.map((ticket) => ticket.title)).toEqual([]);
    });

    test("a ticket is marked breached exactly when it is open past its deadline or was resolved after it", () => {
        const { tickets } = seedBaseline().sla;
        const inconsistent = tickets.filter((ticket) => {
            const finishedOrNow = ticket.resolvedAt ? new Date(ticket.resolvedAt) : new Date();
            return ticket.slaBreached !== finishedOrNow > new Date(ticket.slaDeadline);
        });
        expect(inconsistent.map((ticket) => ticket.title)).toEqual([]);
        expect(tickets.find((ticket) => ticket.title === "Duplicate charge on my card").slaBreached).toBe(true);
    });

    test("SLA breach alerts are seeded only for tickets that are still open", () => {
        const { breachNotificationTicketIds, resolvedTicketIds } = seedBaseline().sla;
        expect(breachNotificationTicketIds.length).toBeGreaterThan(0);
        expect(breachNotificationTicketIds.filter((id) => resolvedTicketIds.includes(id))).toEqual([]);
    });
});
