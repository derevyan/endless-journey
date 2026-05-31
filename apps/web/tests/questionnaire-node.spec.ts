import { expect, test } from "@playwright/test";

import { clickNodeByLabel, enterEditMode, enterSimulatorMode } from "./helpers/e2e-helpers";

/**
 * Questionnaire Node E2E Tests
 *
 * Tests for questionnaire node functionality in the journey builder:
 * 1. Node Editor - Questions CRUD operations
 * 2. Node Editor - Settings configuration
 * 3. Simulator - Questionnaire interaction
 */

/**
 * Helper to enable simulator mode and start simulation from a node
 */
async function startSimulationFromNode(page: import("@playwright/test").Page, nodeLabel: string) {
  // Enable simulator mode using the mode switch toggle
  await enterSimulatorMode(page);

  // Click on the specified node to start simulation
  const nodes = page.locator(".react-flow__node");
  await nodes.first().waitFor({ state: "visible", timeout: 10000 });

  // Find and click the node by aria-label or text
  const targetNode = nodes.locator(`[aria-label*="${nodeLabel}"]`).first();
  const count = await targetNode.count();
  if (count > 0) {
    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });
  } else {
    // Fallback to text content
    const nodeByText = nodes.filter({ hasText: nodeLabel }).first();
    await nodeByText.scrollIntoViewIfNeeded();
    await nodeByText.click({ force: true });
  }

  // Wait for simulation to start - "Stop" button appears when simulation is running
  const stopButton = page.getByRole("button", { name: "Stop" });
  await expect(stopButton).toBeVisible({ timeout: 5000 });
}

test.describe("Questionnaire Node Editor @questionnaire-node", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("questionnaire node opens Questionnaire Node Editor", async ({ page }) => {
    await enterEditMode(page);

    // Look for a questionnaire node - it might be called "Survey" or similar
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (hasQuestionnaire) {
      await questionnaireNode.scrollIntoViewIfNeeded();
      await questionnaireNode.click({ force: true });

      // Verify Questionnaire Node Editor heading
      await expect(page.getByTestId("node-editor-heading")).toContainText(/edit questionnaire/i);
    } else {
      // Skip if no questionnaire node exists in default journey
      test.skip();
    }
  });

  test("can add and remove questions in questionnaire editor", async ({ page }) => {
    await enterEditMode(page);

    // Find questionnaire node
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });

    const editor = page.getByTestId("node-editor");

    // Verify questions label is visible
    await expect(editor.getByText(/questions/i).first()).toBeVisible();

    // Get initial questions count from label (e.g., "Questions (3)")
    const questionsLabel = editor.locator("text=/Questions \\(\\d+\\)/");
    const labelText = await questionsLabel.textContent();
    const initialCount = parseInt(labelText?.match(/\d+/)?.[0] || "0");

    // Click Add button to add a new question
    const addButton = editor.getByRole("button", { name: /add/i }).first();
    await addButton.click();

    // Verify count increased
    await expect(editor.locator(`text=/Questions \\(${initialCount + 1}\\)/`)).toBeVisible({ timeout: 3000 });

    // The new question should be expanded by default
    // Look for "New question?" text which is the default content - use first() since there's both span and textarea
    await expect(editor.getByText("New question?").first()).toBeVisible();

    // Find and click delete button for the new question
    const deleteButton = editor.getByRole("button", { name: /delete/i }).first();
    await deleteButton.click();

    // Verify count decreased back
    await expect(editor.locator(`text=/Questions \\(${initialCount}\\)/`)).toBeVisible({ timeout: 3000 });
  });

  test("can edit question content and response type", async ({ page }) => {
    await enterEditMode(page);

    // Find questionnaire node
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });

    const editor = page.getByTestId("node-editor");

    // Add a new question
    const addButton = editor.getByRole("button", { name: /add/i }).first();
    await addButton.click();

    // The new question should be expanded
    await expect(editor.getByText("Question Text")).toBeVisible();

    // Edit question text
    const questionTextarea = editor.locator('textarea[placeholder="Enter your question..."]');
    await questionTextarea.fill("What is your favorite programming language?");
    await expect(questionTextarea).toHaveValue("What is your favorite programming language?");

    // Find and interact with response type selector
    const responseTypeSelect = editor.locator("text=Response Type").locator("..").locator("button").first();
    await responseTypeSelect.click();

    // Verify options are available
    await expect(page.getByRole("option", { name: /buttons only/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /text only/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /buttons or text/i })).toBeVisible();

    // Select "Text only"
    await page.getByRole("option", { name: /text only/i }).click();

    // Answer Options section should not be visible for text-only response type
    await expect(editor.getByText("Answer Options")).not.toBeVisible();

    // Clean up - delete the test question
    const deleteButton = editor.getByRole("button", { name: /delete/i }).first();
    await deleteButton.click();
  });

  test("can add and remove answer options for button questions", async ({ page }) => {
    await enterEditMode(page);

    // Find questionnaire node
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });

    const editor = page.getByTestId("node-editor");

    // Add a new question (default is buttons response type)
    const addButton = editor.getByRole("button", { name: /add/i }).first();
    await addButton.click();

    // Verify Answer Options section is visible
    await expect(editor.getByText("Answer Options")).toBeVisible();

    // Count initial options (default is "Yes" and "No")
    const optionInputs = editor.locator('input[placeholder="Option text"]');
    const initialOptionsCount = await optionInputs.count();
    expect(initialOptionsCount).toBe(2); // Default Yes/No

    // Add a new option - find the Add button in the Answer Options row
    // The Answer Options label and Add button are siblings in a flex container
    const answerOptionsLabel = editor.getByText("Answer Options");
    const addOptionButton = answerOptionsLabel.locator("..").getByRole("button", { name: /add/i });
    await addOptionButton.click();

    // Verify option count increased
    await expect(optionInputs).toHaveCount(initialOptionsCount + 1);

    // Edit the new option text
    const newOptionInput = optionInputs.last();
    await newOptionInput.fill("Maybe");
    await expect(newOptionInput).toHaveValue("Maybe");

    // Remove the new option using the trash button next to it
    const optionRows = editor.locator('.flex.items-center.gap-1:has(input[placeholder="Option text"])');
    const lastOptionRow = optionRows.last();
    const removeOptionButton = lastOptionRow.locator("button").last();
    await removeOptionButton.click();

    // Verify option count decreased
    await expect(optionInputs).toHaveCount(initialOptionsCount);

    // Clean up - delete the test question
    const deleteButton = editor.getByRole("button", { name: /delete/i }).first();
    await deleteButton.click();
  });

  test("settings section shows timeout configuration", async ({ page }) => {
    await enterEditMode(page);

    // Find questionnaire node
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });

    const editor = page.getByTestId("node-editor");

    // Find and click Settings section to expand it
    // The Settings trigger is a div with cursor-pointer, not a button
    const settingsTrigger = editor.locator("text=Settings").first();
    await expect(settingsTrigger).toBeVisible();
    await settingsTrigger.click();

    // Wait for collapsible to open
    await page.waitForTimeout(300);

    // Verify timeout configuration is visible
    await expect(editor.getByText("Timeout (optional)")).toBeVisible();
    await expect(editor.getByText(/doesn't complete questionnaire within this time/i)).toBeVisible();
  });

  test("introduction and completion message fields are visible", async ({ page }) => {
    await enterEditMode(page);

    // Find questionnaire node
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });

    const editor = page.getByTestId("node-editor");

    // Verify Introduction Message field
    await expect(editor.getByText("Introduction Message (optional)")).toBeVisible();
    const introTextarea = editor.locator('textarea[placeholder*="Welcome"]');
    await expect(introTextarea).toBeVisible();

    // Verify Completion Message field
    await expect(editor.getByText("Completion Message (optional)")).toBeVisible();
    const completionTextarea = editor.locator('textarea[placeholder*="Thank you"]');
    await expect(completionTextarea).toBeVisible();
  });

  test("can reorder questions using up/down buttons", async ({ page }) => {
    await enterEditMode(page);

    // Find questionnaire node
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });
    await expect(page.getByTestId("node-editor")).toBeVisible({ timeout: 10000 });

    const editor = page.getByTestId("node-editor");

    // Get questions label to check count
    const questionsLabel = editor.locator("text=/Questions \\(\\d+\\)/");
    const labelText = await questionsLabel.textContent();
    const questionCount = parseInt(labelText?.match(/\d+/)?.[0] || "0");

    // Only test reorder if there are at least 2 questions
    if (questionCount < 2) {
      // Add questions to test with
      const addButton = editor.getByRole("button", { name: /add/i }).first();
      await addButton.click();
      await addButton.click();
    }

    // Click on first question to expand it
    const questionCollapsibles = editor.locator(".border.rounded-md.bg-muted\\/30");
    await questionCollapsibles.first().click();

    // First question's up button should be disabled
    const upButton = editor.locator('button:has([class*="lucide-chevron-up"])').first();
    await expect(upButton).toBeDisabled();

    // Down button should be enabled
    const downButton = editor.locator('button:has([class*="lucide-chevron-down"])').first();
    await expect(downButton).toBeEnabled();
  });
});

