import { z } from "zod";
import { webhookService } from "./webhook.service.js";

const emailSchema = z
    .object({
        from: z.string().trim().email().max(160),
        senderName: z.string().trim().max(80).optional(),
        subject: z.string().trim().min(1).max(140),
        body: z.string().trim().min(1).max(5000),
    })
    .strict();

export async function receiveEmail(request, response, next) {
    try {
        const input = emailSchema.parse(request.body);
        const ticket = await webhookService.ingestEmail(input);
        response.status(201).json({ data: { ticketId: ticket._id, status: "accepted" } });
    } catch (error) {
        next(error);
    }
}
