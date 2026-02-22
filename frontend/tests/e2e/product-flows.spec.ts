import { expect, test } from "@playwright/test";
import { mockApi, seedAuthenticatedSession } from "./helpers";

test.describe("Core product flows", () => {
    test.beforeEach(async ({ page }) => {
        await seedAuthenticatedSession(page);
        await mockApi(page);
    });

    test("loads leads workspace", async ({ page }) => {
        await page.goto("/leads");
        await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
        await expect(page.getByText("Lead E2E")).toBeVisible();
    });

    test("loads campaigns workspace", async ({ page }) => {
        await page.goto("/campaigns");
        await expect(page.getByRole("heading", { name: "Sequencias" })).toBeVisible();
        await expect(page.getByText("Outbound Q1")).toBeVisible();
    });

    test("loads inbox workspace", async ({ page }) => {
        await page.goto("/inbox");
        await expect(page.getByRole("heading", { name: "Caixa de entrada" })).toBeVisible();
        await expect(page.getByText("Lead E2E")).toBeVisible();
    });

    test("queues publish job from growth", async ({ page }) => {
        await page.goto("/growth");
        await expect(page.getByRole("heading", { name: "Growth Loop" })).toBeVisible();
        await page.getByRole("button", { name: "Enfileirar no Twitter" }).first().click();
        await expect(page.getByText("Fila de Publicacao")).toBeVisible();
        await expect(page.getByText("Historico de Jobs")).toBeVisible();
    });

    test("loads observability workspace", async ({ page }) => {
        await page.goto("/settings/observability");
        await expect(page.getByRole("heading", { name: "Observabilidade" })).toBeVisible();
        await expect(page.getByText("social_publish").first()).toBeVisible();
        await expect(page.getByText("LinkedIn token refresh failed")).toBeVisible();
    });
});
