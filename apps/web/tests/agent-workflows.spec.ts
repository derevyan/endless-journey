/**
 * Agent Workflow Builder E2E Tests
 *
 * Tests for the visual agent workflow canvas editor.
 * Covers agent creation, canvas operations, node configuration,
 * copy/paste, undo/redo, and agent testing.
 *
 * @module tests/agent-workflows.spec
 */

import { expect, test } from "@playwright/test";
import {
  clickAgentNode,
  clickNodeById,
  clickUndo,
  clickWorkflowEdge,
  createNewAgent,
  dragNodeToCanvas,
  goToAgentBuilder,
  goToAgentsList,
  openSettings,
  openTestPanel,
  saveSettings,
  sendTestMessage,
  useComprehensiveSupport,
  useDemoAgent,
  useMemoryAgent,
  useMultiAgentRouter,
  waitForNodeConfigPanel,
} from "./helpers/agent-workflow-helpers";

test.describe("Agent Workflow Builder", () => {
  // ============================================================================
  // Test 1: Agent List Page
  // ============================================================================

  test("shows agent list page with header and new agent button", async ({ page }) => {
    await goToAgentsList(page);

    // Verify page heading (specific selector to avoid nav/header matches)
    await expect(page.getByRole("heading", { name: "AI Agents" })).toBeVisible();

    // Verify "New Agent" button is present
    const newAgentButton = page.getByRole("button", { name: /new agent/i });
    await expect(newAgentButton).toBeVisible();
  });

  // ============================================================================
  // Test 2: Create New Agent
  // ============================================================================

  test("creates new agent and shows default workflow", async ({ page }) => {
    await goToAgentsList(page);

    // Create a new agent
    const agentKey = await createNewAgent(page, {
      name: "Test Workflow Agent",
      description: "A test agent for E2E testing",
    });

    // Verify we're on the builder page
    expect(page.url()).toContain(`/agents/${agentKey}`);

    // Verify canvas is visible
    await expect(page.getByTestId("workflow-canvas")).toBeVisible();

    // Verify default nodes are present (Start → Agent → End)
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3, { timeout: 10000 });

    // Verify we have the expected node types
    await expect(page.locator('[aria-label*="start"]')).toBeVisible();
    await expect(page.locator(".react-flow__node").filter({ hasText: /agent|assistant/i })).toBeVisible();
    await expect(page.locator('[aria-label*="end"]')).toBeVisible();
  });

  // ============================================================================
  // Test 3: Canvas Node Operations
  // ============================================================================

  test("adds and removes nodes from canvas", async ({ page }) => {
    await goToAgentsList(page);
    await createNewAgent(page, { name: "Node Operations Test" });

    // Initial node count should be 3 (start, agent, end)
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3, { timeout: 10000 });

    // Drag a Guard node to the canvas
    await dragNodeToCanvas(page, "guard");

    // Should now have 4 nodes
    await expect(nodes).toHaveCount(4, { timeout: 5000 });

    // Click on the guard node to select it
    const guardNode = nodes.filter({ hasText: /guard/i }).first();
    await guardNode.click({ force: true });

    // Delete the node using keyboard
    await page.keyboard.press("Backspace");

    // Should be back to 3 nodes
    await expect(nodes).toHaveCount(3, { timeout: 5000 });

    // Undo the deletion
    await clickUndo(page);

    // Should have 4 nodes again
    await expect(nodes).toHaveCount(4, { timeout: 5000 });
  });

  // ============================================================================
  // Test 4: Copy/Paste/Duplicate Nodes
  // ============================================================================

  test("copies and pastes nodes with keyboard shortcuts", async ({ page }) => {
    await goToAgentsList(page);
    await createNewAgent(page, { name: "Copy Paste Test" });

    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3, { timeout: 10000 });

    // Click on the agent node to select it
    await clickAgentNode(page);

    // Copy with Cmd/Ctrl+C
    await page.keyboard.press("Meta+c");

    // Wait for toast notification
    await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 3000 });

    // Paste with Cmd/Ctrl+V
    await page.keyboard.press("Meta+v");

    // Should now have 4 nodes (pasted agent)
    await expect(nodes).toHaveCount(4, { timeout: 5000 });

    // Duplicate with Cmd/Ctrl+D
    await page.keyboard.press("Meta+d");

    // Should now have 5 nodes
    await expect(nodes).toHaveCount(5, { timeout: 5000 });
  });

  // ============================================================================
  // Test 5: Edge Operations
  // ============================================================================

  test("selects and deletes edges", async ({ page }) => {
    await goToAgentsList(page);
    await createNewAgent(page, { name: "Edge Operations Test" });

    const edges = page.locator(".react-flow__edge");
    await edges.first().waitFor({ state: "attached", timeout: 10000 });

    // Initial edge count should be 2 (start→agent, agent→end)
    const initialEdgeCount = await edges.count();
    expect(initialEdgeCount).toBe(2);

    // Click on an edge to select it
    await clickWorkflowEdge(page);

    // Edge should be highlighted (has selected class or data attribute)
    const selectedEdge = page.locator(".react-flow__edge.selected");
    await expect(selectedEdge).toBeVisible({ timeout: 3000 });

    // Delete edge delete button should be visible
    const deleteButton = page.locator('[data-testid="edge-delete-button"]');
    const deleteButtonVisible = await deleteButton.isVisible().catch(() => false);

    if (deleteButtonVisible) {
      await deleteButton.click();
      // Should have one less edge
      await expect(edges).toHaveCount(1, { timeout: 5000 });

      // Undo to restore the edge
      await clickUndo(page);
      await expect(edges).toHaveCount(2, { timeout: 5000 });
    } else {
      // If no visible delete button, try keyboard delete
      await page.keyboard.press("Backspace");
      await expect(edges).toHaveCount(1, { timeout: 5000 });
      await clickUndo(page);
      await expect(edges).toHaveCount(2, { timeout: 5000 });
    }
  });

  // ============================================================================
  // Test 6: Node Configuration
  // ============================================================================

  test("opens and edits node configuration", async ({ page }) => {
    await goToAgentsList(page);
    await createNewAgent(page, { name: "Config Test Agent" });

    // Click on the agent node
    await clickAgentNode(page);

    // Config panel should open
    await waitForNodeConfigPanel(page);

    // Verify the panel shows Agent Node settings
    await expect(page.getByTestId("workflow-node-config")).toContainText(/agent/i);

    // Find any input field in the config panel and interact with it
    const configPanel = page.getByTestId("workflow-node-config");
    const inputFields = configPanel.locator("input, textarea");
    const inputCount = await inputFields.count();

    if (inputCount > 0) {
      const firstInput = inputFields.first();
      const isEditable = await firstInput.isEditable().catch(() => false);
      if (isEditable) {
        await firstInput.click();
        await firstInput.fill("Test Value");
      }
    }

    // Config panel should still be visible after interaction
    await expect(page.getByTestId("workflow-node-config")).toBeVisible();
  });

  // ============================================================================
  // Test 7: Publish & Version History
  // ============================================================================

  test("publishes workflow and creates version", async ({ page }) => {
    await goToAgentsList(page);
    await createNewAgent(page, { name: "Save Test Agent" });

    // Make a change - add a node
    await dragNodeToCanvas(page, "guard");

    // Verify unsaved indicator appears
    await expect(page.getByText(/unsaved/i)).toBeVisible({ timeout: 5000 });

    // Click publish button
    const publishButton = page.getByRole("button", { name: /publish/i }).first();
    await expect(publishButton).toBeEnabled();
    await publishButton.click();

    // Publish dialog should appear
    const publishDialog = page.getByRole("dialog");
    await expect(publishDialog).toBeVisible({ timeout: 5000 });

    // Enter version notes
    const notesInput = publishDialog.getByPlaceholder(/notes/i);
    const notesVisible = await notesInput.isVisible().catch(() => false);
    if (notesVisible) {
      await notesInput.fill("Added guard node for testing");
    }

    // Confirm publish
    const confirmButton = publishDialog.getByRole("button", { name: /publish/i });
    await confirmButton.click();

    // Wait for publish to complete (dialog closes, success toast with version number)
    await expect(publishDialog).not.toBeVisible({ timeout: 10000 });
    // Toast shows "Published as v001" or similar
    await expect(page.getByText(/published as v\d+/i)).toBeVisible({ timeout: 5000 });

    // Unsaved indicator should be gone (use exact text match)
    const unsavedBadge = page.locator("text=Unsaved");
    await expect(unsavedBadge).not.toBeVisible({ timeout: 3000 });
  });

  // ============================================================================
  // Test 8: Test Agent Execution
  // ============================================================================

  test("opens test panel and sends message to agent", async ({ page }) => {
    await goToAgentsList(page);
    await createNewAgent(page, { name: "Execution Test Agent" });

    // Wait for canvas to load
    await expect(page.getByTestId("workflow-canvas")).toBeVisible({ timeout: 10000 });

    // Open the test panel
    await openTestPanel(page);

    // Verify test panel is visible
    await expect(page.getByTestId("agent-test-panel")).toBeVisible();

    // Verify empty state message
    await expect(page.getByText(/send a message to test/i)).toBeVisible();

    // Send a test message
    const input = page.getByTestId("test-message-input");
    await input.fill("Hello, can you help me?");

    const sendButton = page.getByTestId("test-send-button");
    await sendButton.click();

    // Wait for thinking indicator (animated dots)
    await expect(page.getByTestId("processing-indicator")).toBeVisible({ timeout: 5000 });

    // Wait for agent response (longer timeout for LLM)
    const response = page.getByTestId("agent-response");
    await expect(response).toBeVisible({ timeout: 60000 });

    // Verify response has content
    const responseText = await response.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(0);

    // Verify execution trace is visible
    const trace = page.getByTestId("execution-trace");
    await expect(trace).toBeVisible({ timeout: 5000 });
  });

  // ============================================================================
  // Test: Node Selector Panel
  // ============================================================================

  test("shows node selector panel with all node types", async ({ page }) => {
    await goToAgentsList(page);
    await createNewAgent(page, { name: "Selector Panel Test" });

    // Verify node selector panel is visible
    await expect(page.getByTestId("node-selector-panel")).toBeVisible();

    // Verify all node types are present
    const expectedNodeTypes = ["agent", "end", "guard", "context", "mcp", "if_else", "user_approval", "transform", "set_state"];

    for (const nodeType of expectedNodeTypes) {
      await expect(page.getByTestId(`node-item-${nodeType}`)).toBeVisible();
    }
  });

  // ============================================================================
  // Test: Workflow Settings Dialog
  // ============================================================================

  test("opens and configures workflow settings", async ({ page }) => {
    // Use demo-assistant for faster test (already seeded)
    await useDemoAgent(page);

    // Open settings dialog
    await openSettings(page);

    // Verify dialog is visible
    const dialog = page.getByTestId("workflow-settings-dialog");
    await expect(dialog).toBeVisible();

    // Verify settings fields are present
    await expect(page.getByTestId("settings-name-input")).toBeVisible();
    await expect(page.getByTestId("settings-description-input")).toBeVisible();
    await expect(page.getByTestId("settings-status-select")).toBeVisible();

    // Test changing name
    const nameInput = page.getByTestId("settings-name-input");
    await nameInput.fill("Updated Workflow Name");

    // Save settings
    await saveSettings(page);

    // Verify workflow is now marked as dirty
    await expect(page.getByText(/unsaved/i)).toBeVisible();
  });
});

