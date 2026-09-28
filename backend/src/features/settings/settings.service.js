import { getRedis } from "../../shared/config/redis.js";
import { settingsRepository } from "./settings.repository.js";

const CACHE_KEY = "settings:global";
const CACHE_TTL_SECONDS = 300;

export const settingsService = {
    async getSettings() {
        const redis = getRedis();
        const cached = await redis.get(CACHE_KEY);
        if (cached) return JSON.parse(cached);
        const settings = await settingsRepository.getOrCreate();
        await redis.set(CACHE_KEY, JSON.stringify(settings), "EX", CACHE_TTL_SECONDS);
        return settings;
    },

    async updateSettings(input) {
        // Set only the fields that were sent, so a partial SLA update keeps the other priorities.
        const changes = {};
        for (const [priority, hours] of Object.entries(input.slaHours || {})) changes[`slaHours.${priority}`] = hours;
        if (input.categories) changes.categories = input.categories;
        const updated = await settingsRepository.update(changes);
        await getRedis().del(CACHE_KEY);
        return updated;
    },

    async getSlaHours(priority) {
        const settings = await this.getSettings();
        return settings.slaHours?.[priority] ?? { critical: 1, high: 4, medium: 8, low: 24 }[priority];
    },
};
