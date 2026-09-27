import dotenv from "dotenv";
dotenv.config({ quiet: true });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AuditLog } from "../features/audit-logs/audit-log.model.js";
import { User } from "../features/auth/user.model.js";
import { CannedResponse } from "../features/canned-responses/canned-response.model.js";
import { Notification } from "../features/notifications/notification.model.js";
import { Settings } from "../features/settings/settings.model.js";
import { Ticket } from "../features/tickets/ticket.model.js";
import { connectDatabase, disconnectDatabase } from "../shared/config/database.js";
import { loadConfig } from "../shared/config/index.js";

const PASSWORD = "SupportDesk@2026";

function hoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
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
    ]);
    await Promise.all([
        User.syncIndexes(),
        Ticket.syncIndexes(),
        AuditLog.syncIndexes(),
        CannedResponse.syncIndexes(),
        Notification.syncIndexes(),
        Settings.syncIndexes(),
    ]);
}

async function seedUsers() {
    console.log("\nSeeding users...");
    const password = await hashPassword();

    const admins = await User.insertMany([
        { name: "Ava Patel", email: "admin1@supportdesk.io", password, role: "admin" },
        { name: "Marcus Chen", email: "admin2@supportdesk.io", password, role: "admin" },
    ]);

    const agents = await User.insertMany([
        { name: "Priya Sharma", email: "agent1@supportdesk.io", password, role: "agent" },
        { name: "Diego Fernandez", email: "agent2@supportdesk.io", password, role: "agent" },
        { name: "Lena Kowalski", email: "agent3@supportdesk.io", password, role: "agent" },
        { name: "Noah Williams", email: "agent4@supportdesk.io", password, role: "agent" },
        { name: "Sofia Rossi", email: "agent5@supportdesk.io", password, role: "agent", isActive: false },
    ]);

    const customers = await User.insertMany([
        { name: "Grace Kim", email: "customer1@supportdesk.io", password, role: "customer" },
        { name: "Omar Haddad", email: "customer2@supportdesk.io", password, role: "customer" },
        { name: "Isabella Rocha", email: "customer3@supportdesk.io", password, role: "customer" },
    ]);

    console.log(`  ${admins.length} admins, ${agents.length} agents, ${customers.length} customers`);
    return { admins, agents, customers };
}

