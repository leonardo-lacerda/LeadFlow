import { expect, test } from "@playwright/test";

test.describe("Landing", () => {
    test("serves landing-v6 at root with login CTA", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Outbound completo com memoria." })).toBeVisible();

        const loginLink = page.getByRole("link", { name: "Login" });
        await expect(loginLink).toBeVisible();
        await expect(loginLink).toHaveAttribute("href", "/login");
    });
});
