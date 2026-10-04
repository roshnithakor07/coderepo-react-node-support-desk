import dotenv from "dotenv";
dotenv.config({ quiet: true });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AuditLog } from "../features/audit-logs/audit-log.model.js";
import { RevokedToken } from "../features/auth/revoked-token.model.js";
import { User } from "../features/auth/user.model.js";
import { CannedResponse } from "../features/canned-responses/canned-response.model.js";
import { Notification } from "../features/notifications/notification.model.js";
import { Settings } from "../features/settings/settings.model.js";
import { Ticket } from "../features/tickets/ticket.model.js";
import { connectDatabase, disconnectDatabase } from "../shared/config/database.js";
import { loadConfig } from "../shared/config/index.js";

const PASSWORD = "SupportDesk@2026";
const SLA_HOURS = { critical: 1, high: 4, medium: 8, low: 24 };

function hoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function hashPassword() {
    return bcrypt.hash(PASSWORD, 10);
}

async function clearDatabase() {
    await Promise.all([
        User.deleteMany({}),
        Ticket.deleteMany({}),
        AuditLog.deleteMany({}),
        CannedResponse.deleteMany({}),
        Notification.deleteMany({}),
        Settings.deleteMany({}),
        RevokedToken.deleteMany({}),
    ]);
    await Promise.all([
        User.syncIndexes(),
        Ticket.syncIndexes(),
        AuditLog.syncIndexes(),
        CannedResponse.syncIndexes(),
        Notification.syncIndexes(),
        Settings.syncIndexes(),
        RevokedToken.syncIndexes(),
    ]);
}

async function seedUsers() {
    console.log("\nSeeding users...");
    const password = await hashPassword();

    const admins = await User.insertMany([
        { name: "Ava Patel", email: "admin1@example.com", password, role: "admin" },
        { name: "Marcus Chen", email: "admin2@example.com", password, role: "admin" },
    ]);

    // Every agent works one or more categories. Among the active agents, "general" is deliberately
    // covered by Noah alone, so that category has a single point of failure the Agents page shows.
    const agents = await User.insertMany([
        { name: "Priya Sharma", email: "agent1@example.com", password, role: "agent", categories: ["billing", "technical"] },
        { name: "Diego Fernandez", email: "agent2@example.com", password, role: "agent", categories: ["technical", "account"] },
        { name: "Lena Kowalski", email: "agent3@example.com", password, role: "agent", categories: ["billing", "account"] },
        { name: "Noah Williams", email: "agent4@example.com", password, role: "agent", categories: ["general"] },
        {
            name: "Sofia Rossi",
            email: "agent5@example.com",
            password,
            role: "agent",
            categories: ["general", "account"],
            isActive: false,
        },
    ]);

    const customers = await User.insertMany([
        { name: "Grace Kim", email: "customer1@example.com", password, role: "customer" },
        { name: "Omar Haddad", email: "customer2@example.com", password, role: "customer" },
        { name: "Isabella Rocha", email: "customer3@example.com", password, role: "customer" },
    ]);

    console.log(`  ${admins.length} admins, ${agents.length} agents, ${customers.length} customers`);
    return { admins, agents, customers };
}

async function seedSettings() {
    console.log("\nSeeding settings...");
    await Settings.create({
        key: "global",
        slaHours: SLA_HOURS,
        categories: ["general", "billing", "technical", "account"],
    });
    console.log("  1 settings document");
}

async function seedCannedResponses(admins, agents) {
    console.log("\nSeeding canned responses...");
    const responses = await CannedResponse.insertMany([
        {
            title: "Welcome & Acknowledgment",
            body: "Hi there, thanks for reaching out. We've received your request and a member of our team will follow up shortly.",
            category: "general",
            createdBy: admins[0]._id,
            isGlobal: true,
        },
        {
            title: "Billing - Refund Processed",
            body: "Your refund has been processed and should appear on your statement within 5-7 business days.",
            category: "billing",
            createdBy: admins[0]._id,
            isGlobal: true,
        },
        {
            title: "Technical - Restart Suggestion",
            body: "Could you please try restarting the application and let us know if the issue persists?",
            category: "technical",
            createdBy: admins[1]._id,
            isGlobal: true,
        },
        {
            title: "Closing - Resolved",
            body: "Glad we could resolve this for you! Feel free to reopen this ticket if you run into the issue again.",
            category: "general",
            createdBy: admins[1]._id,
            isGlobal: true,
        },
        {
            title: "My Quick Follow-up",
            body: "Just checking in - were you able to try the steps above?",
            category: "general",
            createdBy: agents[0]._id,
            isGlobal: false,
        },
    ]);
    console.log(`  ${responses.length} canned responses`);
    return responses;
}