async function seedSettings() {
    console.log("\nSeeding settings...");
    await Settings.create({
        key: "global",
        slaHours: { critical: 1, high: 4, medium: 8, low: 24 },
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
    { title: "Cannot log into my account", priority: "critical", category: "account", status: "open", ageHours: 2, slaOffsetHours: -0.5 },
    { title: "Payment failed but I was charged", priority: "critical", category: "billing", status: "in_progress", ageHours: 5, slaOffsetHours: -4 },
    { title: "App crashes on startup", priority: "high", category: "technical", status: "open", ageHours: 6, slaOffsetHours: -2 },
    { title: "Invoice shows incorrect tax amount", priority: "high", category: "billing", status: "pending", ageHours: 10, slaOffsetHours: -6 },
    { title: "Feature request: dark mode", priority: "low", category: "general", status: "open", ageHours: 20, slaOffsetHours: 4 },
    { title: "Unable to reset password", priority: "high", category: "account", status: "resolved", ageHours: 30, slaOffsetHours: -26, resolvedAfterHours: 3 },
    { title: "Slow dashboard loading times", priority: "medium", category: "technical", status: "in_progress", ageHours: 12, slaOffsetHours: 4 },
    { title: "Duplicate charge on my card", priority: "critical", category: "billing", status: "resolved", ageHours: 48, slaOffsetHours: -47, resolvedAfterHours: 2 },
    { title: "How do I export my data?", priority: "low", category: "general", status: "closed", ageHours: 72, slaOffsetHours: -48, resolvedAfterHours: 5 },
    { title: "Two-factor authentication not working", priority: "high", category: "account", status: "open", ageHours: 3, slaOffsetHours: 1 },
    { title: "Mobile app freezes on upload", priority: "medium", category: "technical", status: "pending", ageHours: 15, slaOffsetHours: -7 },
    { title: "Need to update billing address", priority: "low", category: "billing", status: "resolved", ageHours: 40, slaOffsetHours: -16, resolvedAfterHours: 4 },
    { title: "API returning 500 errors intermittently", priority: "critical", category: "technical", status: "in_progress", ageHours: 1, slaOffsetHours: 0.5 },
    { title: "Trouble understanding my subscription tier", priority: "low", category: "billing", status: "open", ageHours: 8, slaOffsetHours: 16 },
    { title: "Account suspended without explanation", priority: "critical", category: "account", status: "in_progress", ageHours: 4, slaOffsetHours: -3 },
    { title: "Search results are inaccurate", priority: "medium", category: "technical", status: "open", ageHours: 9, slaOffsetHours: -1 },
    { title: "Requesting a demo for enterprise plan", priority: "low", category: "general", status: "closed", ageHours: 96, slaOffsetHours: -72, resolvedAfterHours: 6 },
    { title: "Refund not received after 10 days", priority: "high", category: "billing", status: "pending", ageHours: 25, slaOffsetHours: -21 },
    { title: "Notification emails not arriving", priority: "medium", category: "technical", status: "resolved", ageHours: 18, slaOffsetHours: -10, resolvedAfterHours: 4 },
    { title: "Question about GDPR data deletion", priority: "medium", category: "account", status: "open", ageHours: 7, slaOffsetHours: 1 },
];

const REPLY_SNIPPETS = [
    "Thanks for flagging this - looking into it now.",
    "Could you share a screenshot so we can reproduce the issue?",
    "I've escalated this to our engineering team.",
    "This should be resolved now, please confirm on your end.",
    "Appreciate your patience while we work through this.",
];

async function seedTickets(admins, agents, customers) {
    console.log("\nSeeding tickets...");
    const activeAgents = agents.filter((agent) => agent.isActive);
    const tickets = [];

    for (let index = 0; index < TICKET_BLUEPRINTS.length; index += 1) {
        const blueprint = TICKET_BLUEPRINTS[index];
        const customer = customers[index % customers.length];
        const agent = activeAgents[index % activeAgents.length];
        const createdAt = hoursAgo(blueprint.ageHours);
        const slaDeadline = blueprint.slaOffsetHours >= 0 ? hoursFromNow(blueprint.slaOffsetHours) : hoursAgo(-blueprint.slaOffsetHours);
        const isResolvedLike = blueprint.status === "resolved" || blueprint.status === "closed";
        const resolvedAt = isResolvedLike ? hoursAgo(blueprint.ageHours - blueprint.resolvedAfterHours) : null;
        const slaBreached = slaDeadline.getTime() < Date.now() && !isResolvedLike;

        const replyCount = index % 3;
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
            assignedTo: agent._id,
            slaDeadline,
            slaBreached,
            resolvedAt,
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

async function seedAuditLogs(tickets, admins) {
    console.log("\nSeeding audit logs...");
    const entries = tickets.map((ticket) => ({
        ticketId: ticket._id,
        action: "created",
        performedBy: ticket.createdBy,
        changes: { priority: ticket.priority, category: ticket.category },
        createdAt: ticket.createdAt,
    }));

    const assignEntries = tickets.map((ticket) => ({
        ticketId: ticket._id,
        action: "assigned",
        performedBy: admins[0]._id,
        changes: { assignedTo: String(ticket.assignedTo) },
        createdAt: ticket.createdAt,
    }));

    const created = await AuditLog.insertMany([...entries, ...assignEntries]);
    console.log(`  ${created.length} audit log entries`);
}

async function seedNotifications(tickets, agents, customers) {
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
        if (ticket.slaBreached) {
            notifications.push({
                userId: ticket.assignedTo,
                type: "sla_breached",
                message: `SLA breached for ticket "${ticket.title}".`,
                ticketId: ticket._id,
                isRead: false,
            });
        }
    });

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
        const tickets = await seedTickets(admins, agents, customers);
        await seedAuditLogs(tickets, admins);
        await seedNotifications(tickets, agents, customers);

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
        console.log("   Admin:    admin1@supportdesk.io / admin2@supportdesk.io");
        console.log("   Agent:    agent1@supportdesk.io ... agent5@supportdesk.io (agent5 is inactive)");
        console.log("   Customer: customer1@supportdesk.io ... customer3@supportdesk.io");
        console.log("=================================================\n");
    } catch (error) {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    } finally {
        await disconnectDatabase();
    }
}

seed();
