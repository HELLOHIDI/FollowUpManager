import { expect, test } from "@playwright/test";

test.describe("single admin auth entry", () => {
  test("redirects an unauthenticated root request to login", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login$/);
  });

  test("preserves a protected destination through the login redirect", async ({
    page,
  }) => {
    await page.goto("/projects/project-1?tab=budget", {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL(
      /\/login\?redirectedFrom=%2Fprojects%2Fproject-1%3Ftab%3Dbudget$/
    );
  });

  test("returns not found for the removed signup route", async ({ page }) => {
    const response = await page.goto("/signup", {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(/\/signup$/);
  });
});
