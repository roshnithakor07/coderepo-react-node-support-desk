import crypto from "crypto";
import bcrypt from "bcryptjs";
import { notificationService } from "../notifications/notification.service.js";
import { ticketService } from "../tickets/ticket.service.js";
import { webhookRepository } from "./webhook.repository.js";

function deriveNameFromEmail(email) {
    const localPart = email.split("@")[0] || "Customer";
    return localPart
        .split(/[._-]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

async function findOrCreateCustomer(email, name) {
    const existing = await webhookRepository.findCustomerByEmail(email);
    if (existing) return existing;
    const randomPassword = crypto.randomBytes(24).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    const created = await webhookRepository.createCustomer({
        name: name || deriveNameFromEmail(email),
        email,
        password: passwordHash,
        role: "customer",
    });
    return created.toObject();
}

export const webhookService = {
    async ingestEmail({ from, senderName, subject, body }) {
        const customer = await findOrCreateCustomer(from, senderName);

        const ticket = await ticketService.create(
            {
                title: subject,
                description: body,
                priority: "medium",
                category: "general",
            },
            { id: String(customer._id), role: "customer" },
        );

        await notificationService.notify(
            customer._id,
            "ticket_created",
            `We received your request "${ticket.title}" and created ticket #${String(ticket._id).slice(-6)}. Our team will respond soon.`,
            ticket._id,
        );

        return ticket;
    },
};
