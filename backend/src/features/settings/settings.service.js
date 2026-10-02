import { settingsRepository } from "./settings.repository.js";

export const settingsService = {
    getSettings() {
        return settingsRepository.getOrCreate();
    },

    updateSettings(input) {
        // Set only the fields that were sent, so a partial SLA update keeps the other priorities.
        const changes = {};
        for (const [priority, hours] of Object.entries(input.slaHours || {})) changes[`slaHours.${priority}`] = hours;
        if (input.categories) changes.categories = input.categories;
        return settingsRepository.update(changes);
    },

    async getSlaHours(priority) {
        const settings = await this.getSettings();
        return settings.slaHours?.[priority] ?? { critical: 1, high: 4, medium: 8, low: 24 }[priority];
    },
};
