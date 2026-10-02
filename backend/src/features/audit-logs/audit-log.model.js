import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
        action: { type: String, required: true, trim: true },
        // null means the system did it (for example the SLA sweep), not a person.
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditLogSchema.index({ ticketId: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
