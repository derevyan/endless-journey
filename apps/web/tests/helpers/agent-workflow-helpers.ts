/**
 * Agent Workflow E2E Test Helpers
 *
 * Helper functions for testing the Agent Workflow Builder.
 *
 * @module tests/helpers/agent-workflow-helpers
 */

import { expect, type Page } from "@playwright/test";

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigate to the agents list page and wait for it to load
 */
export async function goToAgentsList(page: Page) {
  await page.goto("/agents");
  // Wait for page heading to be visible (specific to avoid nav/header matches)
  await expect(page.getByRole("heading", { name: "AI Agents" })).toBeVisible({ timeout: 10000 });
}

/**
 * Navigate to a specific agent's builder page
 */
export async function goToAgentBuilder(page: Page, agentKey: string) {
  await page.goto(`/agents/${agentKey}`);
  // Wait for canvas to load
  await expect(page.getByTestId("workflow-canvas")).toBeVisible({ timeout: 15000 });
  // Wait for nodes to render
  await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 10000 });
}

/**
 * Use the existing demo-assistant agent for faster tests
 * This agent is created by seed data and always exists
 */
export async function useDemoAgent(page: Page) {
  await goToAgentBuilder(page, "demo-assistant");
}

/**
 * Use the memory-agent demo workflow for memory testing
 */
export async function useMemoryAgent(page: Page) {
  await goToAgentBuilder(page, "memory-agent");
}

// ============================================================================
// Agent Creation Helpers
// ============================================================================

/**
 * Create a new agent via the dialog
 * Adds timestamp suffix to ensure unique keys across test runs
 */
export async function createNewAgent(
  page: Page,
  options: { name: string; description?: string }
): Promise<string> {
  // Click "New Agent" button
  const newAgentButton = page.getByRole("button", { name: /new agent/i });
  await expect(newAgentButton).toBeVisible();
  await newAgentButton.click();

  // Wait for dialog
  await expect(page.getByTestId("new-agent-dialog")).toBeVisible({ timeout: 5000 });

  // Add timestamp suffix to name for uniqueness
  const uniqueName = `${options.name} ${Date.now()}`;
  await page.getByTestId("agent-name-input").fill(uniqueName);

  // Fill description if provided
  if (options.description) {
    await page.getByTestId("agent-description-input").fill(options.description);
  }

  // Get the generated key before submitting
  const keyInput = page.getByTestId("agent-key-input");
  const generatedKey = await keyInput.inputValue();

  // Click create
  await page.getByTestId("dialog-create-button").click();

  // Wait for navigation to builder
  await expect(page.getByTestId("workflow-canvas")).toBeVisible({ timeout: 15000 });

  return generatedKey;
}

// ============================================================================
// Canvas Interaction Helpers
// ============================================================================

/**
 * Click on a workflow node by its type
 */
export async function clickWorkflowNode(page: Page, nodeType: string) {
  const nodes = page.locator(".react-flow__node");
  await nodes.first().waitFor({ state: "visible", timeout: 10000 });

  // Find node by type (data-type attribute or aria-label)
  const targetNode = nodes.locator(`[data-type="${nodeType}"]`).first();
  let count = await targetNode.count();

  if (count === 0) {
    // Try by aria-label which includes the node type
    const byAriaLabel = nodes.locator(`[aria-label*="${nodeType}"]`).first();
    count = await byAriaLabel.count();
    if (count > 0) {
      await byAriaLabel.click({ force: true });
      return;
    }
    throw new Error(`Could not find workflow node of type: ${nodeType}`);
  }

  await targetNode.click({ force: true });
}

/**
 * Click on the first agent node in the canvas
 */
export async function clickAgentNode(page: Page) {
  const nodes = page.locator(".react-flow__node");
  await nodes.first().waitFor({ state: "visible", timeout: 10000 });

  // Agent nodes typically have the agent icon/type
  const agentNode = nodes.filter({ hasText: /agent|assistant/i }).first();
  const count = await agentNode.count();

  if (count === 0) {
    throw new Error("Could not find any agent node");
  }

  await agentNode.scrollIntoViewIfNeeded();
  await agentNode.click({ force: true });
}

/**
 * Drag a node from the selector panel to the canvas
 */
export async function dragNodeToCanvas(page: Page, nodeType: string) {
  const nodeItem = page.getByTestId(`node-item-${nodeType}`);
  await expect(nodeItem).toBeVisible({ timeout: 5000 });

  const canvas = page.getByTestId("workflow-canvas");
  await expect(canvas).toBeVisible();

  // Get canvas bounding box for drop position
  const canvasBBox = await canvas.boundingBox();
  if (!canvasBBox) throw new Error("Could not get canvas bounding box");

  // Drop in center-right area of canvas (avoiding the selector panel on the left)
  const dropX = canvasBBox.x + canvasBBox.width * 0.6;
  const dropY = canvasBBox.y + canvasBBox.height * 0.5;

  await nodeItem.dragTo(page.locator("body"), {
    targetPosition: { x: dropX, y: dropY },
  });

  await page.waitForTimeout(500);
}

/**
 * Click on a workflow edge
 */
export async function clickWorkflowEdge(page: Page) {
  const edges = page.locator(".react-flow__edge");
  await edges.first().waitFor({ state: "attached", timeout: 10000 });

  const firstEdge = edges.first();
  const edgePath = firstEdge.locator("path.react-flow__edge-path");
  await edgePath.click({ force: true });
  await page.waitForTimeout(300);
}

