import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
    {
        body: { type: String, required: true, trim: true, maxlength: 5000 },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        isInternal: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        // Set the first time an internal note is edited, so the conversation says so instead of
        // quietly changing under the people who already read it.
        editedAt: { type: Date, default: null },
    },
    { _id: true },
);

const ticketSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 140 },
        description: { type: String, required: true, trim: true, maxlength: 5000 },
        status: {
            type: String,
            enum: ["open", "in_progress", "pending", "resolved", "closed"],
            default: "open",
            index: true,
        },
        priority: { type: String, enum: ["low", "medium", "high", "critical"], required: true, index: true },
        category: { type: String, trim: true, default: "general" },
        tags: { type: [String], default: [] },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
        // The SLA clock starts here. Reopening a resolved or closed ticket moves it to the reopen
        // time, so the deadline is never measured from a window that already elapsed.
        slaStartedAt: { type: Date, default: Date.now },
        slaDeadline: { type: Date, required: true },
        slaBreached: { type: Boolean, default: false, index: true },
        slaWarningNotifiedAt: { type: Date, default: null },
        resolvedAt: { type: Date, default: null },
        // When the ticket was closed, which starts the 14-day reopen window. Cleared on a reopen.
        closedAt: { type: Date, default: null },
        // Set once admins have been told the ticket has nobody on it, so the alert is not repeated
        // every minute by the sweep. Cleared when someone is assigned.
        unassignedNotifiedAt: { type: Date, default: null },
        replies: { type: [replySchema], default: [] },
    },
    { timestamps: true, versionKey: false },
);

ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ createdAt: -1 });

export const Ticket = mongoose.model("Ticket", ticketSchema);
