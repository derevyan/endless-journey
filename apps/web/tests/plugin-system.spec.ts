import { expect, test } from "@playwright/test";

// Import shared helpers
import { clickNodeByLabel, closeNodeEditor, enterEditMode, openCollapsibleSection } from "./helpers/e2e-helpers";

/**
 * Plugin System E2E Tests
 *
 * Tests for the plugin addon system, specifically:
 * - Adding plugins via drag-and-drop
 * - Removing plugins via keyboard and delete button
 * - Configuring plugins via editor
 * - Plugin persistence
 *
 * Note: Uses "Basic Tips" as the target node since it's a message node
 * without existing plugins in the seed data.
 */

// ============================================================================
// Plugin System Helpers
// ============================================================================

/**
 * Get the Follow-Up plugin item in the Add Nodes panel
 */
function getFollowUpPluginItem(page: import("@playwright/test").Page) {
  return page.getByTestId("node-item-plugin-followup");
}

/**
 * Find a plugin addon on a specific node
 */
function getPluginAddonOnNode(page: import("@playwright/test").Page, nodeLabelText: string) {
  const node = page.locator(".react-flow__node").filter({ hasText: nodeLabelText }).first();
  // Plugin addons have aria-label starting with "Plugin addon:"
  return node.locator('[aria-label^="Plugin addon:"]').first();
}

/**
 * Wait for the Add Nodes panel to be visible
 */
async function waitForNodeSelectorPanel(page: import("@playwright/test").Page) {
  const panel = page.getByTestId("node-selector-panel");
  await expect(panel).toBeVisible({ timeout: 5000 });
  return panel;
}

/**
 * Drag the Follow-Up plugin onto a target node using Playwright's dragTo
 */
async function dragFollowUpToNode(page: import("@playwright/test").Page, targetNodeLabel: string) {
  // Ensure node selector panel is visible
  await waitForNodeSelectorPanel(page);

  const source = getFollowUpPluginItem(page);
  await expect(source).toBeVisible({ timeout: 5000 });

  // Get target node
  const targetNode = page.locator(".react-flow__node").filter({ hasText: targetNodeLabel }).first();
  await expect(targetNode).toBeVisible({ timeout: 5000 });

  // Scroll node into view
  await targetNode.scrollIntoViewIfNeeded();

  // Use Playwright's dragTo for reliable drag-drop
  await source.dragTo(targetNode, { force: true });

  // Wait for plugin to be added
  await page.waitForTimeout(500);
}

/**
 * Click on a plugin addon to select it (opens plugin editor)
 */
async function clickPluginAddon(page: import("@playwright/test").Page, nodeLabelText: string) {
  const addon = getPluginAddonOnNode(page, nodeLabelText);
  await expect(addon).toBeVisible({ timeout: 5000 });
  await addon.click();
  await page.waitForTimeout(300);
}

/**
 * Check if plugin addon exists on a node
 */
async function hasPluginAddon(page: import("@playwright/test").Page, nodeLabelText: string): Promise<boolean> {
  const addon = getPluginAddonOnNode(page, nodeLabelText);
  return (await addon.count()) > 0;
}

// ============================================================================
// Test Suite
// ============================================================================

