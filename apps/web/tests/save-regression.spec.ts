/**
 * Publish System Regression Tests
 *
 * These tests target the four reported publish system symptoms:
 * 1. Changes silently lost when clicking Publish
 * 2. Publish button doesn't work / stays disabled
 * 3. Dirty state stuck after publishing
 * 4. Auto-save not triggering when closing editor
 *
 * @module tests/save-regression.spec
 */

import { expect, test } from "@playwright/test";

// Helper to enter edit mode (should already be default)
async function enterEditMode(page: import("@playwright/test").Page) {
  const modeSwitch = page.getByTestId("mode-switch").getByRole("switch");
  // If switch is checked (simulator mode), click to enter edit mode
  if (await modeSwitch.isChecked()) {
    await modeSwitch.click();
    await expect(modeSwitch).not.toBeChecked();
  }
}

// Helper to get the Publish button (exact match to avoid matching nodes with "Publish" in name)
function getPublishButton(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: "Publish", exact: true });
}

// Helper to get the Discard button
function getDiscardButton(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: "Discard", exact: true });
}

// Helper to click a node by its label text
async function clickNodeByText(page: import("@playwright/test").Page, text: string) {
  const node = page.locator(".react-flow__node").filter({ hasText: text }).first();
  await node.waitFor({ state: "visible", timeout: 5000 });
  await node.click({ force: true });
  await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });
}

// Helper to close node editor via X button
async function closeNodeEditor(page: import("@playwright/test").Page) {
  const closeButton = page
    .getByTestId("node-editor")
    .locator("button")
    .filter({ has: page.locator("svg.lucide-x") })
    .first();
  await closeButton.click();
  await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 3000 });
}

// Helper to complete publish via dialog
// The Publish button may open either:
// 1. A validation dialog (if there are validation warnings) - click "Publish Anyway"
// 2. The Publish Version dialog - click "Publish Version"
async function completePublishViaDialog(page: import("@playwright/test").Page) {
  // Click the global Publish button to open the dialog
  const publishButton = getPublishButton(page);
  await expect(publishButton).toBeEnabled({ timeout: 3000 });

  // Small wait to ensure UI is stable before clicking
  await page.waitForTimeout(300);
  await publishButton.click();

  // Wait for either a validation dialog or the publish version dialog
  // First check if a validation dialog appeared (it has "Publish Anyway" button)
  const publishAnywayButton = page.getByRole("button", { name: /Publish Anyway/i });
  const publishVersionDialog = page.getByRole("dialog", { name: "Publish Version" });

  // Wait for either to appear
  await Promise.race([
    publishAnywayButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => {}),
    publishVersionDialog.waitFor({ state: "visible", timeout: 5000 }).catch(() => {}),
  ]);

  // If validation dialog appeared, click Publish Anyway
  if (await publishAnywayButton.isVisible()) {
    await publishAnywayButton.click();
    // Now wait for the publish version dialog
    await expect(publishVersionDialog).toBeVisible({ timeout: 5000 });
  }

  // Now we should be at the Publish Version dialog
  await expect(publishVersionDialog).toBeVisible({ timeout: 5000 });

  // Click the "Publish Version" button inside the dialog to complete the publish
  const confirmPublishButton = publishVersionDialog.getByRole("button", { name: "Publish Version" });
  await confirmPublishButton.click();

  // Wait for the success toast
  await expect(page.getByText(/published as v\d+/i)).toBeVisible({ timeout: 10000 });

  // Wait for dirty state to propagate to UI (prevents flaky tests)
  await page.waitForTimeout(500);
}

