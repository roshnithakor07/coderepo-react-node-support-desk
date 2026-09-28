import { Settings } from "./settings.model.js";

export const settingsRepository = {
    async getOrCreate() {
        const existing = await Settings.findOne({ key: "global" }).lean();
        if (existing) return existing;
        const created = await Settings.create({ key: "global" });
        return created.toObject();
    },

    update: (changes) =>
        Settings.findOneAndUpdate(
            { key: "global" },
            { $set: changes },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        ).lean(),
};
