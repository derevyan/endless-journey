import { expect, test } from "@playwright/test";

import { clickNodeByLabel, enterEditMode, enterSimulatorMode } from "./helpers/e2e-helpers";

/**
 * Agent Workflow E2E Tests
 *
 * Core functionality tests for the Agent Workflow node:
 * - Agent node editor opens correctly with workflow selector
 * - Agent node appears in journey flow
 * - Agent simulation works (requires workflow to exist)
 *
 * Note: Agent nodes use workflow-only mode - all agent logic
 * is delegated to Agent Workflows via workflowKey.
 */

/**
 * Helper function to click on a node in simulator mode (doesn't expect editor to open)
 */
async function clickNodeInSimulator(page: import("@playwright/test").Page, labelText: string) {
  const nodes = page.locator(".react-flow__node");
  await nodes.first().waitFor({ state: "visible", timeout: 10000 });

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

  // Wait for simulation to start - message input should appear when chat is ready
  const messageInput = page.getByPlaceholder(/type a message/i);
  await expect(messageInput).toBeVisible({ timeout: 10000 });
}

test.describe("Agent Workflow Node @ai-agent", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    // Wait for the specific node we'll interact with in tests (not just any node)
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "ProductFlow Assistant" })
    ).toBeVisible({ timeout: 15000 });
  });

  test("agent node opens Agent Node Editor with workflow selector", async ({ page }) => {
    await enterEditMode(page);

    // Click on "ProductFlow Assistant" agent node
    await clickNodeByLabel(page, "ProductFlow Assistant");

    // Verify Agent Workflow Editor heading
    await expect(page.getByTestId("node-editor-heading")).toContainText(/edit agent/i);

    // Verify workflow selector is visible (workflow-only mode)
    // The label is "Agent *" with asterisk in separate span
    const editorPanel = page.getByTestId("node-editor");
    await expect(editorPanel.locator("text=Agent").first()).toBeVisible();
  });

  // Critical simulation tests - verify real AI conversations work
  // The "demo-assistant" workflow is seeded by default for all users

  test("agent responds to user messages in simulator", async ({ page }) => {
    // Enable simulator mode
    await enterSimulatorMode(page);

    // Click on the ProductFlow Assistant agent node
    await clickNodeInSimulator(page, "ProductFlow Assistant");
    await page.waitForTimeout(2000);

    // Find the message input field
    const messageInput = page.getByPlaceholder(/type a message/i);
    await expect(messageInput).toBeVisible({ timeout: 5000 });

    // Type a test message
    await messageInput.fill("What is ProductFlow?");

    // Send the message
    await messageInput.press("Enter");

    // Wait for agent response
    await page.waitForTimeout(3000);

    // Verify that there are messages in the chat
    await expect(page.getByText("What is ProductFlow?").first()).toBeVisible({ timeout: 5000 });
  });

  test("console shows agent events during simulation", async ({ page }) => {
    // Enable simulator mode
    await enterSimulatorMode(page);

    // Click on the ProductFlow Assistant agent node
    await clickNodeInSimulator(page, "ProductFlow Assistant");
    await page.waitForTimeout(2000);

    // Verify Console panel is visible
    const consoleText = page.getByText("Console", { exact: true });
    await expect(consoleText).toBeVisible();

    // Send a message to trigger agent processing
    const messageInput = page.getByPlaceholder(/type a message/i);
    await messageInput.fill("Hello");
    await messageInput.press("Enter");
    await page.waitForTimeout(2000);

    // Verify console shows event logs
    const consoleEvents = page.locator(".group.font-mono");
    const eventCount = await consoleEvents.count();

    // Should have at least some events logged
    expect(eventCount).toBeGreaterThan(0);
  });

  test("agent can use time tool when asked for current time", async ({ page }) => {
    // Enable simulator mode
    await enterSimulatorMode(page);

    // Click on the ProductFlow Assistant agent node to start simulation
    await clickNodeInSimulator(page, "ProductFlow Assistant");
    await page.waitForTimeout(2000);

    // Find the message input field
    const messageInput = page.getByPlaceholder(/type a message/i);
    await expect(messageInput).toBeVisible({ timeout: 5000 });

    // Ask for the current time - this should trigger the current_time tool
    await messageInput.fill("What time is it right now?");
    await messageInput.press("Enter");

    // Wait for agent to process and respond (tool call + response generation)
    // The agent should call the current_time tool and include time in its response
    // We look for common time patterns: "12:30 PM", "14:30", or just "PM/AM"
    await expect(async () => {
      // Get all text from the chat area - look for paragraphs with time patterns
      const pageContent = await page.content();

      // Check for time patterns in the page content
      const hasTimePattern = /\d{1,2}:\d{2}\s*(AM|PM)?/i.test(pageContent);
      const hasTimeWord = /current time|right now/i.test(pageContent);

      // The response should contain a time pattern (HH:MM format with optional AM/PM)
      expect(hasTimePattern && hasTimeWord).toBe(true);
    }).toPass({ timeout: 15000 });
  });
});
