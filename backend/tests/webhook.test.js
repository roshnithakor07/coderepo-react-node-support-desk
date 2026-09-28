import { describe, expect, test } from "bun:test";
import { Ticket } from "../src/features/tickets/ticket.model.js";
import { api } from "./helpers/api.js";

function sendEmail(headers = {}, subject = "Order arrived damaged") {
    return fetch(`${process.env.TEST_API_URL}/webhooks/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
            from: "jordan.lee@example.com",
            senderName: "Jordan Lee",
            subject,
            body: "The box was crushed on arrival.",
        }),
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
}

describe("inbound email webhook", () => {
    test("rejects a request without the shared secret", async () => {
        const { status, body } = await sendEmail();
        expect(status).toBe(401);
        expect(body.error.code).toBe("INVALID_WEBHOOK_SECRET");
    });

    test("rejects a wrong secret, including one of a different length", async () => {
        for (const secret of ["wrong-secret", `${process.env.WEBHOOK_SECRET}x`, "a"]) {
            const { status, body } = await sendEmail({ "X-Webhook-Secret": secret });
            expect(status).toBe(401);
            expect(body.error.code).toBe("INVALID_WEBHOOK_SECRET");
        }
    });

    test("creates a ticket when the secret matches", async () => {
        const subject = `Webhook secret check ${Date.now()}`;
        const { status, body } = await sendEmail({ "X-Webhook-Secret": process.env.WEBHOOK_SECRET }, subject);
        expect(status).toBe(201);
        expect(body.data.status).toBe("accepted");
        expect(await Ticket.countDocuments({ _id: body.data.ticketId, title: subject })).toBe(1);
    });

    test("refuses all requests when no secret is configured", async () => {
        const configured = process.env.WEBHOOK_SECRET;
        delete process.env.WEBHOOK_SECRET;
        try {
            const { status, body } = await sendEmail({ "X-Webhook-Secret": configured });
            expect(status).toBe(503);
            expect(body.error.code).toBe("WEBHOOK_DISABLED");
        } finally {
            process.env.WEBHOOK_SECRET = configured;
        }
    });

    test("a rejected request creates no ticket", async () => {
        const subject = `Rejected webhook ${Date.now()}`;
        await sendEmail({ "X-Webhook-Secret": "wrong-secret" }, subject);
        expect(await Ticket.countDocuments({ title: subject })).toBe(0);
        expect((await api("/health")).status).toBe(200);
    });
});
