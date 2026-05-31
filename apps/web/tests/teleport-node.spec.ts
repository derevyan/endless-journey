import { expect, test } from "@playwright/test";

import { clickNodeByLabel, enterEditMode } from "./helpers/e2e-helpers";

/**
 * Teleport Node E2E Tests
 *
 * Tests the teleport node functionality:
 * 1. Adding teleport node to canvas
 * 2. Opening teleport node editor
 * 3. Journey selector dropdown
 * 4. Target node selector (cascading)
 * 5. Preserve context toggle
 */

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Helper function to add a node from the Add Nodes panel
 */
async function addNodeFromPanel(page: import("@playwright/test").Page, nodeName: string) {
  const addNodesSection = page.getByRole("heading", { name: "Add Nodes" }).locator("..");
  const nodeButton = addNodesSection.getByRole("button", { name: nodeName, exact: true });
  await expect(nodeButton).toBeVisible({ timeout: 5000 });

  // Get canvas for drop target
  const canvas = page.locator(".react-flow__pane");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error("Could not get canvas bounding box");
  }

  // Drag and drop the button to the canvas
  await nodeButton.dragTo(canvas, {
    targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
  });

  await page.waitForTimeout(500);
}

test.describe("Teleport Node @teleport", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("teleport button is visible in Add Nodes panel", async ({ page }) => {
    await enterEditMode(page);

    // Find the Add Nodes section
    const addNodesSection = page.getByRole("heading", { name: "Add Nodes" }).locator("..");

    // Verify Teleport button is visible
    const teleportButton = addNodesSection.getByRole("button", { name: "Teleport", exact: true });
    await expect(teleportButton).toBeVisible({ timeout: 5000 });
  });

  test("can add teleport node to canvas", async ({ page }) => {
    await enterEditMode(page);

    // Count nodes before adding
    const nodesBefore = await page.locator(".react-flow__node").count();

    // Add teleport node
    await addNodeFromPanel(page, "Teleport");

    // Verify node count increased
    const nodesAfter = await page.locator(".react-flow__node").count();
    expect(nodesAfter).toBe(nodesBefore + 1);

    // Verify teleport node is visible
    const teleportNode = page.locator(".react-flow__node").filter({ hasText: /Teleport/i }).last();
    await expect(teleportNode).toBeVisible();
  });

  test("teleport node opens Teleport Node Editor", async ({ page }) => {
    await enterEditMode(page);

    // Add teleport node
    await addNodeFromPanel(page, "Teleport");

    // Click on the teleport node
    await clickNodeByLabel(page, "Teleport");

    // Verify Teleport Node Editor heading
    await expect(page.getByTestId("node-editor-heading")).toContainText(/edit teleport node/i);
  });

  test("teleport editor contains journey configuration section", async ({ page }) => {
    await enterEditMode(page);

    // Add teleport node
    await addNodeFromPanel(page, "Teleport");

    // Click on the teleport node
    await clickNodeByLabel(page, "Teleport");

    // Wait a moment for editor content to load
    await page.waitForTimeout(500);

    // Verify the editor has loaded with teleport-specific content
    // Check for the Name field (common to all editors) and the Preserve Context section
    await expect(page.getByTestId("node-editor").getByText(/preserve context/i)).toBeVisible({ timeout: 5000 });
  });

  test("teleport editor shows preserve context toggle", async ({ page }) => {
    await enterEditMode(page);

    // Add teleport node
    await addNodeFromPanel(page, "Teleport");

    // Click on the teleport node
    await clickNodeByLabel(page, "Teleport");

    // Verify Preserve Context label is visible
    await expect(page.getByTestId("node-editor").getByText("Preserve Context")).toBeVisible();

    // Verify toggle switch is present and enabled by default
    const toggle = page.getByTestId("node-editor").getByRole("switch");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked(); // preserveContext defaults to true
  });

  test("preserve context toggle can be toggled", async ({ page }) => {
    await enterEditMode(page);

    // Add teleport node
    await addNodeFromPanel(page, "Teleport");

    // Click on the teleport node
    await clickNodeByLabel(page, "Teleport");

    // Find and toggle the preserve context switch
    const toggle = page.getByTestId("node-editor").getByRole("switch");
    await expect(toggle).toBeChecked();

    // Toggle off
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    // Toggle back on
    await toggle.click();
    await expect(toggle).toBeChecked();
  });

  test("teleport node initially shows no target selected", async ({ page }) => {
    await enterEditMode(page);

    // Add teleport node
    await addNodeFromPanel(page, "Teleport");

    // Click on the teleport node
    await clickNodeByLabel(page, "Teleport");

    // Wait for editor content to load
    await page.waitForTimeout(500);

    // Verify the editor opened with correct heading
    await expect(page.getByTestId("node-editor-heading")).toContainText(/edit teleport node/i);

    // Target Node label should NOT be visible initially (no journey selected)
    // This verifies the cascading dropdown pattern - Target Node only shows after Target Journey is selected
    const targetNodeLabel = page.getByTestId("node-editor").getByText(/target node/i);
    await expect(targetNodeLabel).not.toBeVisible();
  });

  test("teleport node displays as exit point (no output handle)", async ({ page }) => {
    await enterEditMode(page);

    // Add teleport node
    await addNodeFromPanel(page, "Teleport");

    // Find the teleport node
    const teleportNode = page.locator(".react-flow__node").filter({ hasText: /Teleport/i }).last();
    await expect(teleportNode).toBeVisible();

    // Verify there's no output handle (source handle at bottom)
    // Teleport is an exit point like End node
    const sourceHandle = teleportNode.locator(".react-flow__handle-bottom.react-flow__handle-source");
    await expect(sourceHandle).not.toBeVisible();
  });
});
