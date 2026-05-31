import { expect, test } from "@playwright/test";

// Import shared helpers
import { closeNodeEditor, enterEditMode } from "./helpers/e2e-helpers";

/**
 * Follow-Up Plugin E2E Tests
 *
 * Tests for follow-up plugin persistence:
 * - Adding steps and verifying they persist after save
 * - Adding follow-up plugin to questionnaire nodes
 *
 * Uses "starter-template" journey for testing.
 */

// ============================================================================
// Plugin System Helpers (adapted from plugin-system.spec.ts)
// ============================================================================

/**
 * Get the Follow-Up plugin item in the Add Nodes panel
 */
function getFollowUpPluginItem(page: import("@playwright/test").Page) {
  return page.getByTestId("node-item-plugin-followup");
}

/**
 * Get the Questionnaire node item in the Add Nodes panel
 */
function getQuestionnaireNodeItem(page: import("@playwright/test").Page) {
  return page.getByTestId("node-item-questionnaire");
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
 * Drag a questionnaire node onto the canvas
 */
async function dragQuestionnaireNodeToCanvas(page: import("@playwright/test").Page) {
  // Ensure node selector panel is visible
  await waitForNodeSelectorPanel(page);

  const source = getQuestionnaireNodeItem(page);
  await expect(source).toBeVisible({ timeout: 5000 });

  // Get canvas
  const canvas = page.locator(".react-flow__pane").first();
  await expect(canvas).toBeVisible({ timeout: 5000 });

  // Get canvas bounding box for drop position
  const canvasBBox = await canvas.boundingBox();
  if (!canvasBBox) throw new Error("Could not get canvas bounding box");

  // Drop in center-right area of canvas (avoiding the selector panel on the left)
  const dropX = canvasBBox.x + canvasBBox.width * 0.6;
  const dropY = canvasBBox.y + canvasBBox.height * 0.5;

  await source.dragTo(page.locator("body"), {
    targetPosition: { x: dropX, y: dropY },
  });

  // Wait for node to be added
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

/**
 * Count steps in the plugin editor
 * Steps are rendered as collapsible sections with "Step N" in the header (plus delay info)
 */
async function countSteps(page: import("@playwright/test").Page) {
  const editor = page.getByTestId("node-editor");
  // Step headers contain "Step 1", "Step 2", etc. (with delay info after)
  // Use a looser match since the full text is "Step 1 30 min" etc.
  const stepHeaders = editor.locator('span:has-text("Step ")').filter({
    hasText: /^Step \d/,
  });
  return stepHeaders.count();
}

// ============================================================================
// Test Suite
// ============================================================================

test.describe("Follow-Up Plugin Persistence @follow-up-plugin", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/starter-template");
    // Wait for nodes to be rendered
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // Test 1: Step Persistence on starter-template
  // --------------------------------------------------------------------------

  test("Follow-up step persists after save on starter-template", async ({ page }) => {
    await enterEditMode(page);

    // Use "Welcome!" - a message node in starter-template
    const targetNode = "Welcome!";

    // Add follow-up plugin if not already present
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Close any open editor first
    const editor = page.getByTestId("node-editor");
    if (await editor.isVisible()) {
      await closeNodeEditor(page);
    }

    // Open plugin editor
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Wait for plugin editor content to load
    await expect(editor.getByText("Follow-Up Steps", { exact: true })).toBeVisible({ timeout: 5000 });

    // Count existing steps
    const stepCountBefore = await countSteps(page);

    // Add a step using the "Add Step" or "Add First Step" button
    const addStepButton = editor.getByRole("button", { name: /add.*step/i }).first();
    await expect(addStepButton).toBeVisible({ timeout: 3000 });
    await addStepButton.click();
    await page.waitForTimeout(500);

    // Verify step was added
    const stepCountAfterAdd = await countSteps(page);
    expect(stepCountAfterAdd).toBe(stepCountBefore + 1);

    // Configure the new step - fill its message (new step is auto-expanded)
    const messageTextarea = editor.getByPlaceholder("Enter follow-up message...").last();
    await expect(messageTextarea).toBeVisible({ timeout: 3000 });
    const testMessage = "Test follow-up message for persistence check";
    await messageTextarea.fill(testMessage);
    await page.waitForTimeout(300);

    // Close editor (triggers auto-save)
    await closeNodeEditor(page);

    // Reopen plugin editor
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Verify step count persisted
    const stepCountAfterReopen = await countSteps(page);
    expect(stepCountAfterReopen).toBe(stepCountAfterAdd);

    // Verify the new step header is visible (Step N where N is our new step)
    const newStepText = `Step ${stepCountAfterAdd}`;
    await expect(editor.getByText(newStepText)).toBeVisible({ timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // Test 2: Questionnaire Node with Follow-Up Plugin (2 Steps)
  // --------------------------------------------------------------------------

  test("Follow-up plugin with 2 steps persists on questionnaire node", async ({ page }) => {
    await enterEditMode(page);

    // Drag a questionnaire node onto the canvas
    await dragQuestionnaireNodeToCanvas(page);

    // Wait for questionnaire node to appear
    const questionnaireNode = page.locator(".react-flow__node").filter({ hasText: "Questionnaire" }).first();
    await expect(questionnaireNode).toBeVisible({ timeout: 5000 });

    // Drag follow-up plugin onto the questionnaire node
    await dragFollowUpToNode(page, "Questionnaire");

    // Verify plugin addon was added
    const addon = getPluginAddonOnNode(page, "Questionnaire");
    await expect(addon).toBeVisible({ timeout: 5000 });

    // Close any open editor first
    const editor = page.getByTestId("node-editor");
    if (await editor.isVisible()) {
      await closeNodeEditor(page);
    }

    // Open plugin editor
    await clickPluginAddon(page, "Questionnaire");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Wait for plugin editor content to load
    await expect(editor.getByText("Follow-Up Steps", { exact: true })).toBeVisible({ timeout: 5000 });

    // Verify no steps initially
    expect(await countSteps(page)).toBe(0);

    // Add Step 1
    let addStepButton = editor.getByRole("button", { name: /add.*step/i }).first();
    await expect(addStepButton).toBeVisible({ timeout: 3000 });
    await addStepButton.click();
    await page.waitForTimeout(500);

    // Verify Step 1 was added
    await expect(editor.getByText("Step 1")).toBeVisible({ timeout: 3000 });
    expect(await countSteps(page)).toBe(1);

    // Fill Step 1 message
    let messageTextarea = editor.getByPlaceholder("Enter follow-up message...").last();
    await expect(messageTextarea).toBeVisible({ timeout: 3000 });
    await messageTextarea.fill("First follow-up reminder");
    await page.waitForTimeout(300);

    // Add Step 2
    addStepButton = editor.getByRole("button", { name: /add step/i }).first();
    await expect(addStepButton).toBeVisible({ timeout: 3000 });
    await addStepButton.click();
    await page.waitForTimeout(500);

    // Verify Step 2 was added
    await expect(editor.getByText("Step 2")).toBeVisible({ timeout: 3000 });
    expect(await countSteps(page)).toBe(2);

    // Fill Step 2 message (it should be auto-expanded as the newly added step)
    messageTextarea = editor.getByPlaceholder("Enter follow-up message...").last();
    await expect(messageTextarea).toBeVisible({ timeout: 3000 });
    await messageTextarea.fill("Second follow-up reminder");
    await page.waitForTimeout(300);

    // Close editor (triggers auto-save)
    await closeNodeEditor(page);

    // Reopen plugin editor
    await clickPluginAddon(page, "Questionnaire");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Verify both steps persisted
    expect(await countSteps(page)).toBe(2);
    await expect(editor.getByText("Step 1")).toBeVisible({ timeout: 5000 });
    await expect(editor.getByText("Step 2")).toBeVisible({ timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // Test 3: AI Configuration Persistence
  // --------------------------------------------------------------------------

  test("AI configuration persists after save", async ({ page }) => {
    await enterEditMode(page);

    const targetNode = "Welcome!";

    // Ensure follow-up plugin exists on node
    if (!(await hasPluginAddon(page, targetNode))) {
      await dragFollowUpToNode(page, targetNode);
    }

    // Close any open editor
    const editor = page.getByTestId("node-editor");
    if (await editor.isVisible()) {
      await closeNodeEditor(page);
    }

    // Open plugin editor
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Ensure we have a step to work with
    const stepCountBefore = await countSteps(page);
    if (stepCountBefore === 0) {
      const addStepButton = editor.getByRole("button", { name: /add.*step/i }).first();
      await addStepButton.click();
      await page.waitForTimeout(500);
    }

    // ─────────────────────────────────────────────────────────────────
    // 1. ENABLE AI - verify config section appears
    // ─────────────────────────────────────────────────────────────────
    // Find the specific row with justify-between layout that contains the AI toggle
    const aiToggleRow = editor
      .locator(".flex.items-center.justify-between.py-2.px-3")
      .filter({ hasText: "AI-Generated Messages" })
      .first();
    const aiToggle = aiToggleRow.getByRole("switch");
    await aiToggle.click();
    await page.waitForTimeout(300);

    // Verify AI config section appeared (context toggles)
    await expect(editor.getByText("Model")).toBeVisible({ timeout: 3000 });
    await expect(editor.getByText("Include User Profile")).toBeVisible({ timeout: 3000 });
    await expect(editor.getByText("Include Node Context")).toBeVisible({ timeout: 3000 });
    await expect(editor.getByText("Include Session Context")).toBeVisible({ timeout: 3000 });

    // ─────────────────────────────────────────────────────────────────
    // 2. VERIFY STEP LABEL CHANGED
    // ─────────────────────────────────────────────────────────────────
    // The step might already be expanded from adding it, or we need to expand it
    // Check if "Task Instructions for AI" is already visible; if not, click to expand
    const taskInstructionsLabel = editor.getByText("Task Instructions for AI");
    if (!(await taskInstructionsLabel.isVisible())) {
      const stepHeader = editor.getByText(/^Step 1/).first();
      await stepHeader.click();
      await page.waitForTimeout(300);
    }

    // Verify label changed from "Message" to "Task Instructions for AI"
    await expect(taskInstructionsLabel).toBeVisible({ timeout: 3000 });

    // Verify fallback field visible
    await expect(editor.getByText("Fallback Message")).toBeVisible({ timeout: 3000 });

    // ─────────────────────────────────────────────────────────────────
    // 3. CONFIGURE AI SETTINGS
    // ─────────────────────────────────────────────────────────────────
    // Fill task instructions (required when AI enabled)
    const taskInstructionsTextarea = editor.getByPlaceholder(/friendly reminder/i);
    await taskInstructionsTextarea.fill("Send a friendly order update reminder.");
    await page.waitForTimeout(200);

    // Toggle session context ON (it's OFF by default) to test persistence
    // Use specific class selector for the toggle row (flex justify-between py-2)
    const sessionContextRow = editor
      .locator(".flex.items-center.justify-between.py-2")
      .filter({ hasText: "Include Session Context" })
      .first();
    const sessionContextToggle = sessionContextRow.getByRole("switch");
    await sessionContextToggle.click();
    await page.waitForTimeout(200);

    // Fill fallback content in step
    const fallbackTextarea = editor.getByPlaceholder(/AI generation fails/i);
    await fallbackTextarea.fill("Your order is being processed!");
    await page.waitForTimeout(200);

    // ─────────────────────────────────────────────────────────────────
    // 4. CLOSE AND REOPEN - verify persistence
    // ─────────────────────────────────────────────────────────────────
    await closeNodeEditor(page);

    // Reopen plugin editor
    await clickPluginAddon(page, targetNode);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Verify AI is still enabled (config section visible with context toggles)
    await expect(editor.getByText("Model")).toBeVisible({ timeout: 3000 });
    await expect(editor.getByText("Include User Profile")).toBeVisible({ timeout: 3000 });
    await expect(editor.getByText("Include Node Context")).toBeVisible({ timeout: 3000 });

    // Verify user profile toggle persisted (should be checked - default ON)
    const userProfileRowAfter = editor
      .locator(".flex.items-center.justify-between.py-2")
      .filter({ hasText: "Include User Profile" })
      .first();
    const userProfileAfter = userProfileRowAfter.getByRole("switch");
    await expect(userProfileAfter).toHaveAttribute("aria-checked", "true");

    // Verify session context toggle persisted (should be checked - we turned it ON)
    const sessionContextRowAfter = editor
      .locator(".flex.items-center.justify-between.py-2")
      .filter({ hasText: "Include Session Context" })
      .first();
    const sessionContextAfter = sessionContextRowAfter.getByRole("switch");
    await expect(sessionContextAfter).toHaveAttribute("aria-checked", "true");

    // Expand step if needed and verify content persisted
    const taskInstructionsAfter = editor.getByPlaceholder(/friendly reminder/i);
    if (!(await taskInstructionsAfter.isVisible())) {
      const stepHeaderAfter = editor.getByText(/^Step 1/).first();
      await stepHeaderAfter.click();
      await page.waitForTimeout(300);
    }

    // Verify task instructions persisted
    await expect(taskInstructionsAfter).toHaveValue("Send a friendly order update reminder.");

    // Verify fallback persisted
    const fallbackAfter = editor.getByPlaceholder(/AI generation fails/i);
    await expect(fallbackAfter).toHaveValue("Your order is being processed!");
  });
});
