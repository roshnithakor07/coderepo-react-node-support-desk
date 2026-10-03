import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        type: {
            type: String,
            enum: ["ticket_assigned", "ticket_unassigned", "ticket_reply", "sla_warning", "sla_breached", "status_changed"],
            required: true,
        },
        message: { type: String, required: true, trim: true, maxlength: 280 },
        ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true },
        isRead: { type: Boolean, default: false, index: true },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