test.describe("Plugin System @plugins", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    // Wait for nodes to be rendered
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // Drag and Drop
  // --------------------------------------------------------------------------

  test("Can drag follow-up plugin onto message node", async ({ page }) => {
    await enterEditMode(page);

    // Use "Basic Tips" - a message node without existing plugin in seed data
    const targetNode = "Basic Tips";

    // Drag Follow-Up plugin onto the node
    await dragFollowUpToNode(page, targetNode);

    // Verify plugin addon now exists
    const addon = getPluginAddonOnNode(page, targetNode);
    await expect(addon).toBeVisible({ timeout: 5000 });

    // Verify addon contains "Follow-Up" text
    await expect(addon.getByText("Follow-Up")).toBeVisible();
  });

  test("Plugin addon shows step count badge", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Add plugin if not already present
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Check the addon has step count
    const addon = getPluginAddonOnNode(page, targetNode);
    await expect(addon).toBeVisible();
    // Should show "0 steps" initially
    await expect(addon.getByText(/\d+ steps?/)).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Plugin Selection and Editor
  // --------------------------------------------------------------------------

  test("Clicking plugin addon opens plugin editor", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Add plugin if not already present
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Close any open editor first
    const editor = page.getByTestId("node-editor");
    if (await editor.isVisible()) {
      await closeNodeEditor(page);
    }

    // Click on the plugin addon
    await clickPluginAddon(page, targetNode);

    // Editor should open with plugin content
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Should show follow-up plugin editor content (has "Follow-Up Steps" label)
    await expect(editor.getByText("Follow-Up Steps", { exact: true })).toBeVisible({ timeout: 5000 });
    // And "Exit Path" section
    await expect(editor.getByText("Exit Path", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // Delete Plugin
  // --------------------------------------------------------------------------

  test("Can delete plugin with Delete key", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Ensure plugin exists
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Verify plugin is there
    await expect(getPluginAddonOnNode(page, targetNode)).toBeVisible();

    // Click on the plugin addon to select it
    await clickPluginAddon(page, targetNode);
    await page.waitForTimeout(300);

    // Press Delete key
    await page.keyboard.press("Delete");
    await page.waitForTimeout(500);

    // Plugin should be gone
    const addonAfter = getPluginAddonOnNode(page, targetNode);
    await expect(addonAfter).not.toBeVisible({ timeout: 3000 });

    // Node should still exist
    const node = page.locator(".react-flow__node").filter({ hasText: targetNode }).first();
    await expect(node).toBeVisible();
  });

  test("Can delete plugin via editor delete button", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Ensure plugin exists
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Click on the plugin addon to open editor
    await clickPluginAddon(page, targetNode);

    const editor = page.getByTestId("node-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Find and click the delete button (Trash icon in header)
    const deleteButton = editor.locator("button").filter({ has: page.locator("svg.lucide-trash-2") }).first();
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    // Wait for plugin to be deleted
    await page.waitForTimeout(500);

    // Plugin should be gone
    const addonAfter = getPluginAddonOnNode(page, targetNode);
    await expect(addonAfter).not.toBeVisible({ timeout: 3000 });

    // Node should still exist
    const node = page.locator(".react-flow__node").filter({ hasText: targetNode }).first();
    await expect(node).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Configuration and Persistence
  // --------------------------------------------------------------------------

  test("Plugin configuration saves correctly", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Ensure plugin exists
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Open plugin editor
    await clickPluginAddon(page, targetNode);

    const editor = page.getByTestId("node-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Wait for plugin editor content to load
    await expect(editor.getByText("Follow-Up Steps", { exact: true })).toBeVisible({ timeout: 5000 });

    // Add a step using the "Add Step" or "Add First Step" button
    const addStepButton = editor.getByRole("button", { name: /add.*step/i }).first();
    await expect(addStepButton).toBeVisible({ timeout: 3000 });
    await addStepButton.click();
    await page.waitForTimeout(500);

    // Step should appear - look for "Step 1" text
    await expect(editor.getByText("Step 1")).toBeVisible({ timeout: 3000 });

    // Close editor (triggers save)
    await closeNodeEditor(page);

    // Reopen plugin editor
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Verify step persisted - "Step 1" should still be visible
    await expect(editor.getByText("Step 1")).toBeVisible({ timeout: 5000 });
  });

  test("Step delay changes persist after save", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Ensure plugin exists with at least one step
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Open plugin editor
    await clickPluginAddon(page, targetNode);
    const editor = page.getByTestId("node-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Add a step if none exists - new steps are auto-expanded
    const delayInputs = editor.locator('input[type="number"]');
    if ((await delayInputs.count()) === 0) {
      const addStepButton = editor.getByRole("button", { name: /add.*step/i }).first();
      await addStepButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for step content to be visible (auto-expanded)
    // The delay inputs are in a grid: Days, Hours, Min, Sec
    await expect(delayInputs.first()).toBeVisible({ timeout: 3000 });

    // Find and update the Hours input (second input in the delay grid)
    const hoursInput = delayInputs.nth(1);
    await hoursInput.fill("5");
    await page.waitForTimeout(300);

    // Close and reopen
    await closeNodeEditor(page);
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Verify hours value persisted - hours is the second delay input
    const delayInputsAfter = editor.locator('input[type="number"]');
    const hoursInputAfter = delayInputsAfter.nth(1);
    await expect(hoursInputAfter).toHaveValue("5");
  });

  test("Step message content persists after save", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Ensure plugin exists
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Open plugin editor
    await clickPluginAddon(page, targetNode);
    const editor = page.getByTestId("node-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Add a step if none exists - new steps are auto-expanded
    let messageTextarea = editor.getByPlaceholder("Enter follow-up message...");
    if (!(await messageTextarea.isVisible())) {
      const addStepButton = editor.getByRole("button", { name: /add.*step/i }).first();
      await addStepButton.click();
      await page.waitForTimeout(500);
      messageTextarea = editor.getByPlaceholder("Enter follow-up message...");
    }

    // Fill message textarea
    await expect(messageTextarea).toBeVisible({ timeout: 3000 });
    const testMessage = "Test follow-up reminder message - please respond!";
    await messageTextarea.fill(testMessage);
    await page.waitForTimeout(300);

    // Close and reopen
    await closeNodeEditor(page);
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Verify message persisted
    const messageTextareaAfter = editor.getByPlaceholder("Enter follow-up message...");
    await expect(messageTextareaAfter).toHaveValue(testMessage);
  });

  test("Plugin enabled/disabled state persists after save", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Ensure plugin exists
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Open plugin editor
    await clickPluginAddon(page, targetNode);
    const editor = page.getByTestId("node-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Find the status switch (near "Active" or "Disabled" text)
    const statusSwitch = editor.locator("button[role='switch']").first();
    await expect(statusSwitch).toBeVisible({ timeout: 3000 });

    // Get current state and toggle it
    const initialState = await statusSwitch.getAttribute("aria-checked");
    await statusSwitch.click();
    await page.waitForTimeout(300);

    // Verify state changed
    const newState = await statusSwitch.getAttribute("aria-checked");
    expect(newState).not.toBe(initialState);

    // Close and reopen
    await closeNodeEditor(page);
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Verify state persisted
    const statusSwitchAfter = editor.locator("button[role='switch']").first();
    const persistedState = await statusSwitchAfter.getAttribute("aria-checked");
    expect(persistedState).toBe(newState);
  });

  // --------------------------------------------------------------------------
  // Duplicate Prevention
  // --------------------------------------------------------------------------

  test("Cannot add duplicate follow-up plugin to same node", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Basic Tips";

    // Ensure plugin exists
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Verify exactly one plugin addon
    const node = page.locator(".react-flow__node").filter({ hasText: targetNode }).first();
    const addons = node.locator('[aria-label^="Plugin addon:"]');
    const countBefore = await addons.count();
    expect(countBefore).toBe(1);

    // Try to add another Follow-Up plugin
    await dragFollowUpToNode(page, targetNode);

    // Should still have exactly one plugin
    const countAfter = await addons.count();
    expect(countAfter).toBe(1);
  });
});