const CATEGORIES = ["general", "billing", "technical", "account"];

// One blueprint per line keeps the seeded tickets readable as a table.
// prettier-ignore
const TICKET_BLUEPRINTS = [
    { title: "Cannot log into my account", priority: "critical", category: "account", status: "open", ageHours: 2 },
    { title: "Payment failed but I was charged", priority: "critical", category: "billing", status: "in_progress", ageHours: 5 },
    { title: "App crashes on startup", priority: "high", category: "technical", status: "open", ageHours: 6 },
    { title: "Invoice shows incorrect tax amount", priority: "high", category: "billing", status: "pending", ageHours: 10 },
    { title: "Feature request: dark mode", priority: "low", category: "general", status: "open", ageHours: 20 },
    { title: "Unable to reset password", priority: "high", category: "account", status: "resolved", ageHours: 30, resolvedAfterHours: 3 },
    { title: "Slow dashboard loading times", priority: "medium", category: "technical", status: "in_progress", ageHours: 4 },
    { title: "Duplicate charge on my card", priority: "critical", category: "billing", status: "resolved", ageHours: 48, resolvedAfterHours: 2 },
    { title: "How do I export my data?", priority: "low", category: "general", status: "closed", ageHours: 72, resolvedAfterHours: 5, closedAfterHours: 7 },
    { title: "Two-factor authentication not working", priority: "high", category: "account", status: "open", ageHours: 3 },
    { title: "Mobile app freezes on upload", priority: "medium", category: "technical", status: "pending", ageHours: 15 },
    { title: "Need to update billing address", priority: "low", category: "billing", status: "resolved", ageHours: 40, resolvedAfterHours: 4 },
    { title: "API returning 500 errors intermittently", priority: "critical", category: "technical", status: "in_progress", ageHours: 0.5 },
    { title: "Trouble understanding my subscription tier", priority: "low", category: "billing", status: "open", ageHours: 8 },
    { title: "Account suspended without explanation", priority: "critical", category: "account", status: "in_progress", ageHours: 4 },
    { title: "Search results are inaccurate", priority: "medium", category: "technical", status: "open", ageHours: 9 },
    { title: "Requesting a demo for enterprise plan", priority: "low", category: "general", status: "closed", ageHours: 96, resolvedAfterHours: 6, closedAfterHours: 8 },
    { title: "Refund not received after 10 days", priority: "high", category: "billing", status: "pending", ageHours: 25 },
    { title: "Notification emails not arriving", priority: "medium", category: "technical", status: "resolved", ageHours: 18, resolvedAfterHours: 4 },
    { title: "Question about GDPR data deletion", priority: "medium", category: "account", status: "open", ageHours: 7 },
    // Closed three weeks ago: past the 14-day reopen window, so the ticket page shows why it cannot
    // be reopened and points the customer at a new ticket.
    { title: "Old import job never finished", priority: "medium", category: "technical", status: "closed", ageHours: 504, resolvedAfterHours: 9, closedAfterHours: 11 },
    // Nobody picked these two up, which is what the unassigned queue and the admin "no assignee"
    // alert are for. They sit in different categories, so each agent's queue shows only its own.
    { title: "Cannot download my past invoices", priority: "medium", category: "billing", status: "open", ageHours: 1, unassigned: true },
    { title: "Where do I find my account history?", priority: "low", category: "general", status: "open", ageHours: 13, unassigned: true },
    // The same problem raised twice by one customer, a day apart: what ticket merge is for. It belongs
    // to the customer of "Two-factor authentication not working", so the two can be merged.
    { title: "Login code never arrives by text", priority: "high", category: "account", status: "open", ageHours: 30, customerOf: "Two-factor authentication not working" },
];

const REPLY_SNIPPETS = [
    "Thanks for flagging this - looking into it now.",
    "Could you share a screenshot so we can reproduce the issue?",
    "I've escalated this to our engineering team.",
    "This should be resolved now, please confirm on your end.",
    "Appreciate your patience while we work through this.",
];

