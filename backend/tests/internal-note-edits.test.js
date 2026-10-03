import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { NOTE_EDIT_WINDOW_MINUTES } from "../src/features/tickets/ticket-notes.js";
import { api, loginAs } from "./helpers/api.js";

// An internal note is a working note: its author, or an admin, can correct or remove it for fifteen
// minutes. After that it is part of the ticket's record and nobody rewrites it.

let admin;
let agent;
let customer;

const created = [];

function reply(ticketId, token, body, isInternal = false) {
    return api(`/tickets/${ticketId}/replies`, { method: "POST", token, body: { body, isInternal } });
}

function editReply(ticketId, replyId, token, body) {
    return api(`/tickets/${ticketId}/replies/${replyId}`, { method: "PUT", token, body: { body } });
}

function deleteReply(ticketId, replyId, token) {
    return api(`/tickets/${ticketId}/replies/${replyId}`, { method: "DELETE", token });
}

// Moves a note's timestamp back, which is the only honest way to test a window that is measured in
// minutes without waiting for them.
async function agePost(ticketId, replyId, minutes) {
    await Ticket.updateOne(
        { _id: ticketId, "replies._id": replyId },
        { $set: { "replies.$.createdAt": new Date(Date.now() - minutes * 60 * 1000) } },
    );
}

async function ticketWithNote(title, noteBody = "Routing this to the billing team.", token) {
    const { status, body } = await api("/tickets", {
        method: "POST",
        token: customer.token,
        body: { title, description: "Opened by the internal notes test suite.", priority: "low" },
    });
    expect(status).toBe(201);
    created.push(body.data._id);

    const posted = await reply(body.data._id, token || admin.token, noteBody, true);
    expect(posted.status).toBe(201);
    const note = posted.body.data.replies.find((entry) => entry.isInternal);
    expect(note).toBeTruthy();
    return { ticketId: body.data._id, note };
}

beforeAll(async () => {
    [admin, agent, customer] = await Promise.all([loginAs("admin"), loginAs("agent"), loginAs("customer")]);
});

afterAll(async () => {
    await Ticket.deleteMany({ _id: { $in: created } });
});

describe("the author can correct a fresh note", () => {
    test("editing it changes the text, marks it edited and leaves the posting time alone", async () => {
        const { ticketId, note } = await ticketWithNote("Note editing: fresh");
        expect(note.canEdit).toBe(true);
        expect(note.editedAt ?? null).toBeNull();

        const { status, body } = await editReply(ticketId, note._id, admin.token, "Routing this to the account team instead.");
        expect(status).toBe(200);

        const updated = body.data.replies.find((entry) => entry._id === note._id);
        expect(updated.body).toBe("Routing this to the account team instead.");
        expect(updated.editedAt).toBeTruthy();
        expect(new Date(updated.createdAt).getTime()).toBe(new Date(note.createdAt).getTime());

        const stored = await Ticket.findById(ticketId).lean();
        expect(stored.replies[0].body).toBe("Routing this to the account team instead.");
    });

    test("deleting it takes it off the ticket", async () => {
        const { ticketId, note } = await ticketWithNote("Note editing: delete");
        const { status, body } = await deleteReply(ticketId, note._id, admin.token);
        expect(status).toBe(200);
        expect(body.data.replies.some((entry) => entry._id === note._id)).toBe(false);
        expect((await Ticket.findById(ticketId).lean()).replies).toHaveLength(0);
    });

    test("a note cannot be emptied: an empty note is a deleted note", async () => {
        const { ticketId, note } = await ticketWithNote("Note editing: empty");
        const { status, body } = await editReply(ticketId, note._id, admin.token, "   ");
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });
});

describe("the window closes after fifteen minutes", () => {
    test(`a note posted ${NOTE_EDIT_WINDOW_MINUTES + 1} minutes ago can no longer be edited or deleted`, async () => {
        const { ticketId, note } = await ticketWithNote("Note editing: expired");
        await agePost(ticketId, note._id, NOTE_EDIT_WINDOW_MINUTES + 1);

        const edited = await editReply(ticketId, note._id, admin.token, "Too late to change this.");
        expect(edited.status).toBe(422);
        expect(edited.body.error.code).toBe("EDIT_WINDOW_EXPIRED");
        expect(edited.body.error.message).toContain(`${NOTE_EDIT_WINDOW_MINUTES} minutes`);

        const removed = await deleteReply(ticketId, note._id, admin.token);
        expect(removed.status).toBe(422);
        expect(removed.body.error.code).toBe("EDIT_WINDOW_EXPIRED");

        const stored = await Ticket.findById(ticketId).lean();
        expect(stored.replies).toHaveLength(1);
        expect(stored.replies[0].body).toBe("Routing this to the billing team.");
    });

    test("a note just inside the window is still the author's to change", async () => {
        const { ticketId, note } = await ticketWithNote("Note editing: inside the window");
        await agePost(ticketId, note._id, NOTE_EDIT_WINDOW_MINUTES - 1);
        expect((await editReply(ticketId, note._id, admin.token, "Still in time.")).status).toBe(200);
    });

    test("the page shows the reason in place of the controls once the window has closed", async () => {
        const { ticketId, note } = await ticketWithNote("Note editing: reason on the page");
        await agePost(ticketId, note._id, NOTE_EDIT_WINDOW_MINUTES + 5);

        const { body } = await api(`/tickets/${ticketId}`, { token: admin.token });
        const shown = body.data.replies.find((entry) => entry._id === note._id);
        expect(shown.canEdit).toBe(false);
        expect(shown.editBlockedReason).toContain(`${NOTE_EDIT_WINDOW_MINUTES} minutes`);
    });
});