// ============================================================================
// Memory & Tool Calling Tests
// ============================================================================

test.describe("Agent Memory & Tools", () => {
  test("agent saves and recalls memories", async ({ page }) => {
    // Navigate to memory-agent workflow
    await useMemoryAgent(page);

    // Open test panel
    await openTestPanel(page);

    // Generate unique identifier for test isolation
    const testId = Date.now().toString().slice(-6);

    // Send a message that should trigger memory save
    await sendTestMessage(page, `My name is TestUser${testId} and I love pizza`);

    // Wait for response
    const response1 = page.getByTestId("agent-response").last();
    await expect(response1).toBeVisible({ timeout: 60000 });

    // Ask what the agent remembers
    await sendTestMessage(page, "What do you remember about me?");

    // Verify agent recalls the saved memory
    const response2 = page.getByTestId("agent-response").last();
    await expect(response2).toBeVisible({ timeout: 60000 });

    // Verify response is substantive (agent processed and responded)
    const responseText = await response2.textContent();
    expect(responseText?.length).toBeGreaterThan(20);

    // If memory works, agent knows something - won't say "I don't know"
    // This is more robust than checking for specific keywords since LLMs can paraphrase
    expect(responseText?.toLowerCase()).not.toMatch(
      /don't (know|have|remember)|no (memory|information|record)|cannot recall|haven't been told/i
    );
  });

  test("agent uses built-in tools without errors", async ({ page }) => {
    // Use demo-assistant with tools enabled it has time tool so lets ask for time and check if weply contains any time pattern
    await useDemoAgent(page);

    // Open test panel
    await openTestPanel(page);

    // Ask something that uses context tools
    await sendTestMessage(page, "Hello! What is the current time?");

    // Verify response (tool should execute without errors)
    const response = page.getByTestId("agent-response").last();
    await expect(response).toBeVisible({ timeout: 60000 });
    // Verify response contains time pattern
    const responseText = await response.textContent();
    expect(responseText?.toLowerCase()).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)?/i);
  });
});

