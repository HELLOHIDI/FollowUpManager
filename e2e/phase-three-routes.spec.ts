import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/projects",
  "/projects/project-1",
  "/projects/project-1/expenses/expense-1",
  "/projects/project-1/export",
  "/settings/company",
] as const;

test.describe("phase three protected route boundary", () => {
  for (const route of protectedRoutes) {
    test(`protects ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });

      const expectedDestination = encodeURIComponent(route);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?redirectedFrom=${expectedDestination}$`)
      );
    });
  }

  test("does not keep the removed starter dashboard", async ({ page }) => {
    const response = await page.goto("/dashboard", {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