test.describe("Publish System Regressions @publish", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    // Wait for nodes to be rendered
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await enterEditMode(page);
    // Wait for canvas to be fully interactive
    await page.waitForTimeout(500);
  });

  // ===========================================================================
  // Symptom 1: Changes silently lost when clicking Publish
  // ===========================================================================

  test("changes are NOT silently lost when clicking Publish button", async ({ page }) => {
    // Click on a node (not the start node)
    const nodes = page.locator(".react-flow__node");
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Get the label input
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(labelInput).toBeVisible();

    // Store original label for later comparison
    const originalLabel = await labelInput.inputValue();
    const newLabel = `Regression Test ${Date.now()}`;

    // Edit the label
    await labelInput.fill(newLabel);

    // Close the editor (should trigger auto-save to store)
    await closeNodeEditor(page);
    await page.waitForTimeout(300);

    // Complete save via dialog (opens dialog, confirms, waits for toast)
    await completePublishViaDialog(page);

    // Reopen the node and verify the change persisted
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    const savedLabelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(savedLabelInput).toHaveValue(newLabel);

    // Cleanup: restore original label to not pollute other tests
    await savedLabelInput.fill(originalLabel);
    await closeNodeEditor(page);
    await completePublishViaDialog(page);
  });

  // ===========================================================================
  // Symptom 2: Publish button doesn't work / stays disabled
  // ===========================================================================

  test("Publish button becomes enabled after editing node content", async ({ page }) => {
    // Verify Publish button is initially disabled
    const publishButton = getPublishButton(page);
    await expect(publishButton).toBeDisabled();

    // Click on a node (not the start node)
    const nodes = page.locator(".react-flow__node");
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Edit the label
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    const originalLabel = await labelInput.inputValue();
    await labelInput.fill("Test Enable Publish Button");

    // Close editor to trigger auto-save
    await closeNodeEditor(page);
    await page.waitForTimeout(500);

    // Publish button should now be enabled
    await expect(publishButton).toBeEnabled({ timeout: 3000 });

    // Cleanup: discard changes
    const discardButton = getDiscardButton(page);
    if (await discardButton.isEnabled()) {
      await discardButton.click();
      // Wait for discard to complete
      await page.waitForTimeout(500);
    }
  });

  test("Publish button is clickable and completes publish operation", async ({ page }) => {
    // Make a change to enable the publish button
    const nodes = page.locator(".react-flow__node");
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    const originalLabel = await labelInput.inputValue();
    // Use unique label to ensure we're making an actual change
    const uniqueLabel = `Publish Clickable ${Date.now()}`;
    await labelInput.fill(uniqueLabel);
    await closeNodeEditor(page);

    // Wait for dirty state to propagate after editor close
    await page.waitForTimeout(500);

    // Complete save via dialog
    await completePublishViaDialog(page);

    // Verify button action completed (becomes disabled after publish)
    const publishButton = getPublishButton(page);
    await expect(publishButton).toBeDisabled({ timeout: 3000 });

    // Cleanup: Restore original label (only save if changes detected)
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });
    const restoreInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await restoreInput.fill(originalLabel);
    await closeNodeEditor(page);
    const cleanupSave = getPublishButton(page);
    if (await cleanupSave.isEnabled()) {
      await completePublishViaDialog(page);
    }
  });

  // ===========================================================================
  // Symptom 3: Dirty state stuck after saving
  // ===========================================================================

  test("dirty state clears after successful save", async ({ page }) => {
    // Make a change
    const nodes = page.locator(".react-flow__node");
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    const originalLabel = await labelInput.inputValue();
    await labelInput.fill("Dirty State Test");
    await closeNodeEditor(page);

    // Verify dirty state (Save button enabled)
    const publishButton = getPublishButton(page);
    const discardButton = getDiscardButton(page);
    await expect(publishButton).toBeEnabled({ timeout: 3000 });
    await expect(discardButton).toBeEnabled();

    // Complete save via dialog
    await completePublishViaDialog(page);

    // Verify dirty state cleared (both buttons disabled)
    await expect(publishButton).toBeDisabled({ timeout: 5000 });
    await expect(discardButton).toBeDisabled({ timeout: 5000 });

    // Cleanup: Restore original label
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });
    const restoreInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await restoreInput.fill(originalLabel);
    await closeNodeEditor(page);
    await completePublishViaDialog(page);
  });

  test("dirty state clears even with rapid edits before save", async ({ page }) => {
    // Make multiple rapid changes
    const nodes = page.locator(".react-flow__node");
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    const originalLabel = await labelInput.inputValue();

    // Rapid edits
    await labelInput.fill("Rapid Edit 1");
    await page.waitForTimeout(100);
    await labelInput.fill("Rapid Edit 2");
    await page.waitForTimeout(100);
    await labelInput.fill("Rapid Edit Final");

    await closeNodeEditor(page);

    // Complete save via dialog
    await completePublishViaDialog(page);

    // Verify dirty state cleared
    const publishButton = getPublishButton(page);
    await expect(publishButton).toBeDisabled({ timeout: 5000 });

    // Cleanup: Restore original label to not pollute other tests
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });
    const restoreInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await restoreInput.fill(originalLabel);
    await closeNodeEditor(page);
    await completePublishViaDialog(page);
  });

  // ===========================================================================
  // Symptom 4: Auto-save not triggering when closing editor
  // ===========================================================================

  test("auto-save triggers when closing editor with changes via X button", async ({ page }) => {
    // Click on a node
    const nodes = page.locator(".react-flow__node");
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Get original label
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    const originalLabel = await labelInput.inputValue();
    const newLabel = `Auto-save Test ${Date.now()}`;

    // Edit the label
    await labelInput.fill(newLabel);

    // Close editor via X button (should trigger auto-save)
    await closeNodeEditor(page);
    await page.waitForTimeout(500);

    // Verify: Save button should be enabled (changes in store, not saved to server yet)
    const publishButton = getPublishButton(page);
    await expect(publishButton).toBeEnabled({ timeout: 3000 });

    // Reopen and verify changes were saved to store
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    const savedLabelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(savedLabelInput).toHaveValue(newLabel);

    // Cleanup: restore and discard
    await savedLabelInput.fill(originalLabel);
    await closeNodeEditor(page);
    const discardButton = getDiscardButton(page);
    if (await discardButton.isEnabled()) {
      await discardButton.click();
    }
  });

  test("auto-save triggers when clicking canvas to close editor", async ({ page }) => {
    // Click on a node
    const nodes = page.locator(".react-flow__node");
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Edit the label
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    const newLabel = `Canvas Click Auto-save ${Date.now()}`;
    await labelInput.fill(newLabel);

    // Click on the canvas pane to close editor (should trigger auto-save)
    const pane = page.locator(".react-flow__pane");
    const box = await pane.boundingBox();
    if (box) {
      // Click on bottom-left corner to avoid the panel
      await page.mouse.click(box.x + 100, box.y + box.height - 100);
    }

    // Wait for editor to close and auto-save to complete
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    // Verify: Save button should be enabled
    const publishButton = getPublishButton(page);
    await expect(publishButton).toBeEnabled({ timeout: 3000 });

    // Cleanup: discard
    const discardButton = getDiscardButton(page);
    if (await discardButton.isEnabled()) {
      await discardButton.click();
    }
  });

  // ===========================================================================
  // Additional Regression: Rapid Node Switching
  // ===========================================================================

  test("rapid node switching does not lose changes", async ({ page }) => {
    const nodes = page.locator(".react-flow__node");
    const nodeCount = await nodes.count();

    // Skip if not enough nodes
    if (nodeCount < 3) {
      test.skip();
    }

    // Edit first node
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });
    const labelInput1 = page.getByTestId("node-editor").getByRole("textbox").first();
    const originalLabel1 = await labelInput1.inputValue();
    const newLabel1 = `Node 1 Edit ${Date.now()}`;
    await labelInput1.fill(newLabel1);

    // Quickly switch to second node (should auto-save first node's changes)
    await nodes.nth(2).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Wait a bit for auto-save
    await page.waitForTimeout(500);

    // Go back to first node and verify changes were saved
    await nodes.nth(1).click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });
    const savedLabel1 = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(savedLabel1).toHaveValue(newLabel1);

    // Cleanup
    await savedLabel1.fill(originalLabel1);
    await closeNodeEditor(page);
    const discardButton = getDiscardButton(page);
    if (await discardButton.isEnabled()) {
      await discardButton.click();
    }
  });
});