// ============================================================================
// Node Configuration Panel Tests
// ============================================================================

test.describe("Node Configuration Panels", () => {
  test("node selector panel shows all available node types", async ({ page }) => {
    // This test verifies all node types are available for adding
    await useDemoAgent(page);

    // Verify node selector panel is visible
    await expect(page.getByTestId("node-selector-panel")).toBeVisible();

    // Verify all key node types are present
    const nodeTypes = ["guard", "context", "if_else", "transform", "set_state", "user_approval", "mcp"];
    for (const nodeType of nodeTypes) {
      await expect(page.getByTestId(`node-item-${nodeType}`)).toBeVisible();
    }
  });
});

// ============================================================================
// Structured Output Tests
// ============================================================================

test.describe("Structured Output", () => {
  test("can configure JSON output format with properties", async ({ page }) => {
    // Use demo agent for faster test
    await useDemoAgent(page);

    // Click on the agent node to open config
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Expand the Output section (it's collapsed by default)
    const outputSection = page.getByRole("button", { name: /output/i });
    await outputSection.click();

    // Find output format section - it defaults to JSON so badge should be visible
    const schemaBadge = page.getByTestId("output-schema-badge");
    await expect(schemaBadge).toBeVisible({ timeout: 5000 });

    // Click badge to open dialog
    await schemaBadge.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Add a property (dialog already has default "response" property from schema)
    await page.getByRole("button", { name: /add property/i }).click();

    // Fill in property name for the NEW property (second row)
    const propertyInputs = dialog.locator('input[placeholder="Property name"]');
    const newPropertyInput = propertyInputs.last();
    await expect(newPropertyInput).toBeVisible();
    await newPropertyInput.fill("sentiment");

    // Select ENUM type for the new property
    const typeSelects = dialog.locator('[data-testid="property-type-select"]');
    const newTypeSelect = typeSelects.last();
    await newTypeSelect.click();
    await page.getByRole("option", { name: "ENUM" }).click();

    // Add enum values
    const enumInput = dialog.locator('input[placeholder*="enum"]');
    await expect(enumInput).toBeVisible();
    await enumInput.fill("positive");
    await page.keyboard.press("Enter");
    await enumInput.fill("negative");
    await page.keyboard.press("Enter");
    await enumInput.fill("neutral");
    await page.keyboard.press("Enter");

    // Verify enum badges are visible
    await expect(dialog.getByText("positive")).toBeVisible();
    await expect(dialog.getByText("negative")).toBeVisible();
    await expect(dialog.getByText("neutral")).toBeVisible();

    // Save the schema
    await page.getByRole("button", { name: "Update" }).click();

    // Verify dialog closed
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // Verify schema badge shows in the output format section
    await expect(page.getByTestId("output-schema-badge")).toBeVisible();
  });

  test("validates empty enum values", async ({ page }) => {
    await useDemoAgent(page);

    // Click on the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Expand the Output section (it's collapsed by default)
    const outputSection = page.getByRole("button", { name: /output/i });
    await outputSection.click();

    // Click badge to open dialog (format defaults to JSON)
    const schemaBadge = page.getByTestId("output-schema-badge");
    await expect(schemaBadge).toBeVisible({ timeout: 5000 });
    await schemaBadge.click();

    // Dialog opens
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Add a NEW property (dialog already has default properties from schema)
    await page.getByRole("button", { name: /add property/i }).click();

    // Fill property name and select ENUM type for the NEW property
    const propertyInputs = dialog.locator('input[placeholder="Property name"]');
    const newPropertyInput = propertyInputs.last();
    await newPropertyInput.fill("status");

    const typeSelects = dialog.locator('[data-testid="property-type-select"]');
    const newTypeSelect = typeSelects.last();
    await newTypeSelect.click();
    await page.getByRole("option", { name: "ENUM" }).click();

    // DON'T add enum values - button should be disabled
    const updateButton = page.getByRole("button", { name: "Update" });
    await expect(updateButton).toBeDisabled();

    // Add an enum value
    const enumInput = dialog.locator('input[placeholder*="enum"]');
    await enumInput.fill("active");
    await page.keyboard.press("Enter");

    // Now button should be enabled
    await expect(updateButton).toBeEnabled();

    // Cancel and cleanup
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("resets dialog state on cancel", async ({ page }) => {
    await useDemoAgent(page);

    // Open agent node config
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Expand the Output section (it's collapsed by default)
    const outputSection = page.getByRole("button", { name: /output/i });
    await outputSection.click();

    // Click badge to open dialog (format defaults to JSON)
    const schemaBadge = page.getByTestId("output-schema-badge");
    await expect(schemaBadge).toBeVisible({ timeout: 5000 });
    await schemaBadge.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Dialog should have 1 default property ("response") from the default schema
    const propertyRows = dialog.locator('div.border.rounded-md:has(input[placeholder="Property name"])');
    const initialCount = await propertyRows.count();
    expect(initialCount).toBeGreaterThan(0);

    // Add a NEW property
    await page.getByRole("button", { name: /add property/i }).click();
    const propertyInputs = dialog.locator('input[placeholder="Property name"]');
    const newPropertyInput = propertyInputs.last();
    await newPropertyInput.fill("test_field");

    // Now we should have more properties
    await expect(propertyRows).toHaveCount(initialCount + 1);

    // Cancel the dialog
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();

    // Re-open the dialog via badge
    await schemaBadge.click();

    // Dialog should open fresh (without unsaved "test_field" property)
    await expect(dialog).toBeVisible();

    // Should be back to initial count (without the unsaved property)
    await expect(propertyRows).toHaveCount(initialCount);

    // Verify "test_field" is NOT present (cancel discarded the unsaved change)
    await expect(dialog.locator('input[value="test_field"]')).not.toBeVisible();

    // Close dialog
    await page.getByRole("button", { name: "Cancel" }).click();
  });
});

// ============================================================================
// Auto-Save E2E Tests
// ============================================================================

test.describe("Node Config Auto-Save", () => {
  test("auto-saves when switching between nodes", async ({ page }) => {
    // Use demo agent for faster setup
    await useDemoAgent(page);

    // Add a second agent node to the canvas
    await dragNodeToCanvas(page, "agent");
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(4, { timeout: 5000 }); // start + 2 agents + end

    // Click on the first agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Find and edit the system prompt textarea
    const configPanel = page.getByTestId("workflow-node-config");
    const systemPromptTextarea = configPanel.locator("textarea").first();
    await expect(systemPromptTextarea).toBeVisible({ timeout: 5000 });

    // Generate unique test value
    const testValue = `Auto-save test ${Date.now()}`;
    await systemPromptTextarea.fill(testValue);

    // Click on the second agent node (triggers auto-save of first)
    const agentNodes = nodes.filter({ hasText: /agent|assistant/i });
    const secondAgent = agentNodes.nth(1);
    await secondAgent.click({ force: true });

    // Wait for panel to update to new node
    await page.waitForTimeout(500);

    // Click back to the first agent node
    const firstAgent = agentNodes.first();
    await firstAgent.click({ force: true });
    await page.waitForTimeout(500);

    // Verify the system prompt was saved
    const savedSystemPrompt = configPanel.locator("textarea").first();
    await expect(savedSystemPrompt).toHaveValue(testValue);
  });

  test("auto-saves when clicking canvas to close panel", async ({ page }) => {
    await useDemoAgent(page);

    // Click on the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Edit the system prompt
    const configPanel = page.getByTestId("workflow-node-config");
    const systemPromptTextarea = configPanel.locator("textarea").first();
    await expect(systemPromptTextarea).toBeVisible({ timeout: 5000 });

    const testValue = `Canvas click save ${Date.now()}`;
    await systemPromptTextarea.fill(testValue);

    // Click on the canvas (pane) to close the panel and trigger auto-save
    const pane = page.locator(".react-flow__pane");
    const box = await pane.boundingBox();
    if (box) {
      // Click on bottom-left corner (away from config panel which is top-right)
      await page.mouse.click(box.x + 100, box.y + box.height - 100);
    }

    // Verify panel closed
    await expect(configPanel).not.toBeVisible({ timeout: 3000 });

    // Reopen the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Verify the value was saved
    const savedSystemPrompt = page.getByTestId("workflow-node-config").locator("textarea").first();
    await expect(savedSystemPrompt).toHaveValue(testValue);
  });

  test("auto-saves when clicking X button", async ({ page }) => {
    await useDemoAgent(page);

    // Click on the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Edit the system prompt
    const configPanel = page.getByTestId("workflow-node-config");
    const systemPromptTextarea = configPanel.locator("textarea").first();
    await expect(systemPromptTextarea).toBeVisible({ timeout: 5000 });

    const testValue = `X button save ${Date.now()}`;
    await systemPromptTextarea.fill(testValue);

    // Click X button to close panel (triggers auto-save)
    const closeButton = configPanel
      .locator("button")
      .filter({ has: page.locator("svg.lucide-x") })
      .first();
    await closeButton.click();

    // Verify panel closed
    await expect(configPanel).not.toBeVisible({ timeout: 3000 });

    // Reopen the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Verify the value was saved
    const savedSystemPrompt = page.getByTestId("workflow-node-config").locator("textarea").first();
    await expect(savedSystemPrompt).toHaveValue(testValue);
  });

  test("no-op when closing panel without changes", async ({ page }) => {
    await useDemoAgent(page);

    // Click on the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Get the current system prompt value (don't change it)
    const configPanel = page.getByTestId("workflow-node-config");
    const systemPromptTextarea = configPanel.locator("textarea").first();
    await expect(systemPromptTextarea).toBeVisible({ timeout: 5000 });
    const originalValue = await systemPromptTextarea.inputValue();

    // Close without making changes
    const closeButton = configPanel
      .locator("button")
      .filter({ has: page.locator("svg.lucide-x") })
      .first();
    await closeButton.click();

    // Verify panel closed without issues
    await expect(configPanel).not.toBeVisible({ timeout: 3000 });

    // Reopen and verify value is unchanged
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const unchangedValue = await page.getByTestId("workflow-node-config").locator("textarea").first().inputValue();
    expect(unchangedValue).toBe(originalValue);
  });
});

// ============================================================================
// Workflow Execution Path Tests
// ============================================================================

test.describe("Workflow Execution Paths", () => {
  test("conversation history persists across turns", async ({ page }) => {
    // Use memory-agent for multi-turn conversation test (no Question Understanding interference)
    await useMemoryAgent(page);
    await openTestPanel(page);

    // First message - introduce ourselves
    await sendTestMessage(page, "My name is Alex and I work at Journey");

    // Second message - ask about previous context
    await sendTestMessage(page, "What is my name?");

    // Verify agent remembers the name from previous turn
    const response = page.getByTestId("agent-response").last();
    await expect(response).toBeVisible({ timeout: 60000 });

    // Verify response is substantive
    const responseText = await response.textContent();
    expect(responseText?.length).toBeGreaterThan(10);

    // If history works, agent knows the name - won't claim ignorance
    // This is more robust than checking for specific keywords since LLMs can paraphrase
    expect(responseText?.toLowerCase()).not.toMatch(
      /don't (know|have|remember)|no (memory|information|record)|cannot recall|haven't been told|what('s| is) your name/i
    );
  });

  test("multi-agent workflow routes to support agent", async ({ page }) => {
    await useMultiAgentRouter(page);
    await openTestPanel(page);

    // Send a support-related message
    await sendTestMessage(page, "I'm having a technical issue with my account login. Can you help?");

    // Verify we get a response (routing through the workflow)
    const response = page.getByTestId("agent-response").last();
    await expect(response).toBeVisible({ timeout: 200000 });

    // Response should be helpful support content (not sales-focused)
    const responseText = await response.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText?.length).toBeGreaterThan(10);
  });

  test("multi-agent workflow routes to sales agent", async ({ page }) => {
    await useMultiAgentRouter(page);
    await openTestPanel(page);

    // Send a sales-related message
    await sendTestMessage(page, "What are your pricing plans? I want to upgrade my subscription.");

    // Verify we get a response
    const response = page.getByTestId("agent-response").last();
    await expect(response).toBeVisible({ timeout: 90000 });

    // Response should mention pricing or plans
    const responseText = await response.textContent();
    expect(responseText).toBeTruthy();
    // Sales agent should mention pricing-related terms
    expect(responseText?.toLowerCase()).toMatch(/price|plan|basic|pro|enterprise|\$/);
  });
});

// ============================================================================
// Explicit Save Button Tests (after autoSave: false fix)
// ============================================================================

test.describe("Node Config Explicit Save", () => {
  test("shows Save button in editor panel and saves inline prompt", async ({ page }) => {
    // Use demo agent for faster test
    await useDemoAgent(page);

    // Click on the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");

    // Verify Save button is visible in the panel footer (autoSave: false shows Save button)
    const saveButton = configPanel.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // Save button should be disabled initially (no changes yet)
    await expect(saveButton).toBeDisabled();

    // Find and edit the system prompt textarea
    const systemPromptTextarea = configPanel.locator("textarea").first();
    await expect(systemPromptTextarea).toBeVisible({ timeout: 5000 });

    // Generate unique test value
    const testValue = `Explicit save test ${Date.now()}`;
    await systemPromptTextarea.fill(testValue);

    // Wait a moment for dirty state to propagate
    await page.waitForTimeout(300);

    // Save button should now be enabled (form is dirty)
    await expect(saveButton).toBeEnabled({ timeout: 3000 });

    // Cancel button should also appear when dirty
    const cancelButton = configPanel.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeVisible();

    // Click Save button
    await saveButton.click();

    // Wait for save to complete - Save button becomes disabled again
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    // Verify "Unsaved" indicator in header appears then clears (workflow is saved)
    // Panel should still be open
    await expect(configPanel).toBeVisible();

    // Close and reopen to verify persistence
    const closeButton = configPanel.locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();
    await expect(configPanel).not.toBeVisible({ timeout: 3000 });

    // Reopen the agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Verify the value was saved
    const savedTextarea = page.getByTestId("workflow-node-config").locator("textarea").first();
    await expect(savedTextarea).toHaveValue(testValue);
  });

  test("Cancel button discards changes", async ({ page }) => {
    await useDemoAgent(page);

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");
    const textarea = configPanel.locator("textarea").first();

    // Get original value
    const originalValue = await textarea.inputValue();

    // Make a change
    const tempValue = `Cancel test ${Date.now()}`;
    await textarea.fill(tempValue);
    await page.waitForTimeout(300);

    // Verify Cancel button is visible
    const cancelButton = configPanel.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeVisible();

    // Click Cancel
    await cancelButton.click();

    // Wait for reset
    await page.waitForTimeout(300);

    // Verify value was reset to original
    await expect(textarea).toHaveValue(originalValue);

    // Cancel button should disappear (no longer dirty)
    await expect(cancelButton).not.toBeVisible({ timeout: 3000 });
  });

  test("header Publish button enables on form changes", async ({ page }) => {
    await useDemoAgent(page);

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Find header publish button (the rocket icon with sr-only "Publish" text)
    const headerPublishButton = page.getByRole("button", { name: /publish/i }).first();

    const configPanel = page.getByTestId("workflow-node-config");
    const textarea = configPanel.locator("textarea").first();

    // Make a change
    const testValue = `Header save test ${Date.now()}`;
    await textarea.fill(testValue);
    await page.waitForTimeout(500);

    // Verify "Unsaved" indicator appears in header
    await expect(page.getByText(/unsaved/i)).toBeVisible({ timeout: 5000 });

    // Header publish button should be enabled
    await expect(headerPublishButton).toBeEnabled({ timeout: 3000 });
  });

  test("System Prompt dialog save persists changes", async ({ page }) => {
    await useDemoAgent(page);

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");
    const textarea = configPanel.locator("textarea").first();

    // First, add enough text to show the expand button (needs >100 chars)
    const longText = "You are a helpful AI assistant. ".repeat(5); // ~160 chars
    await textarea.fill(longText);
    await page.waitForTimeout(300);

    // Find and click the expand button (Maximize icon)
    const expandButton = configPanel.locator('button[title="Expand to fullscreen"]');
    await expect(expandButton).toBeVisible({ timeout: 3000 });
    await expandButton.click();

    // Wait for dialog to open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should have the System Prompt title
    await expect(dialog.getByText("System Prompt")).toBeVisible();

    // Generate unique test value for dialog
    const dialogTestValue = `Dialog save test ${Date.now()}. This is a longer prompt to test the expandable editor functionality.`;

    // Monaco editor: Use JavaScript to set value directly via Monaco's API
    // This is more reliable than trying keyboard shortcuts across platforms
    const monacoEditor = dialog.locator(".monaco-editor");
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });

    // Set Monaco editor value via JavaScript
    await page.evaluate((newValue) => {
      // Monaco stores editor instance on the container element
      const editorElement = document.querySelector(".monaco-editor");
      if (editorElement) {
        // Access Monaco's internal API
        const monacoInstance = (editorElement as HTMLElement & { _monacoEditor?: { setValue: (v: string) => void } })._monacoEditor;
        if (monacoInstance?.setValue) {
          monacoInstance.setValue(newValue);
        } else {
          // Fallback: try to access via Monaco's global registry
          const monaco = (window as Window & { monaco?: { editor: { getEditors: () => Array<{ setValue: (v: string) => void }> } } }).monaco;
          if (monaco?.editor?.getEditors) {
            const editors = monaco.editor.getEditors();
            if (editors.length > 0) {
              editors[0].setValue(newValue);
            }
          }
        }
      }
    }, dialogTestValue);

    // Give Monaco a moment to update
    await page.waitForTimeout(300);

    // Find and click the Save button in the dialog footer
    const dialogSaveButton = dialog.getByRole("button", { name: /save/i });
    await expect(dialogSaveButton).toBeVisible();
    await dialogSaveButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Wait for value to propagate to form
    await page.waitForTimeout(300);

    // Verify the inline textarea now shows the dialog-saved value
    await expect(textarea).toHaveValue(dialogTestValue);

    // The panel Save button should be enabled (form is dirty from dialog change)
    const panelSaveButton = configPanel.getByRole("button", { name: /save/i });
    await expect(panelSaveButton).toBeEnabled();

    // Save via panel button
    await panelSaveButton.click();
    await expect(panelSaveButton).toBeDisabled({ timeout: 5000 });

    // Close and reopen to verify persistence
    const closeButton = configPanel.locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();
    await page.waitForTimeout(300);

    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Verify persisted value
    const savedTextarea = page.getByTestId("workflow-node-config").locator("textarea").first();
    await expect(savedTextarea).toHaveValue(dialogTestValue);
  });

  test("Cancel in System Prompt dialog discards changes", async ({ page }) => {
    await useDemoAgent(page);

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");
    const textarea = configPanel.locator("textarea").first();

    // Add enough text to show expand button
    const originalText = "Original system prompt text. ".repeat(5);
    await textarea.fill(originalText);

    // Save this initial state first
    const panelSaveButton = configPanel.getByRole("button", { name: /save/i });
    await expect(panelSaveButton).toBeEnabled({ timeout: 3000 });
    await panelSaveButton.click();
    await expect(panelSaveButton).toBeDisabled({ timeout: 5000 });

    // Now expand and make changes
    const expandButton = configPanel.locator('button[title="Expand to fullscreen"]');
    await expandButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Make changes in dialog
    const dialogContent = dialog.locator(".monaco-editor, textarea").first();
    await dialogContent.click();
    await page.keyboard.press("Meta+a");
    await page.keyboard.type("This change should be discarded");

    // Click Cancel in dialog
    const dialogCancelButton = dialog.getByRole("button", { name: /cancel/i });
    await dialogCancelButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Inline textarea should still have original value
    await expect(textarea).toHaveValue(originalText);
  });
});
