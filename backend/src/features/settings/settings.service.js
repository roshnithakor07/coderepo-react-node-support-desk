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
        const updated = await settingsRepository.update(input);
        await getRedis().del(CACHE_KEY);
        return updated;
    },

    async getSlaHours(priority) {
        const settings = await this.getSettings();
        return settings.slaHours?.[priority] ?? { critical: 1, high: 4, medium: 8, low: 24 }[priority];
    },
};
