import { expect, test } from "@playwright/test";

test.describe("Example Feature", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/example");
  });

  test("renders the example page", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Backend Health Check" })
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("00000000-0000-0000-0000-000000000000")
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.getByText("Idle", { exact: true })).toBeVisible();
  });

  test("stays idle when no ID is provided", async ({ page }) => {
    await expect(page.getByText("Idle", { exact: true })).toBeVisible();
    await expect(page.locator("article")).toBeVisible();
  });

  test("clears a whitespace-only lookup", async ({ page }) => {
    await page
      .getByPlaceholder("00000000-0000-0000-0000-000000000000")
      .fill("   ");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/example$/);
    await expect(page.getByText("Idle", { exact: true })).toBeVisible();
  });

  test("redirects an unauthenticated API lookup to login", async ({ page }) => {
    await page
      .getByPlaceholder("00000000-0000-0000-0000-000000000000")
      .fill("00000000-0000-0000-0000-000000000001");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(
      /\/login\?redirectedFrom=%2Fexample$/,
      { timeout: 10000 }
    );
  });

  test("keeps the result region available", async ({ page }) => {
    await expect(page.locator("article")).toBeVisible();
    await expect(page.locator("article h2")).toBeVisible();
  });
});
