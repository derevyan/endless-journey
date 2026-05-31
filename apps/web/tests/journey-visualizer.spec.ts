import { expect, test } from "@playwright/test";

test.describe("Journey Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    // Wait for nodes to be rendered
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("moving a node enables the Publish button", async ({ page }) => {
    // Edit mode is now default - no need to toggle the switch
    // Verify Publish button is initially disabled (now icon button with sr-only text)
    const publishButton = page.getByRole("button", { name: "Publish", exact: true });
    await expect(publishButton).toBeDisabled();

    // Wait for nodes to be rendered
    const nodes = page.locator(".react-flow__node");
    await nodes.first().waitFor({ state: "visible", timeout: 10000 });

    // Wait a moment for edit mode to be fully active
    await page.waitForTimeout(500);

    // Get the first node
    const targetNode = nodes.first();
    await targetNode.scrollIntoViewIfNeeded();

    // Get initial position
    const initialBox = await targetNode.boundingBox();
    if (!initialBox) {
      throw new Error("Could not get node bounding box");
    }

    // Calculate center of node
    const centerX = initialBox.x + initialBox.width / 2;
    const centerY = initialBox.y + initialBox.height / 2;

    // Calculate target position (200px to the right and 200px down)
    const targetX = centerX + 200;
    const targetY = centerY + 200;

    // Simulate drag using mouse events
    // Move to center of node
    await page.mouse.move(centerX, centerY);
    await page.waitForTimeout(50);

    // Press mouse down
    await page.mouse.down();
    await page.waitForTimeout(50);

    // Move mouse to target position (simulate drag)
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await page.waitForTimeout(100);

    // Release mouse (end drag)
    await page.mouse.up();

    // Wait for ReactFlow to process the position change and update the store
    // ReactFlow processes position changes asynchronously
    await page.waitForTimeout(1000);

    // Verify the toolbar Publish button is now enabled (pendingChanges should be true)
    await expect(publishButton).toBeEnabled({ timeout: 3000 });
  });

  test("can toggle between edit and simulator modes", async ({ page }) => {
    const modeSwitch = page.getByTestId("mode-switch").getByRole("switch");

    // Verify we start in edit mode (switch unchecked)
    await expect(modeSwitch).not.toBeChecked();

    // Switch to simulator mode
    await modeSwitch.click();
    await expect(modeSwitch).toBeChecked();

    // Verify Publish button is hidden in simulator mode
    const publishButton = page.getByRole("button", { name: "Publish", exact: true });
    await expect(publishButton).not.toBeVisible();

    // Switch back to edit mode
    await modeSwitch.click();
    await expect(modeSwitch).not.toBeChecked();

    // Verify Publish button is visible again in edit mode
    await expect(publishButton).toBeVisible();
  });

  test("publish and discard buttons are disabled with no pending changes", async ({ page }) => {
    // Edit mode is now default - no need to toggle the switch
    // Wait for edges to be rendered
    await page.waitForSelector(".react-flow__edge", { timeout: 15000 });
    await page.waitForTimeout(500);

    // Verify Publish and Discard buttons are disabled (no pending changes) - now icon buttons with sr-only text
    const publishButton = page.getByRole("button", { name: "Publish", exact: true });
    const discardButton = page.getByRole("button", { name: "Discard" });

    await expect(publishButton).toBeDisabled();
    await expect(discardButton).toBeDisabled();
  });

  test("node can be deleted using keyboard Delete key @node-editors", async ({ page }) => {
    // Edit mode is now default - no need to toggle the switch
    // Wait for nodes to be rendered
    const nodes = page.locator(".react-flow__node");
    await nodes.first().waitFor({ state: "visible", timeout: 10000 });

    // Get initial node count
    const initialNodeCount = await nodes.count();
    expect(initialNodeCount).toBeGreaterThan(1);

    // Wait for canvas to be fully active
    await page.waitForTimeout(500);

    // Select a node (not the first one to avoid deleting the start node)
    const targetNode = nodes.nth(1);
    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });

    // Verify node editor opens (node is selected)
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Close the node editor by clicking on the canvas (pane)
    // Click on the bottom-left area to avoid the panel which is positioned top-right
    const pane = page.locator(".react-flow__pane");
    const box = await pane.boundingBox();
    if (box) {
      // Click on bottom-left corner (100px from left, 100px from bottom)
      await page.mouse.click(box.x + 100, box.y + box.height - 100);
    } else {
      // Fallback: click with force if bounding box is not available
      await pane.click({ force: true });
    }
    await page.waitForTimeout(300);

    // Re-select the node
    await targetNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Press Delete key to delete the node
    await page.keyboard.press("Delete");

    // Wait for the deletion to complete
    await page.waitForTimeout(500);

    // Verify node count decreased
    const newNodeCount = await nodes.count();
    expect(newNodeCount).toBe(initialNodeCount - 1);

    // Verify node editor is closed after deletion
    await expect(page.getByTestId("node-editor")).not.toBeVisible();
  });

  test("undo button reverts last change after editing a node @node-editors", async ({ page }) => {
    // Edit mode is now default - no need to toggle the switch
    // Wait for nodes to be rendered
    const nodes = page.locator(".react-flow__node");
    await nodes.first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);

    // Get undo/redo buttons (use exact match to avoid matching node elements)
    const undoButton = page.getByRole("button", { name: "Undo", exact: true });
    const redoButton = page.getByRole("button", { name: "Redo", exact: true });

    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    // Click on the first node to open editor
    const targetNode = nodes.first();
    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });

    // Wait for editor to open
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // Get the original label value
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(labelInput).toBeVisible({ timeout: 5000 });
    const originalLabel = await labelInput.inputValue();

    // Edit the label
    await labelInput.fill("Changed Label For Undo Test");

    // Close the editor to trigger auto-save
    const closeButton = page.getByTestId("node-editor").locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 3000 });

    // Verify undo button is now enabled
    await expect(undoButton).toBeEnabled();

    // Click undo button
    await undoButton.click();

    // Wait for undo to complete
    await page.waitForTimeout(500);

    // Click on the node again to check the label
    await targetNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Verify the label was reverted
    const revertedLabelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(revertedLabelInput).toHaveValue(originalLabel);

    // Verify redo button is now enabled
    await expect(redoButton).toBeEnabled();
  });

  test("redo button re-applies undone change @node-editors", async ({ page }) => {
    // Edit mode is now default - no need to toggle the switch
    // Wait for nodes to be rendered
    const nodes = page.locator(".react-flow__node");
    await nodes.first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);

    // Get undo/redo buttons (use exact match)
    const undoButton = page.getByRole("button", { name: "Undo", exact: true });
    const redoButton = page.getByRole("button", { name: "Redo", exact: true });

    // Click on the first node to open editor
    const targetNode = nodes.first();
    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });

    // Wait for editor to open
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // Edit the label
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(labelInput).toBeVisible({ timeout: 5000 });
    const newLabel = "Changed Label For Redo Test";
    await labelInput.fill(newLabel);

    // Close the editor to trigger auto-save
    const closeButton = page.getByTestId("node-editor").locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 3000 });

    // Wait a bit for state to settle
    await page.waitForTimeout(300);

    // Verify undo button is enabled
    await expect(undoButton).toBeEnabled();

    // Click undo to revert
    await undoButton.click();
    await page.waitForTimeout(500);

    // Verify redo button is now enabled (use timeout for React re-render)
    await expect(redoButton).toBeEnabled({ timeout: 5000 });

    // Click redo to re-apply
    await redoButton.click();
    await page.waitForTimeout(800);

    // Click canvas to reset focus state before verification
    await page.locator(".react-flow__pane").first().click();
    await page.waitForTimeout(200);

    // Click on the node again to check the label
    await targetNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Verify the label was re-applied
    const reappliedLabelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(reappliedLabelInput).toHaveValue(newLabel);

    // Verify undo is enabled and redo is disabled
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();
  });

  test("keyboard shortcut Ctrl+Z triggers undo @node-editors", async ({ page }) => {
    // Edit mode is now default - no need to toggle the switch
    // Wait for nodes to be rendered
    const nodes = page.locator(".react-flow__node");
    await nodes.first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);

    // Click on the first node to open editor
    const targetNode = nodes.first();
    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });

    // Wait for editor to open
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // Get original label
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(labelInput).toBeVisible({ timeout: 5000 });
    const originalLabel = await labelInput.inputValue();

    // Edit the label
    await labelInput.fill("Changed For Keyboard Undo");

    // Close the editor to trigger auto-save
    const closeButton = page.getByTestId("node-editor").locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(300);

    // Press Ctrl+Z (or Meta+Z on Mac) to undo
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(500);

    // Click on the node again to check the label
    await targetNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Verify the label was reverted
    const revertedLabelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(revertedLabelInput).toHaveValue(originalLabel);
  });

  test("keyboard shortcut Ctrl+Shift+Z triggers redo @node-editors", async ({ page }) => {
    // Edit mode is now default - no need to toggle the switch
    // Wait for nodes to be rendered
    const nodes = page.locator(".react-flow__node");
    await nodes.first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);

    // Click on the first node to open editor
    const targetNode = nodes.first();
    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });

    // Wait for editor to open
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // Edit the label
    const labelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(labelInput).toBeVisible({ timeout: 5000 });
    const newLabel = "Changed For Keyboard Redo";
    await labelInput.fill(newLabel);

    // Close the editor to trigger auto-save
    const closeButton = page.getByTestId("node-editor").locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(300);

    // Blur focus before keyboard shortcuts (ensures shortcuts aren't blocked by input focus)
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    // Press Ctrl+Z to undo
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(500);

    // Press Ctrl+Shift+Z to redo
    await page.keyboard.press("Control+Shift+z");
    await page.waitForTimeout(800);

    // Click canvas to reset focus state before verification
    await page.locator(".react-flow__pane").first().click();
    await page.waitForTimeout(200);

    // Click on the node again to check the label
    await targetNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 5000 });

    // Verify the label was re-applied
    const reappliedLabelInput = page.getByTestId("node-editor").getByRole("textbox").first();
    await expect(reappliedLabelInput).toHaveValue(newLabel);
  });
});
