import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
        action: { type: String, required: true, trim: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditLogSchema.index({ ticketId: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
