import mongoose from "mongoose";

const cannedResponseSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 120 },
        body: { type: String, required: true, trim: true, maxlength: 3000 },
        category: { type: String, trim: true, default: "general", index: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        isGlobal: { type: Boolean, default: false, index: true },
    },
    { timestamps: true, versionKey: false },
);

cannedResponseSchema.index({ title: "text", body: "text" });

export const CannedResponse = mongoose.model("CannedResponse", cannedResponseSchema);
