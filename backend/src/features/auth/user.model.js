import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 160 },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: ["admin", "agent", "customer"], default: "customer", index: true },
        avatar: { type: String, default: "" },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, versionKey: false },
);

userSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.model("User", userSchema);
