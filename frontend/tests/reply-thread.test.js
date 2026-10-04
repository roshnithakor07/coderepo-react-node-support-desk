import { describe, expect, test } from "bun:test";
import { earlierReplyCount, followUpTitle, mergeReplyWindow } from "../src/features/tickets/reply-thread.js";

// The ticket page holds the pages of a long conversation it has already shown, and folds in the latest
// page each time the server sends it again. These are the rules that keep that thread whole.

function reply(id, second, extra = {}) {
    return { _id: id, body: `reply ${id}`, createdAt: `2026-09-01T09:00:${String(second).padStart(2, "0")}.000Z`, ...extra };
}

describe("folding in the latest page of a conversation", () => {
    test("the first page is the thread", () => {
        const page = [reply("a", 1), reply("b", 2)];
        expect(mergeReplyWindow([], page)).toEqual(page);
    });

    test("a reply that pushes the page along is added without losing the one that fell off", () => {
        const held = [reply("a", 1), reply("b", 2)];
        // The page now holds the second and third replies: the first has fallen off its start.
        const moved = mergeReplyWindow(held, [reply("b", 2), reply("c", 3)]);
        expect(moved.map((entry) => entry._id)).toEqual(["a", "b", "c"]);
    });

    test("an older page loaded earlier stays below the page in hand", () => {
        const held = [reply("a", 1), reply("b", 2), reply("c", 3)];
        expect(mergeReplyWindow(held, [reply("c", 3)]).map((entry) => entry._id)).toEqual(["a", "b", "c"]);
    });

    test("a reply the page no longer lists was deleted, so it goes", () => {
        const held = [reply("a", 1), reply("b", 2), reply("c", 3)];
        expect(mergeReplyWindow(held, [reply("b", 2)]).map((entry) => entry._id)).toEqual(["a", "b"]);
    });

    test("the page's own copy of a reply wins, so an edited note shows its new text", () => {
        const held = [reply("a", 1, { body: "before" })];
        expect(mergeReplyWindow(held, [reply("a", 1, { body: "after" })])[0].body).toBe("after");
    });

    test("an empty page leaves the thread alone, because a customer's page may hold only notes", () => {
        const held = [reply("a", 1)];
        expect(mergeReplyWindow(held, [])).toEqual(held);
    });
});

describe("how many replies are still behind the ones on screen", () => {
    test("counts down as pages are loaded", () => {
        expect(earlierReplyCount(120, 50)).toBe(70);
        expect(earlierReplyCount(120, 120)).toBe(0);
    });

    test("never goes below zero, or guesses when the count is missing", () => {
        expect(earlierReplyCount(10, 12)).toBe(0);
        expect(earlierReplyCount(undefined, 5)).toBe(0);
    });
});

describe("the follow-up ticket's title", () => {
    test("names the ticket it continues", () => {
        expect(followUpTitle("Card declined at checkout")).toBe("Follow-up: Card declined at checkout");
    });

    test("stays inside the 140 characters a title allows", () => {
        expect(followUpTitle("x".repeat(200))).toHaveLength(140);
    });
});
