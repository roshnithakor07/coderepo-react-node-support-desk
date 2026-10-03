import { AppError } from "../../shared/errors/app-error.js";
import { authRepository } from "../auth/auth.repository.js";
import { ACTIVE_STATUSES } from "../tickets/ticket-lifecycle.js";
import { categoryLabel, normalizeCategories } from "../tickets/ticket-teams.js";
import { ticketRepository } from "../tickets/ticket.repository.js";
import { settingsRepository } from "./settings.repository.js";

// What each category is being used for right now: the agents whose team it is, and the tickets still
// being worked under it. The Settings page reads the same numbers it would be refused with.
async function usageFor(categories) {
    if (categories.length === 0) return {};
    const [agents, openTickets] = await Promise.all([
        authRepository.countAgentsByCategories(categories),
        ticketRepository.countOpenByCategories(categories, ACTIVE_STATUSES),
    ]);
    return Object.fromEntries(
        categories.map((category) => [category, { agents: agents[category] || 0, openTickets: openTickets[category] || 0 }]),
    );
}

function countPhrase(count, singular) {
    return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

// "Billing is still used by 2 agents and 3 open tickets." The counts are in the message because they
// are what the admin has to go and deal with.
function inUseMessage(category, usage) {
    const parts = [];
    if (usage.agents > 0) parts.push(countPhrase(usage.agents, "agent"));
    if (usage.openTickets > 0) parts.push(countPhrase(usage.openTickets, "open ticket"));
    return `${categoryLabel(category)} is still used by ${parts.join(" and ")}.`;
}

export const settingsService = {
    getSettings() {
        return settingsRepository.getOrCreate();
    },

    // The Settings page also needs to know which categories cannot be removed, so the remove button
    // is disabled with the reason instead of failing on save.
    async getSettingsWithUsage() {
        const settings = await settingsRepository.getOrCreate();
        return { ...settings, categoryUsage: await usageFor(normalizeCategories(settings.categories)) };
    },

    async updateSettings(input) {
        // Set only the fields that were sent, so a partial SLA update keeps the other priorities.
        const changes = {};
        for (const [priority, hours] of Object.entries(input.slaHours || {})) changes[`slaHours.${priority}`] = hours;

        if (input.categories) {
            const current = await settingsRepository.getOrCreate();
            const removed = normalizeCategories(current.categories).filter((category) => !input.categories.includes(category));
            const usage = await usageFor(removed);
            const inUse = removed.filter((category) => usage[category].agents > 0 || usage[category].openTickets > 0);
            if (inUse.length > 0) {
                // Removing a category agents are on, or open work is filed under, would leave both
                // pointing at something that no longer exists.
                throw new AppError(
                    409,
                    "CATEGORY_IN_USE",
                    `${inUse.map((category) => inUseMessage(category, usage[category])).join(" ")} Move them to another category before removing it.`,
                );
            }
            changes.categories = input.categories;
        }

        await settingsRepository.update(changes);
        return this.getSettingsWithUsage();
    },

    async getSlaHours(priority) {
        const settings = await this.getSettings();
        return settings.slaHours?.[priority] ?? { critical: 1, high: 4, medium: 8, low: 24 }[priority];
    },
};