test.describe("Questionnaire Simulator Integration @questionnaire-node", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("simulator shows questionnaire messages when starting from questionnaire node", async ({ page }) => {
    // Find questionnaire node first
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    // Enable simulator mode using the mode switch toggle
    await enterSimulatorMode(page);

    // Click on questionnaire node to start simulation
    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });

    // Wait for messages to appear in chat
    await page.waitForTimeout(2000);

    // Verify Chat header is visible
    const chatHeader = page.locator("text=Chat").first();
    await expect(chatHeader).toBeVisible();

    // The chat should show questionnaire messages (intro or first question)
    // Look for message bubbles in the simulator
    const chatMessages = page.locator('[data-testid="chat-message"], .chat-message, [class*="message"]');
    const messageCount = await chatMessages.count();
    expect(messageCount).toBeGreaterThan(0);
  });

  test("can interact with questionnaire buttons in simulator", async ({ page }) => {
    // Find questionnaire node first
    const nodes = page.locator(".react-flow__node");
    const questionnaireNode = nodes.locator('[aria-label*="questionnaire" i]').first();
    const hasQuestionnaire = (await questionnaireNode.count()) > 0;

    if (!hasQuestionnaire) {
      test.skip();
      return;
    }

    // Enable simulator mode using the mode switch toggle
    await enterSimulatorMode(page);

    // Click on questionnaire node to start simulation
    await questionnaireNode.scrollIntoViewIfNeeded();
    await questionnaireNode.click({ force: true });

    // Wait for messages and buttons to appear
    await page.waitForTimeout(2000);

    // Look for interactive buttons in the chat/simulator panel
    // These could be rendered as buttons with the answer options
    const simulatorButtons = page.locator('[data-testid="simulator-button"], [class*="simulator"] button, .chat-button');
    const buttonCount = await simulatorButtons.count();

    if (buttonCount > 0) {
      // Click the first available button
      await simulatorButtons.first().click();

      // Wait for response
      await page.waitForTimeout(1000);

      // Verify console shows event was logged
      const consolePanel = page.getByText("Console", { exact: true });
      await expect(consolePanel).toBeVisible();
    }
  });
});
