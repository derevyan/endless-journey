/**
 * Shared E2E Test Helpers
 *
 * Common helper functions for Playwright E2E tests.
 * These helpers reduce duplication across test files.
 *
 * @module tests/helpers/e2e-helpers
 */

import { expect, type Page } from "@playwright/test";

// ============================================================================
// Edit Mode Helpers
// ============================================================================

/**
 * Ensure we're in edit mode (not simulator mode).
 *
 * Note: Edit mode is now the default. This function checks if we're
 * in simulator mode and switches back to edit mode if needed.
 */
export async function enterEditMode(page: Page) {
  const modeSwitch = page.getByTestId("mode-switch");
  await expect(modeSwitch).toBeVisible({ timeout: 5000 });

  // Check if we're in simulator mode (switch would say "Switch to Edit mode")
  const switchButton = modeSwitch.getByRole("switch");
  const ariaLabel = await switchButton.getAttribute("aria-label");

  if (ariaLabel === "Switch to Edit mode") {
    // We're in simulator mode, click to switch to edit mode
    await switchButton.click();
    await page.waitForTimeout(500);
  }
  // Otherwise we're already in edit mode, nothing to do
}

/**
 * Enter simulator mode using the mode toggle switch.
 *
 * The mode switch is a toggle with Pencil (edit) and Play (simulator) icons.
 * Clicking the switch when in edit mode switches to simulator mode.
 */
export async function enterSimulatorMode(page: Page) {
  const modeSwitch = page.getByTestId("mode-switch");
  await expect(modeSwitch).toBeVisible({ timeout: 5000 });

  // Check if we're in edit mode (switch would say "Switch to Simulator mode")
  const switchButton = modeSwitch.getByRole("switch");
  const ariaLabel = await switchButton.getAttribute("aria-label");

  if (ariaLabel === "Switch to Simulator mode") {
    // We're in edit mode, click to switch to simulator mode
    await switchButton.click();
    await page.waitForTimeout(500);
  }
  // Otherwise we're already in simulator mode, nothing to do

  // Wait for simulator UI to be ready
  // Check that mode switch now says "Switch to Edit mode" (meaning we're in simulator mode)
  await expect(switchButton).toHaveAttribute("aria-label", "Switch to Edit mode", { timeout: 5000 });
}

// ============================================================================
// Edge Interaction Helpers
// ============================================================================

/**
 * Click on an edge by its label text
 * Selects the edge in the canvas and opens the edge editor panel
 *
 * Note: React Flow edges are SVG elements. The edge label is rendered
 * as a foreignObject within the SVG edge path.
 */
export async function clickEdgeByLabel(page: Page, labelText: string) {
  const edges = page.locator(".react-flow__edge");
  await edges.first().waitFor({ state: "visible", timeout: 15000 });

  // Find edge by label text
  const targetEdge = edges.filter({ hasText: labelText }).first();
  const count = await targetEdge.count();

  if (count === 0) {
    throw new Error(`Could not find edge with label: ${labelText}`);
  }

  await targetEdge.scrollIntoViewIfNeeded();
  await targetEdge.click({ force: true });

  // Wait for edge editor to open
  await expect(page.getByTestId("edge-editor")).toBeVisible({ timeout: 10000 });
}

/**
 * Click on a regular (non-managed, non-virtual) edge to open the edge editor
 * Skips managed edges (managed-btn::*) and virtual edges (virtual-fu-*) since they're not editable
 *
 * @param options.expectEditor - Whether to wait for edge editor to open (default: true)
 *                               Set to false when testing that managed edges don't open editor
 */
export async function clickFirstEditableEdge(page: Page, options: { expectEditor?: boolean } = {}) {
  const { expectEditor = true } = options;

  const edges = page.locator(".react-flow__edge");
  // Use 'attached' instead of 'visible' for SVG elements which may not register as visible
  await edges.first().waitFor({ state: "attached", timeout: 15000 });

  // Find edges that are not managed or virtual (by checking their ID doesn't start with managed-btn or virtual-fu)
  // Regular edges have simple IDs like "e1", "edge-123", etc.
  const allEdges = await edges.all();

  for (const edge of allEdges) {
    const edgeId = await edge.getAttribute("data-id");
    if (!edgeId) continue;

    // Skip managed and virtual edges
    if (edgeId.startsWith("managed-btn::") || edgeId.startsWith("virtual-fu-")) {
      continue;
    }

    // Found a regular edge - click it
    await edge.scrollIntoViewIfNeeded();
    const edgePath = edge.locator("path.react-flow__edge-path");
    await edgePath.click({ force: true });

    if (expectEditor) {
      await expect(page.getByTestId("edge-editor")).toBeVisible({ timeout: 10000 });
    }
    return;
  }

  throw new Error("Could not find any editable (non-managed, non-virtual) edge");
}

// ============================================================================
// Node Interaction Helpers
// ============================================================================

/**
 * Click on a node by its label text or aria-label content
 * Works with both text content and aria-label attributes
 */
