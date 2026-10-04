import bcrypt from "bcryptjs";
import { AppError } from "../../shared/errors/app-error.js";
import { authRepository } from "../auth/auth.repository.js";
import { settingsService } from "../settings/settings.service.js";
import { categoryLabel, normalizeCategories } from "../tickets/ticket-teams.js";
import { ticketService } from "../tickets/ticket.service.js";
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

async function findAgent(id) {
    const agent = await authRepository.findById(id);
    if (!agent || agent.role !== "agent") throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found.");
    return agent;
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

    // What deactivating this agent would do, for the confirmation to say before anything happens. An
    // agent who is already inactive has nothing to move.
    async previewDeactivation(id) {
        const agent = await findAgent(id);
        if (!agent.isActive) return { openTickets: 0, reassignTo: [], toQueue: 0, blocked: [], blockedReason: null };
        const { moves, queued, ...preview } = await ticketService.previewReassignment(agent);
        return preview;
    },

    // Deactivating an agent hands their open tickets on in the same action: to the least-loaded active
    // agent who covers each one's category, or to the unassigned queue when nobody does. It is refused
    // when they are the last active cover for a category that still has open work, because that work
    // would be left with nobody who may take it. Reactivating moves nothing.
    async setActive(id, isActive, actor) {
        const agent = await findAgent(id);
        let reassigned = { moved: 0, queued: 0 };

        if (!isActive && agent.isActive) {
            const plan = await ticketService.previewReassignment(agent);
            if (plan.blocked.length > 0) {
                throw new AppError(409, "AGENT_LAST_COVER", plan.blockedReason, { blocked: plan.blocked });
            }
            await ticketService.reassignOpenTickets(agent, plan, actor);
            reassigned = { moved: plan.moves.length, queued: plan.queued.length };
        }

        const updated = await agentRepository.setActive(id, isActive);
        return { ...updated, reassigned };
    },
};
