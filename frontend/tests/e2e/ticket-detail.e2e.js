import { API_URL, readSavedToken, sessionFile } from "./support/sessions.js";
import { expect, test } from "./support/fixtures.js";

const LONG_TICKET = "Refund not received after 10 days";
const SHORT_TICKET = `Printer offline after update (${Date.now()})`;

test.use({ storageState: sessionFile("admin"), viewport: { width: 1440, height: 900 } });

test.beforeAll(async ({ playwright }) => {
    const adminApi = await playwright.request.newContext({
        baseURL: `${API_URL}/`,
        extraHTTPHeaders: { Authorization: `Bearer ${readSavedToken("admin")}` },
    });
    const list = await (await adminApi.get("tickets?pageSize=100")).json();
    const longTicket = list.data.tickets.find((ticket) => ticket.title === LONG_TICKET);
    for (let index = 1; index <= 12; index += 1) {
        const reply = await adminApi.post(`tickets/${longTicket._id}/replies`, {
            data: { body: `Update ${index}: we are still tracking the refund with the payment provider and will follow up shortly.` },
        });
        expect(reply.status()).toBe(201);
    }
    const created = await adminApi.post("tickets", {
        data: { title: SHORT_TICKET, description: "The office printer went offline after last night's update.", priority: "low" },
    });
    expect(created.status()).toBe(201);
    await adminApi.dispose();
});

async function openTicket(page, title) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Tickets" }).click();
    await page.locator("table tbody tr", { hasText: title }).first().click();
    await expect(page.locator(".ticket-detail-header h2")).toHaveText(title);
}

function box(page, selector) {
    return page.locator(selector).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
    });
}

test("a long conversation opens on the latest message, fully visible above the docked composer", async ({ page }) => {
    await openTicket(page, LONG_TICKET);
    const lastMessage = page.locator(".message-card").last();
    await expect(lastMessage).toContainText("Update 12:");

    const [message, composer, header] = await Promise.all([
        lastMessage.evaluate((element) => ({
            top: Math.round(element.getBoundingClientRect().top),
            bottom: Math.round(element.getBoundingClientRect().bottom),
        })),
        box(page, ".reply-form"),
        box(page, ".ticket-detail-header"),
    ]);
    expect(message.bottom).toBeLessThanOrEqual(composer.top);
    expect(message.top).toBeGreaterThanOrEqual(header.bottom);
    expect(composer.bottom).toBeLessThanOrEqual(900);
});

test("the last message stays fully visible when it grows after the page opens", async ({ page }) => {
    await openTicket(page, LONG_TICKET);
    const lastMessage = page.locator(".message-card").last();
    // Late layout, such as a web font or image finishing loading, makes the last message taller.
    await lastMessage.locator(".message-card-body").evaluate((element) => {
        element.textContent += " We have also attached the provider's confirmation letter for your records.".repeat(12);
    });
    await expect
        .poll(async () => {
            const [message, composer] = await Promise.all([lastMessage.boundingBox(), page.locator(".reply-form").boundingBox()]);
            return Math.round(message.y + message.height - composer.y);
        })
        .toBeLessThanOrEqual(0);
});

test("a new reply appears as the latest message, above the composer", async ({ page }) => {
    await openTicket(page, LONG_TICKET);
    await page.locator("#reply-body").fill("Refund confirmed by the provider today.");
    await page.getByRole("button", { name: "Send Reply" }).click();

    const lastMessage = page.locator(".message-card").last();
    await expect(lastMessage).toContainText("Refund confirmed by the provider today.");
    await expect(page.locator("#reply-body")).toHaveValue("");
    const composer = await box(page, ".reply-form");
    await expect
        .poll(async () => (await lastMessage.boundingBox()).y + (await lastMessage.boundingBox()).height)
        .toBeLessThanOrEqual(composer.top + 1);
});

test("on a short ticket the composer sits right under the messages", async ({ page }) => {
    await openTicket(page, SHORT_TICKET);
    const message = await box(page, ".message-card:last-child");
    const composer = await box(page, ".reply-form");
    expect(composer.top - message.bottom).toBeLessThanOrEqual(24);
});

test("the ticket header sits directly under the top bar", async ({ page }) => {
    await openTicket(page, SHORT_TICKET);
    const [topbar, header, conversation] = await Promise.all([
        box(page, ".topbar"),
        box(page, ".ticket-detail-header"),
        box(page, ".ticket-thread-header"),
    ]);
    expect(header.top - topbar.bottom).toBeLessThanOrEqual(1);
    expect(header.bottom - header.top).toBeLessThanOrEqual(66);
    expect(conversation.top - header.bottom).toBeLessThanOrEqual(8);
});

test("message timestamps use the regular font at 12-13px", async ({ page }) => {
    await openTicket(page, SHORT_TICKET);
    const style = await page
        .locator(".message-card-time")
        .first()
        .evaluate((element) => ({
            fontFamily: getComputedStyle(element).fontFamily,
            fontSize: parseFloat(getComputedStyle(element).fontSize),
        }));
    expect(style.fontFamily).not.toMatch(/mono/i);
    expect(style.fontSize).toBeGreaterThanOrEqual(12);
    expect(style.fontSize).toBeLessThanOrEqual(13);
});
