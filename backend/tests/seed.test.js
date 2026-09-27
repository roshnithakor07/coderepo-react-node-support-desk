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
});
