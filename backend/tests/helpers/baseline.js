import { AuditLog } from "../../src/features/audit-logs/audit-log.model.js";
import { User } from "../../src/features/auth/user.model.js";
import { CannedResponse } from "../../src/features/canned-responses/canned-response.model.js";
import { Notification } from "../../src/features/notifications/notification.model.js";
import { Settings } from "../../src/features/settings/settings.model.js";
import { Ticket } from "../../src/features/tickets/ticket.model.js";

// Captured right after seeding, before any test runs, so baseline assertions do not
// depend on the order in which other test files create or change data.
let baseline = null;

export async function captureSeedBaseline() {
    const [admins, agents, customers, tickets, auditLogs, cannedResponses, notifications, settings, unreadNotifications] =
        await Promise.all([
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ role: "agent" }),
            User.countDocuments({ role: "customer" }),
            Ticket.countDocuments(),
            AuditLog.countDocuments(),
            CannedResponse.countDocuments(),
            Notification.countDocuments(),
            Settings.countDocuments(),
            Notification.countDocuments({ isRead: false }),
        ]);
    const assigned = await Notification.find({ type: "ticket_assigned" }).sort({ _id: 1 }).lean();
    const cannedTitles = (await CannedResponse.find().lean()).map((response) => response.title);

    baseline = {
        counts: { admins, agents, customers, tickets, auditLogs, cannedResponses, notifications, settings },
        unreadNotifications,
        assignedReadPattern: assigned.map((notification) => notification.isRead),
        cannedTitles,
    };
}

export function seedBaseline() {
    if (!baseline) throw new Error("The seed baseline was not captured; run tests through `bun run test`.");
    return baseline;
}
