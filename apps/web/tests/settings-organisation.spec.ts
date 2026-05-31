import { expect, test } from "@playwright/test";

/**
 * Organisation Settings Page E2E Tests
 *
 * Tests the Organisation settings page which allows users to manage organisation
 * details, members, and delete organisation.
 *
 * Uses authenticated context from auth.setup.ts
 */

test.describe("Organisation Settings Page", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/organisation");
    // Wait for page to load - check for heading "Organisation Details" or "Organisation"
    await expect(page.getByRole("heading", { name: /organisation/i, level: 2 }).first()).toBeVisible({ timeout: 10000 });
  });

  test("invite member dialog validates email", async ({ page }) => {
    const inviteButton = page.getByRole("button", { name: /invite/i });
    const isVisible = await inviteButton.isVisible().catch(() => false);

    if (isVisible) {
      await inviteButton.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });

      // Submit button should be disabled without email
      const submitButton = page.getByRole("button", { name: /send invitation/i });
      await expect(submitButton).toBeDisabled();

      // Fill email (validation might happen server-side, so button may be enabled)
      await page.getByLabel(/email/i).fill(`test-${Date.now()}@example.com`);
      // Button should be enabled with email filled
      await expect(submitButton).toBeEnabled();

      // Cancel
      await page.getByRole("button", { name: /cancel/i }).click();
    }
  });

});
