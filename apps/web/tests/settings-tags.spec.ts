import { expect, registerCleanup, test } from "./test-helpers";

/**
 * Tags Settings E2E Tests
 *
 * Tests the organization-level tag definitions management.
 * Tags are now a single global scope (organization-wide).
 *
 * These tests require seed data to be present (run `pnpm db:reset`)
 */

// Register cleanup for test data
registerCleanup(test, { tags: true });

test.describe("Tags Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/tags");
    await page.waitForTimeout(1000); // Wait for data to load
  });

  test("can delete a tag", async ({ page }) => {
    // First create a tag to delete
    const uniqueTag = `delete-test-${Date.now()}`;

    await page.getByRole("button", { name: "Add Tag" }).first().click();
    await page.getByRole("textbox", { name: "Tag" }).fill(uniqueTag);
    await page.getByRole("textbox", { name: "Description (optional)" }).fill("Tag to be deleted");
    await page.getByRole("dialog").getByRole("button", { name: "Add Tag" }).click();
    await expect(page.getByRole("cell", { name: uniqueTag })).toBeVisible({ timeout: 5000 });

    // Find the tag row and click its menu button
    const tagRow = page.getByRole("row").filter({ hasText: uniqueTag });
    await tagRow.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: /Delete/i }).click();

    // Confirm deletion
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

    // Tag should be removed
    await expect(page.getByRole("cell", { name: uniqueTag })).not.toBeVisible({ timeout: 5000 });
  });
});