// A ticket only ever sits with an agent whose team covers its category, so the team rule is already
// true of the seeded board. Round-robin within the eligible agents spreads the workload, and
// `null` means nobody active covers it, which puts the ticket in the unassigned queue.
function pickAgent(activeAgents, category, index) {
    const eligible = activeAgents.filter((agent) => agent.categories.includes(category));
    return eligible.length > 0 ? eligible[index % eligible.length] : null;
}

async function seedTickets(agents, customers) {
    console.log("\nSeeding tickets...");
    const activeAgents = agents.filter((agent) => agent.isActive);
    const tickets = [];

    for (let index = 0; index < TICKET_BLUEPRINTS.length; index += 1) {
        const blueprint = TICKET_BLUEPRINTS[index];
        // A duplicate is seeded for the same customer as the ticket it duplicates.
        const sameAs = blueprint.customerOf ? TICKET_BLUEPRINTS.findIndex((other) => other.title === blueprint.customerOf) : index;
        const customer = customers[sameAs % customers.length];
        const agent = blueprint.unassigned ? null : pickAgent(activeAgents, blueprint.category, index);
        // The deadline follows the seeded SLA hours for the ticket's priority, like a ticket created in the app.
        // A ticket is breached if it is still open past its deadline, or was resolved after it.
        const createdAt = hoursAgo(blueprint.ageHours);
        const slaDeadline = new Date(createdAt.getTime() + SLA_HOURS[blueprint.priority] * 60 * 60 * 1000);
        const isResolvedLike = blueprint.status === "resolved" || blueprint.status === "closed";
        const resolvedAt = isResolvedLike ? hoursAgo(blueprint.ageHours - blueprint.resolvedAfterHours) : null;
        // Closing starts the 14-day reopen window, so a closed ticket carries the moment it closed.
        const closedAt = blueprint.status === "closed" ? hoursAgo(blueprint.ageHours - blueprint.closedAfterHours) : null;
        const slaBreached = (resolvedAt || new Date()).getTime() > slaDeadline.getTime();

        const replyCount = agent ? index % 3 : 0;
        const replies = [];
        for (let replyIndex = 0; replyIndex < replyCount; replyIndex += 1) {
            const isAgentReply = replyIndex % 2 === 0;
            replies.push({
                body: REPLY_SNIPPETS[(index + replyIndex) % REPLY_SNIPPETS.length],
                author: isAgentReply ? agent._id : customer._id,
                isInternal: isAgentReply && replyIndex === 0 && index % 4 === 0,
                createdAt: hoursAgo(blueprint.ageHours - replyIndex - 1 > 0 ? blueprint.ageHours - replyIndex - 1 : 0),
            });
        }

        const ticket = {
            title: blueprint.title,
            description: `${blueprint.title}. Customer reports this affects their day-to-day usage and requests a timely update.`,
            status: blueprint.status,
            priority: blueprint.priority,
            category: blueprint.category,
            tags: [blueprint.category, blueprint.priority],
            createdBy: customer._id,
            assignedTo: agent ? agent._id : null,
            slaStartedAt: createdAt,
            slaDeadline,
            slaBreached,
            resolvedAt,
            closedAt,
            // The admins are told about an unowned ticket once, and the seeded alert below is that one time.
            unassignedNotifiedAt: agent ? null : createdAt,
            replies,
            createdAt,
            updatedAt: createdAt,
        };

        tickets.push(ticket);
    }

    const created = await Ticket.insertMany(tickets);
    console.log(`  ${created.length} tickets (${created.filter((t) => t.slaBreached).length} SLA-breached)`);
    return created;
}

// The moves a ticket must have made to reach the status it is seeded in, so the status history on
// the ticket page reads as a real lifecycle on day one instead of a single "Opened" line.
function lifecycleEntries(ticket, performedBy) {
    if (ticket.status === "open") return [];

    const created = new Date(ticket.createdAt).getTime();
    const finished = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : Date.now();
    const partWay = (fraction) => new Date(created + (finished - created) * fraction);

    const moves = [["open", "in_progress", partWay(0.25)]];
    if (ticket.status === "pending") moves.push(["in_progress", "pending", partWay(0.6)]);
    if (ticket.resolvedAt) moves.push(["in_progress", "resolved", new Date(ticket.resolvedAt)]);
    if (ticket.closedAt) moves.push(["resolved", "closed", new Date(ticket.closedAt)]);

    return moves.map(([from, to, at]) => ({
        ticketId: ticket._id,
        action: "updated",
        performedBy,
        changes: { status: { from, to } },
        createdAt: at,
    }));
}