// ============================================================================
// Header Control Helpers
// ============================================================================

/**
 * Click the Undo button in the header
 */
export async function clickUndo(page: Page) {
  const undoButton = page.getByRole("button", { name: /undo/i });
  await undoButton.click();
  await page.waitForTimeout(300);
}

/**
 * Click the Redo button in the header
 */
export async function clickRedo(page: Page) {
  const redoButton = page.getByRole("button", { name: /redo/i });
  await redoButton.click();
  await page.waitForTimeout(300);
}

/**
 * Click the Publish button to open publish dialog
 */
export async function clickPublish(page: Page) {
  const publishButton = page.getByRole("button", { name: /publish/i }).first();
  await publishButton.click();
}

/**
 * Click the History button to open version panel
 */
export async function clickHistory(page: Page) {
  const historyButton = page.getByRole("button", { name: /history/i });
  await historyButton.click();
  await page.waitForTimeout(300);
}

// ============================================================================
// Test Panel Helpers
// ============================================================================

/**
 * Open the test panel by switching to simulator mode
 */
export async function openTestPanel(page: Page) {
  // Click the mode switch to toggle to simulator mode (which opens the test panel)
  const modeSwitch = page.getByTestId("mode-switch");
  await expect(modeSwitch).toBeVisible({ timeout: 5000 });
  await modeSwitch.click();
  await expect(page.getByTestId("agent-test-panel")).toBeVisible({ timeout: 5000 });
}

/**
 * Send a message in the test panel and wait for response
 */
export async function sendTestMessage(page: Page, message: string): Promise<string> {
  const input = page.getByTestId("test-message-input");
  await expect(input).toBeVisible();
  await input.fill(message);

  // Count existing responses BEFORE sending
  const responsesBefore = await page.getByTestId("agent-response").count();

  const sendButton = page.getByTestId("test-send-button");
  await sendButton.click();

  // Wait for a NEW response to appear (count increases)
  await expect(async () => {
    const responsesAfter = await page.getByTestId("agent-response").count();
    expect(responsesAfter).toBeGreaterThan(responsesBefore);
  }).toPass({ timeout: 60000 });

  // Get the newest response
  const response = page.getByTestId("agent-response").last();
  await expect(response).toBeVisible({ timeout: 5000 });

  return (await response.textContent()) ?? "";
}

/**
 * Close the test panel
 */
export async function closeTestPanel(page: Page) {
  const closeButton = page
    .getByTestId("agent-test-panel")
    .getByRole("button", { name: /close/i });
  await closeButton.click();
  await expect(page.getByTestId("agent-test-panel")).not.toBeVisible({ timeout: 3000 });
}

// ============================================================================
// Node Config Panel Helpers
// ============================================================================

/**
 * Wait for the node config panel to be visible
 */
export async function waitForNodeConfigPanel(page: Page) {
  await expect(page.getByTestId("workflow-node-config")).toBeVisible({ timeout: 5000 });
}

/**
 * Close the node config panel (auto-saves on close).
 * Uses the X button in the header which triggers auto-save validation.
 */
export async function closeNodeConfig(page: Page) {
  const panel = page.getByTestId("workflow-node-config");
  // Click the X button in the header to trigger auto-save and close
  const closeButton = panel.locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
  await closeButton.click();
  await expect(panel).not.toBeVisible({ timeout: 3000 });
}

// ============================================================================
// Settings Dialog Helpers
// ============================================================================

/**
 * Open the workflow settings dialog
 */
export async function openSettings(page: Page) {
  const settingsButton = page.getByTestId("workflow-settings-button");
  await expect(settingsButton).toBeEnabled({ timeout: 5000 });
  await settingsButton.click();
  await expect(page.getByTestId("workflow-settings-dialog")).toBeVisible({ timeout: 5000 });
}

/**
 * Close the workflow settings dialog (save)
 */
export async function saveSettings(page: Page) {
  await page.getByTestId("settings-save-button").click();
  await expect(page.getByTestId("workflow-settings-dialog")).not.toBeVisible({ timeout: 3000 });
}

/**
 * Use the comprehensive-support demo workflow for testing all node types
 */
export async function useComprehensiveSupport(page: Page) {
  await goToAgentBuilder(page, "comprehensive-support");
}

// ============================================================================
// Node Interaction by ID Helpers
// ============================================================================

/**
 * Click on a workflow node by its ID
 */
export async function clickNodeById(page: Page, nodeId: string) {
  const nodes = page.locator(".react-flow__node");
  await nodes.first().waitFor({ state: "visible", timeout: 10000 });

  // Find the node with the specific ID
  const targetNode = page.locator(`[data-id="${nodeId}"]`);

  // Wait for node to be attached in DOM
  await targetNode.waitFor({ state: "attached", timeout: 10000 });

  // Scroll into view if needed
  await targetNode.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  // Click to select the node (this should open the config panel)
  await targetNode.click({ force: true });
  await page.waitForTimeout(500);
}

/**
 * Use the multi-agent-router demo workflow for routing tests
 */
export async function useMultiAgentRouter(page: Page) {
  await goToAgentBuilder(page, "multi-agent-router");
}

/**
 * Reset conversation in test panel
 */
export async function resetTestPanel(page: Page) {
  const resetButton = page
    .getByTestId("agent-test-panel")
    .getByRole("button", { name: /reset/i });
  await resetButton.click();
  await page.waitForTimeout(300);
}
