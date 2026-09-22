import { z } from "zod";
import { agentService } from "./agent.service.js";

const createSchema = z
    .object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(160),
        password: z.string().min(8).max(100),
        avatar: z.string().max(300).optional(),
    })
    .strict();

const setActiveSchema = z.object({ isActive: z.boolean() }).strict();

export async function listAgents(request, response, next) {
    try {
        const agents = await agentService.listWithWorkload();
        response.json({ data: agents });
    } catch (error) {
        next(error);
    }
}

export async function createAgent(request, response, next) {
    try {
        const input = createSchema.parse(request.body);
        const agent = await agentService.create(input);
        response.status(201).json({ data: agent });
    } catch (error) {
        next(error);
    }
}

export async function updateAgentStatus(request, response, next) {
    try {
        const { isActive } = setActiveSchema.parse(request.body);
        const agent = await agentService.setActive(request.params.agentId, isActive);
        response.json({ data: agent });
    } catch (error) {
        next(error);
    }
}