describe("a note belongs to the person who wrote it", () => {
    test("another agent on the same ticket cannot touch it, and sees no trace of the controls", async () => {
        // The ticket is the agent's own, so nothing but authorship stands between them and the note.
        const assigned = await Ticket.findOne({ assignedTo: agent.user.id, status: { $in: ["open", "in_progress", "pending"] } }).lean();
        expect(assigned).not.toBeNull();

        const posted = await reply(assigned._id, admin.token, "An admin's note on somebody else's ticket.", true);
        expect(posted.status).toBe(201);
        const note = posted.body.data.replies.at(-1);

        const edited = await editReply(assigned._id, note._id, agent.token, "Not mine to change.");
        expect(edited.status).toBe(403);
        expect(edited.body.error.code).toBe("FORBIDDEN");
        expect(edited.body.error.message).toContain("wrote this note");
        expect((await deleteReply(assigned._id, note._id, agent.token)).status).toBe(403);

        // And the page gives them no controls for it either.
        const page = await api(`/tickets/${assigned._id}`, { token: agent.token });
        const shown = page.body.data.replies.find((entry) => entry._id === note._id);
        expect(shown.canEdit).toBe(false);
        expect(shown.editBlockedReason).toBeNull();

        expect((await deleteReply(assigned._id, note._id, admin.token)).status).toBe(200);
    });

    test("an admin can remove any note, because somebody has to be able to", async () => {
        const assigned = await Ticket.findOne({ assignedTo: agent.user.id, status: { $in: ["open", "in_progress", "pending"] } }).lean();
        expect(assigned).not.toBeNull();

        const posted = await reply(assigned._id, agent.token, "A note an admin will remove.", true);
        expect(posted.status).toBe(201);
        const note = posted.body.data.replies.at(-1);

        const { status } = await deleteReply(assigned._id, note._id, admin.token);
        expect(status).toBe(200);
        expect((await Ticket.findById(assigned._id).lean()).replies.some((entry) => String(entry._id) === note._id)).toBe(false);
    });
});

describe("only internal notes can be changed after the fact", () => {
    test("a public reply the customer has read stays as it was sent", async () => {
        const { status, body } = await api("/tickets", {
            method: "POST",
            token: customer.token,
            body: { title: "Note editing: public reply", description: "Opened by the internal notes test suite.", priority: "low" },
        });
        expect(status).toBe(201);
        created.push(body.data._id);

        const posted = await reply(body.data._id, admin.token, "Here is the answer you were waiting for.");
        const publicReply = posted.body.data.replies.at(-1);
        expect(publicReply.isInternal).toBe(false);

        const edited = await editReply(body.data._id, publicReply._id, admin.token, "Actually, something else.");
        expect(edited.status).toBe(403);
        expect(edited.body.error.message).toContain("Only internal notes");
        expect((await deleteReply(body.data._id, publicReply._id, admin.token)).status).toBe(403);
    });

    test("a customer cannot reach these routes at all", async () => {
        const { ticketId, note } = await ticketWithNote("Note editing: not for customers");
        expect((await editReply(ticketId, note._id, customer.token, "Let me see that note.")).status).toBe(403);
        expect((await deleteReply(ticketId, note._id, customer.token)).status).toBe(403);
    });

    test("a reply id that is not on the ticket is a 404, never a 500", async () => {
        const { ticketId } = await ticketWithNote("Note editing: unknown reply");
        const missing = await editReply(ticketId, "0123456789abcdef01234567", admin.token, "Nothing to change.");
        expect(missing.status).toBe(404);
        expect(missing.body.error.code).toBe("REPLY_NOT_FOUND");

        const malformed = await editReply(ticketId, "not-an-id", admin.token, "Nothing to change.");
        expect(malformed.status).toBe(400);
    });
});
