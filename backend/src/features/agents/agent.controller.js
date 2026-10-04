import { z } from "zod";
import { agentService } from "./agent.service.js";

// An agent belongs to at least one category: a team of none could never be assigned anything, so it
// is refused at the edge rather than created and then puzzled over.
const categoryList = z
    .array(z.string().trim().min(1).max(30))
    .min(1, "Choose at least one category for this agent.")
    .max(20, "Choose at most 20 categories.");

const createSchema = z
    .object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(160),
        password: z.string().min(8).max(100),
        categories: categoryList,
        avatar: z.string().max(300).optional(),
    })
    .strict();

// `sendBlockedToQueue` is the admin's explicit choice to deactivate the last agent covering a
// category anyway, sending that category's work to the unassigned queue instead of being refused.
const setActiveSchema = z.object({ isActive: z.boolean(), sendBlockedToQueue: z.boolean().optional() }).strict();

const setCategoriesSchema = z.object({ categories: categoryList }).strict();

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

export async function updateAgentCategories(request, response, next) {
    try {
        const { categories } = setCategoriesSchema.parse(request.body);
        const agent = await agentService.setCategories(request.params.agentId, categories);
        response.json({ data: agent });
    } catch (error) {
        next(error);
    }
}

export async function previewDeactivation(request, response, next) {
    try {
        const preview = await agentService.previewDeactivation(request.params.agentId);
        response.json({ data: preview });
    } catch (error) {
        next(error);
    }
}

export async function updateAgentStatus(request, response, next) {
    try {
        const { isActive, sendBlockedToQueue } = setActiveSchema.parse(request.body);
        const agent = await agentService.setActive(request.params.agentId, isActive, request.user, { sendBlockedToQueue });
        response.json({ data: agent });
    } catch (error) {
        next(error);
    }
}
