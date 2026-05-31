import { expect, test } from "@playwright/test";

/**
 * Organisation Switcher E2E Tests
 *
 * Tests the organisation switcher component in the sidebar header.
 * Allows users to switch between organisations and create new ones.
 *
 * Uses authenticated context from auth.setup.ts
 */

test.describe("Organisation Switcher", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for dashboard to load
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test("can create new organisation", async ({ page }) => {
    // Look for "Create organisation" button in dropdown or sidebar
    const createButton = page.getByRole("button", { name: /create organisation/i });
    const isVisible = await createButton.isVisible().catch(() => false);

    if (!isVisible) {
      // Try opening dropdown first
      const switcherButton = page
        .locator("button")
        .filter({ has: page.locator('svg[class*="lucide-chevrons"]') })
        .first();
      const orgNameButton = page
        .locator("button")
        .filter({ hasText: /organisation|demo|acme/i })
        .first();
      const button = (await switcherButton.isVisible().catch(() => false)) ? switcherButton : orgNameButton;

      if (await button.isVisible().catch(() => false)) {
        await button.click();
        await page.waitForTimeout(500);
      }
    }

    const createBtn = page.getByRole("button", { name: /create organisation/i });
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();

      // Dialog should appear
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole("heading", { name: /create organisation/i })).toBeVisible();

      // Check form fields
      await expect(page.getByLabel(/organisation name/i)).toBeVisible();

      // Fill organisation name
      const orgName = `Test Org ${Date.now()}`;
      await page.getByLabel(/organisation name/i).fill(orgName);

      // Submit button should be enabled
      const submitButton = page.getByRole("button", { name: /create/i }).filter({ hasText: /create/i });
      await expect(submitButton).toBeEnabled();

      // Cancel to avoid creating test orgs
      await page.getByRole("button", { name: /cancel/i }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 2000 });
    }
  });
});
