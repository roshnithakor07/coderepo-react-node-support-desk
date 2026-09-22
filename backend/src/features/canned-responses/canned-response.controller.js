import { z } from "zod";
import { cannedResponseService } from "./canned-response.service.js";

const createSchema = z
    .object({
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(3000),
        category: z.string().trim().max(60).optional(),
        isGlobal: z.boolean().optional(),
    })
    .strict();

export async function listCannedResponses(request, response, next) {
    try {
        const items = await cannedResponseService.list(request.user);
        response.json({ data: items });
    } catch (error) {
        next(error);
    }
}

export async function createCannedResponse(request, response, next) {
    try {
        const input = createSchema.parse(request.body);
        const item = await cannedResponseService.create(input, request.user);
        response.status(201).json({ data: item });
    } catch (error) {
        next(error);
    }
}

export async function deleteCannedResponse(request, response, next) {
    try {
        await cannedResponseService.remove(request.params.responseId, request.user);
        response.json({ data: { success: true } });
    } catch (error) {
        next(error);
    }
}
