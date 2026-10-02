// Goes to a main area the way a user would: on phones the navigation sits in a menu drawer.
export async function navigateTo(page, name) {
    await page.locator(".topbar").waitFor();
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name }).click();
}