async function seedAuditLogs(tickets, admins, agents) {
    const agentNames = new Map(agents.map((agent) => [String(agent._id), agent.name]));
    console.log("\nSeeding audit logs...");
    const entries = tickets.map((ticket) => ({
        ticketId: ticket._id,
        action: "created",
        performedBy: ticket.createdBy,
        changes: { priority: ticket.priority, category: ticket.category },
        createdAt: ticket.createdAt,
    }));

    const lifecycle = tickets.flatMap((ticket) => lifecycleEntries(ticket, ticket.assignedTo || admins[0]._id));

    const assignEntries = tickets
        .filter((ticket) => ticket.assignedTo)
        .map((ticket) => ({
            ticketId: ticket._id,
            action: "assigned",
            performedBy: admins[0]._id,
            changes: { assignedTo: agentNames.get(String(ticket.assignedTo)) },
            createdAt: ticket.createdAt,
        }));

    const created = await AuditLog.insertMany([...entries, ...assignEntries, ...lifecycle]);
    console.log(`  ${created.length} audit log entries`);
}

async function seedNotifications(tickets, admins) {
    console.log("\nSeeding notifications...");
    const notifications = [];

    tickets.slice(0, 8).forEach((ticket, index) => {
        notifications.push({
            userId: ticket.assignedTo,
            type: "ticket_assigned",
            message: `You were assigned ticket "${ticket.title}".`,
            ticketId: ticket._id,
            isRead: index % 2 === 1,
        });
        // Breach alerts go out only while a ticket is open, as the SLA sweep does. Admins watch the
        // whole board, so they get the same alert.
        if (ticket.slaBreached && !ticket.resolvedAt) {
            for (const userId of [ticket.assignedTo, ...admins.map((admin) => admin._id)]) {
                notifications.push({
                    userId,
                    type: "sla_breached",
                    message: `SLA breached for ticket "${ticket.title}".`,
                    ticketId: ticket._id,
                    isRead: false,
                });
            }
        }
    });

    // A ticket nobody owns is the admins' problem, exactly as the sweep reports it.
    for (const ticket of tickets.filter((ticket) => !ticket.assignedTo)) {
        for (const admin of admins) {
            notifications.push({
                userId: admin._id,
                type: "ticket_unassigned",
                message: `Ticket "${ticket.title}" has no assignee and is waiting to be picked up.`,
                ticketId: ticket._id,
                isRead: false,
            });
        }
    }

    const created = await Notification.insertMany(notifications);
    console.log(`  ${created.length} notifications`);
}

async function seed() {
    console.log("=================================================");
    console.log(" Support Desk - Database Seed");
    console.log("=================================================");

    const config = loadConfig();
    await connectDatabase(config.mongodbUri);

    try {
        await clearDatabase();

        const { admins, agents, customers } = await seedUsers();
        await seedSettings();
        await seedCannedResponses(admins, agents);
        const tickets = await seedTickets(agents, customers);
        await seedAuditLogs(tickets, admins, agents);
        await seedNotifications(tickets, admins);

        const [userCount, ticketCount, auditCount, cannedCount, notificationCount] = await Promise.all([
            User.countDocuments(),
            Ticket.countDocuments(),
            AuditLog.countDocuments(),
            CannedResponse.countDocuments(),
            Notification.countDocuments(),
        ]);

        console.log("\n=================================================");
        console.log(" Seed complete");
        console.log("=================================================");
        console.log(`  Users: ${userCount}  Tickets: ${ticketCount}  Audit logs: ${auditCount}`);
        console.log(`  Canned responses: ${cannedCount}  Notifications: ${notificationCount}`);
        console.log("\n Seeded login credentials (all use the same password):");
        console.log(`   Password: ${PASSWORD}`);
        console.log("   Admin:    admin1@example.com / admin2@example.com");
        console.log("   Agent:    agent1@example.com ... agent5@example.com (agent5 is inactive)");
        console.log("             teams: agent1 billing+technical, agent2 technical+account,");
        console.log("                    agent3 billing+account, agent4 general, agent5 general+account");
        console.log("   Customer: customer1@example.com ... customer3@example.com");
        console.log("=================================================\n");
    } catch (error) {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    } finally {
        await disconnectDatabase();
    }
}

seed();
