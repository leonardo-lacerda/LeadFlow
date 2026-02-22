import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test.describe("Auth", () => {
    test("registers and redirects to dashboard", async ({ page }) => {
        await mockApi(page);

        await page.goto("/register");

        await page.getByLabel("Seu nome").fill("Joao Silva");
        await page.getByLabel("Nome da empresa").fill("Minha Empresa LTDA");
        await page.getByLabel("Email corporativo").fill("joao@example.com");
        await page.getByLabel("Senha").fill("Smoke12345!");

        await page.getByRole("button", { name: "Criar conta" }).click();

        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
    });
});
