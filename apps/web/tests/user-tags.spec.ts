import { expect, registerCleanup, test } from "./test-helpers";
import { clickNodeByLabel, enterEditMode } from "./helpers/e2e-helpers";

/**
 * User Tags E2E Tests (Single Global Scope)
 *
 * Tests the user tagging functionality in node editors.
 * Tags are now a single global scope (linked to client/user in CRM).
 */

// Register cleanup for test data
registerCleanup(test, { tags: true });

/**
 * Helper function to expand the User Tags section
 * Note: The button text is "Tags" when no tags are configured, or "Tags N" when N tags exist
 */
async function expandUserTagsSection(page: import("@playwright/test").Page) {
  // Match button that starts with "Tags" (could be "Tags" or "Tags 1" etc. when badge is shown)
  const userTagsButton = page.getByTestId("node-editor").getByRole("button", { name: /^Tags/ });
  await expect(userTagsButton).toBeVisible({ timeout: 5000 });

  const isExpanded = await userTagsButton.getAttribute("aria-expanded");
  if (isExpanded !== "true") {
    await userTagsButton.click();
    await page.waitForTimeout(300);
  }
}

test.describe("User Tags in Node Editor @node-editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
    await enterEditMode(page);
  });

  test("can add a tag", async ({ page }) => {
    await clickNodeByLabel(page, "Welcome");
    await expandUserTagsSection(page);

    // Wait for the Tags section content to be visible
    await page.waitForTimeout(300);

    // Find the Add Tags input - look for input within the Tags section
    const addTagsInput = page.getByTestId("node-editor").locator('input[placeholder="Type tag and press Enter..."]').first();
    await expect(addTagsInput).toBeVisible({ timeout: 5000 });

    // Type a unique tag that won't match autocomplete suggestions
    const uniqueTag = `test-e2e-${Date.now()}`;
    await addTagsInput.click();
    await addTagsInput.fill(uniqueTag);
    await page.keyboard.press("Escape"); // Dismiss autocomplete
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify the tag badge appears
    await expect(page.getByTestId("node-editor").getByText(uniqueTag)).toBeVisible({ timeout: 5000 });
  });

  test("can add tags to Remove Tags section", async ({ page }) => {
    await clickNodeByLabel(page, "Welcome");
    await expandUserTagsSection(page);
    await page.waitForTimeout(300);

    // The Remove Tags input is the second placeholder in the section
    const removeTagsInput = page.getByTestId("node-editor").locator('input[placeholder="Type tag and press Enter..."]').last();
    await expect(removeTagsInput).toBeVisible({ timeout: 5000 });

    // Add a unique tag to remove
    const removeTag = `remove-tag-${Date.now()}`;
    await removeTagsInput.click();
    await removeTagsInput.fill(removeTag);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify the tag appears
    await expect(page.getByTestId("node-editor").getByText(removeTag)).toBeVisible({ timeout: 5000 });
  });

  test("tag persists after saving and reopening node editor", async ({ page }) => {
    await clickNodeByLabel(page, "Welcome");
    await expandUserTagsSection(page);
    await page.waitForTimeout(300);

    // Add a unique tag
    const uniqueTag = `persist-test-${Date.now()}`;
    const addTagsInput = page.getByTestId("node-editor").locator('input[placeholder="Type tag and press Enter..."]').first();
    await expect(addTagsInput).toBeVisible({ timeout: 5000 });
    await addTagsInput.click();
    await addTagsInput.fill(uniqueTag);
    await page.keyboard.press("Enter"); // Submit the tag
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); // Close any autocomplete dropdown
    await page.waitForTimeout(200);

    // Click outside the tag input to ensure dropdown is fully closed
    await page.getByTestId("node-editor").getByTestId("node-editor-heading").click();
    await page.waitForTimeout(200);

    // Close the editor to trigger auto-save
    const closeButton = page.getByTestId("node-editor").locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();

    // Wait for editor to close (indicates auto-save succeeded)
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 5000 });

    // Click on the same node again to reopen editor
    await clickNodeByLabel(page, "Welcome");
    await expandUserTagsSection(page);
    await page.waitForTimeout(300);

    // Verify tag is still there
    await expect(page.getByTestId("node-editor").getByText(uniqueTag)).toBeVisible({ timeout: 5000 });
  });
});
