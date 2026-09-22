import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, default: "global" },
        slaHours: {
            critical: { type: Number, default: 1 },
            high: { type: Number, default: 4 },
            medium: { type: Number, default: 8 },
            low: { type: Number, default: 24 },
        },
        categories: { type: [String], default: ["general", "billing", "technical", "account"] },
    },
    { timestamps: true, versionKey: false },
);

export const Settings = mongoose.model("Settings", settingsSchema);
