/**
 * MindState Builder Voice UI E2E Tests
 *
 * Tests for voice input and TTS controls in the MindState Builder preview.
 * Tests UI presence and interaction, not actual audio functionality.
 *
 * @module tests/mindstate-builder-voice
 */

import { expect, test } from "@playwright/test";

/**
 * Helper to navigate to the mindstate builder (new definition)
 * The route requires name and key search params, otherwise it redirects to /mindstate
 */
async function navigateToBuilder(page: import("@playwright/test").Page) {
  // Navigate directly to builder with required params
  await page.goto("/mindstate/new?name=Test%20Definition&key=test-definition");

  // Wait for page to be fully loaded
  await page.waitForLoadState("load");

  // Wait for React app to initialize and builder to render
  // Look for either the builder header OR the list page
  await page.waitForSelector("header, [data-testid='mindstate-list']", { timeout: 15000 });
}

test.describe("MindState Builder Voice UI", () => {
  test("can navigate to new definition builder", async ({ page }) => {
    await navigateToBuilder(page);
    await expect(page).toHaveURL(/\/mindstate\/new\?name=/);

    // Should have the settings button in header
    const settingsButton = page.getByRole("button", { name: "Settings" });
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
  });

  test("builder has header controls", async ({ page }) => {
    await navigateToBuilder(page);

    // Wait for the undo button in header controls (confirms header is fully loaded)
    const undoButton = page.getByRole("button", { name: "Undo" });
    await expect(undoButton).toBeVisible({ timeout: 15000 });
  });
});

test.describe("MindState Builder Preview Panel", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBuilder(page);
  });

  test("preview panel shows empty state message", async ({ page }) => {
    const emptyMessage = page.getByText("No messages yet");
    await expect(emptyMessage).toBeVisible({ timeout: 5000 });
  });

  test("preview panel has input field", async ({ page }) => {
    // Look for input with placeholder containing "Ask" or "anything"
    const input = page.getByPlaceholder(/ask|anything/i);
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test("can type in the input field", async ({ page }) => {
    const input = page.getByPlaceholder(/ask|anything/i);
    await expect(input).toBeVisible({ timeout: 5000 });

    await input.fill("Hello, how are you?");
    await expect(input).toHaveValue("Hello, how are you?");
  });

  test("slash command menu opens when typing /", async ({ page }) => {
    const input = page.getByPlaceholder(/ask|anything/i);
    await expect(input).toBeVisible({ timeout: 5000 });

    // Type / to open command menu
    await input.fill("/");

    // Command menu should appear with scenario options (labels: Anxious, Happy, Frustrated, etc.)
    const menuItem = page.getByText("Anxious").first();
    await expect(menuItem).toBeVisible({ timeout: 5000 });
  });

  test("selecting slash command populates input", async ({ page }) => {
    const input = page.getByPlaceholder(/ask|anything/i);
    await expect(input).toBeVisible({ timeout: 5000 });

    // Type / to open command menu
    await input.fill("/");

    // Wait for menu to appear and click the "Happy" scenario
    const menuItem = page.getByText("Happy").first();
    await expect(menuItem).toBeVisible({ timeout: 5000 });
    await menuItem.click();

    // Input should now have the scenario text
    const value = await input.inputValue();
    expect(value.length).toBeGreaterThan(0);
    expect(value).toContain("excited"); // Happy scenario contains "excited"
  });
});

test.describe("MindState Builder Header Controls", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBuilder(page);
  });

  test("settings button opens settings modal", async ({ page }) => {
    const settingsButton = page.getByRole("button", { name: "Settings" });
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    // Settings modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});