export async function clickNodeByLabel(page: Page, labelText: string) {
  const nodes = page.locator(".react-flow__node");
  await nodes.first().waitFor({ state: "visible", timeout: 15000 });

  // Try to find by aria-label first (most reliable - all nodes have it)
  let targetNode = nodes.locator(`[aria-label*="${labelText}"]`).first();
  let count = await targetNode.count();

  // If not found by aria-label, try visible text content
  if (count === 0) {
    targetNode = nodes.filter({ hasText: labelText }).first();
    count = await targetNode.count();
  }

  if (count === 0) {
    throw new Error(`Could not find node with label: ${labelText}`);
  }

  await targetNode.scrollIntoViewIfNeeded();
  await targetNode.click({ force: true });

  // Wait for editor to open
  await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });
}

// ============================================================================
// Node Editor Helpers
// ============================================================================

/**
 * Close the node editor panel (auto-saves on close).
 * Uses the X button in the header which triggers auto-save validation.
 */
export async function closeNodeEditor(page: Page) {
  const editor = page.getByTestId("node-editor");
  // Click the X button in the header to trigger auto-save and close
  const closeButton = editor
    .locator("button")
    .filter({ has: page.locator("svg.lucide-x") })
    .first();
  await expect(closeButton).toBeVisible({ timeout: 3000 });
  await closeButton.click();
  // Wait for panel to close
  await expect(editor).not.toBeVisible({ timeout: 3000 });
}

/**
 * Open a collapsible section by name in the node editor
 */
export async function openCollapsibleSection(page: Page, sectionName: string | RegExp) {
  const editor = page.getByTestId("node-editor");
  const sectionButton = editor.getByRole("button", { name: sectionName });
  await expect(sectionButton).toBeVisible({ timeout: 5000 });

  // Check if already expanded
  const isExpanded = await sectionButton.getAttribute("aria-expanded");
  if (isExpanded !== "true") {
    await sectionButton.click();
    await page.waitForTimeout(300);
  }
}

// ============================================================================
// Toggle Helpers
// ============================================================================

/**
 * Get a switch element by its associated label text
 */
export function getSwitchByLabel(page: Page, labelText: string) {
  const editor = page.getByTestId("node-editor");
  return editor.locator(`div:has(> div:has-text('${labelText}')) button[role='switch']`).first();
}

/**
 * Toggle a switch to the desired state
 * @param page - Playwright page
 * @param labelText - Label text near the switch
 * @param shouldBeEnabled - Desired state (true = checked, false = unchecked)
 */
export async function toggleSwitch(page: Page, labelText: string, shouldBeEnabled: boolean) {
  const sw = getSwitchByLabel(page, labelText);
  await expect(sw).toBeVisible({ timeout: 3000 });

  const isChecked = (await sw.getAttribute("aria-checked")) === "true";
  if (isChecked !== shouldBeEnabled) {
    await sw.click();
    await page.waitForTimeout(300);
  }
}

// ============================================================================
// CodeMirror Editor Helpers
// ============================================================================

/**
 * Get the CodeMirror content element (contenteditable div)
 * CodeMirror 6 uses a .cm-content element with contenteditable="true"
 */
export function getCodeMirrorContent(page: Page, container = page.getByTestId("node-editor")) {
  return container.locator(".cm-content");
}

/**
 * Type into a CodeMirror editor
 * First clears the editor, then types the new content
 */
export async function typeInCodeMirror(page: Page, text: string, container = page.getByTestId("node-editor")) {
  const cmContent = getCodeMirrorContent(page, container);
  await expect(cmContent).toBeVisible({ timeout: 5000 });

  // Click to focus
  await cmContent.click();

  // Select all and delete existing content
  await page.keyboard.press("Meta+a");
  await page.keyboard.press("Backspace");

  // Type new content
  await page.keyboard.type(text, { delay: 20 });
}

/**
 * Get the text content of a CodeMirror editor
 */
export async function getCodeMirrorText(page: Page, container = page.getByTestId("node-editor")) {
  const cmContent = getCodeMirrorContent(page, container);
  await expect(cmContent).toBeVisible({ timeout: 5000 });
  return cmContent.textContent();
}

/**
 * Check that CodeMirror editor contains specific text
 */
export async function expectCodeMirrorText(page: Page, expectedText: string | RegExp, container = page.getByTestId("node-editor")) {
  const cmContent = getCodeMirrorContent(page, container);
  await expect(cmContent).toBeVisible({ timeout: 5000 });
  await expect(cmContent).toHaveText(expectedText);
}

// ============================================================================
// Simulator Helpers
// ============================================================================

/**
 * Get session ID from simulator store
 */
export async function getSimulatorSessionId(page: Page): Promise<string | null> {
  const sessionId = await page.evaluate(() => {
    const store = (window as any).__simulatorStore;
    return store?.state?.session?.sessionId || null;
  });
  return sessionId;
}

/**
 * Wait for chat message to appear in simulator
 */
export async function waitForChatMessage(page: Page, messageText: string, timeout = 5000) {
  const chatMessages = page.locator("[data-testid='chat-message']");
  await expect(chatMessages.filter({ hasText: messageText }).first()).toBeVisible({ timeout });
}
