import { describe, expect, test } from "bun:test";
import { AuditLog } from "../src/features/audit-logs/audit-log.model.js";
import { User } from "../src/features/auth/user.model.js";
import { CannedResponse } from "../src/features/canned-responses/canned-response.model.js";
import { Notification } from "../src/features/notifications/notification.model.js";
import { Settings } from "../src/features/settings/settings.model.js";
import { Ticket } from "../src/features/tickets/ticket.model.js";

describe("seeded baseline", () => {
    test("inserts the documented collection counts", async () => {
        const counts = await Promise.all([
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ role: "agent" }),
            User.countDocuments({ role: "customer" }),
            Ticket.countDocuments(),
            AuditLog.countDocuments(),
            CannedResponse.countDocuments(),
            Notification.countDocuments(),
            Settings.countDocuments(),
        ]);
        expect(counts).toEqual([2, 5, 3, 20, 40, 5, 12, 1]);
    });

    test("seeds notification read state deterministically", async () => {
        const assigned = await Notification.find({ type: "ticket_assigned" }).sort({ _id: 1 }).lean();
        expect(assigned.map((notification) => notification.isRead)).toEqual([false, true, false, true, false, true, false, true]);
        expect(await Notification.countDocuments({ isRead: false })).toBe(8);
    });

    test("uses American English in seeded content", async () => {
        const titles = (await CannedResponse.find().lean()).map((response) => response.title);
        expect(titles).toContain("Welcome & Acknowledgment");
        expect(titles.join(" ")).not.toContain("Acknowledgement");
    });
});
