import bcrypt from "bcryptjs";
import { AppError } from "../../shared/errors/app-error.js";
import { authRepository } from "../auth/auth.repository.js";
import { settingsService } from "../settings/settings.service.js";
import { categoryLabel, normalizeCategories } from "../tickets/ticket-teams.js";
import { agentRepository } from "./agent.repository.js";

function toPublicAgent(agent) {
    return {
        id: String(agent._id),
        name: agent.name,
        email: agent.email,
        role: agent.role,
        avatar: agent.avatar,
        categories: agent.categories || [],
        isActive: agent.isActive,
        createdAt: agent.createdAt,
    };
}

// An agent's team is made of the categories tickets are actually filed under, so a typo cannot
// create a team nothing will ever reach.
async function assertKnownCategories(categories) {
    const settings = await settingsService.getSettings();
    const known = normalizeCategories(settings.categories);
    const unknown = categories.filter((category) => !known.includes(category));
    if (unknown.length > 0) {
        throw new AppError(
            422,
            "UNKNOWN_CATEGORY",
            `${unknown.map(categoryLabel).join(", ")} ${unknown.length === 1 ? "is not a category" : "are not categories"} in Settings. Add it there first, or choose from: ${known.map(categoryLabel).join(", ")}.`,
        );
    }
    return categories;
}

export const agentService = {
    listWithWorkload() {
        return authRepository.findAgentsWithWorkload({ activeOnly: false });
    },

    async create(input) {
        const existing = await agentRepository.findByEmail(input.email);
        if (existing) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.");
        const categories = await assertKnownCategories(normalizeCategories(input.categories));
        const passwordHash = await bcrypt.hash(input.password, 10);
        const agent = await agentRepository.create({
            name: input.name,
            email: input.email,
            password: passwordHash,
            role: "agent",
            avatar: input.avatar || "",
            categories,
        });
        return toPublicAgent(agent);
    },

    // The team an agent works. Changing it never touches what they already hold: a ticket assigned
    // before the change stays with them, and the new categories decide what they can take next.
    async setCategories(id, input) {
        const categories = await assertKnownCategories(normalizeCategories(input));
        const agent = await agentRepository.setCategories(id, categories);
        if (!agent) throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found.");
        return agent;
    },

    async setActive(id, isActive) {
        const agent = await agentRepository.setActive(id, isActive);
        if (!agent) throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found.");
        return agent;
    },
};
