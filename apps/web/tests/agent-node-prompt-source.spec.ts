/**
 * Agent Node - System Prompt Source E2E Tests
 *
 * Tests for the Inline/Repository toggle in Agent node configuration.
 * Verifies that switching between modes preserves data in both directions.
 *
 * @module tests/agent-node-prompt-source.spec
 */

import { expect, test } from "@playwright/test";
import {
  createNewAgent,
  goToAgentsList,
  clickAgentNode,
  waitForNodeConfigPanel,
} from "./helpers/agent-workflow-helpers";

test.describe("Agent Node System Prompt Source @agent-prompt-source", () => {
  test.beforeEach(async ({ page }) => {
    await goToAgentsList(page);
  });

  test("preserves inline text when switching to repository and back", async ({ page }) => {
    // Create a new agent for isolated testing
    await createNewAgent(page, {
      name: "Prompt Source Test",
      description: "Testing inline/repository toggle",
    });

    // Click on the agent node to open config
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Find the System Prompt section
    const configPanel = page.getByTestId("workflow-node-config");

    // Verify we're in Inline mode by default (tab should be selected)
    const inlineTab = configPanel.getByRole("tab", { name: /inline/i });
    await expect(inlineTab).toHaveAttribute("data-state", "active");

    // Enter test text in the inline textarea
    const testPromptText = `You are a test assistant created at ${Date.now()}. Be helpful.`;
    const textarea = configPanel.locator("textarea").first();
    await textarea.fill(testPromptText);

    // Wait for auto-save debounce
    await page.waitForTimeout(500);

    // Click Repository tab
    const repositoryTab = configPanel.getByRole("tab", { name: /repository/i });
    await repositoryTab.click();

    // Verify Repository tab is now active
    await expect(repositoryTab).toHaveAttribute("data-state", "active");

    // Wait for auto-save
    await page.waitForTimeout(500);

    // Switch back to Inline tab
    await inlineTab.click();
    await expect(inlineTab).toHaveAttribute("data-state", "active");

    // Verify the original text is preserved
    await expect(textarea).toHaveValue(testPromptText);
  });

  test("preserves repository selection when switching to inline and back", async ({ page }) => {
    // Create a new agent
    await createNewAgent(page, {
      name: "Repository Preserve Test",
      description: "Testing repository selection preservation",
    });

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");

    // Switch to Repository tab
    const repositoryTab = configPanel.getByRole("tab", { name: /repository/i });
    await repositoryTab.click();
    await expect(repositoryTab).toHaveAttribute("data-state", "active");

    // Find the prompt selector dropdown
    const promptSelector = configPanel.locator('[id*="prompt-selector-prompt"]');

    // Check if there are any prompts available
    const selectTrigger = promptSelector.first();
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click();

      // Wait for dropdown to open
      const selectContent = page.locator('[role="listbox"]');
      await expect(selectContent).toBeVisible({ timeout: 3000 });

      // Check if there are prompt options (not just "No prompts available")
      const promptOptions = selectContent.locator('[role="option"]');
      const optionCount = await promptOptions.count();

      if (optionCount > 0) {
        // Select the first prompt
        const firstPrompt = promptOptions.first();
        const promptName = await firstPrompt.textContent();
        await firstPrompt.click();

        // Wait for selection and auto-save
        await page.waitForTimeout(500);

        // Switch to Inline tab
        const inlineTab = configPanel.getByRole("tab", { name: /inline/i });
        await inlineTab.click();
        await expect(inlineTab).toHaveAttribute("data-state", "active");

        // Wait for auto-save
        await page.waitForTimeout(500);

        // Switch back to Repository tab
        await repositoryTab.click();
        await expect(repositoryTab).toHaveAttribute("data-state", "active");

        // Verify the prompt is still selected
        await expect(selectTrigger).toContainText(promptName?.split("\n")[0] ?? "");
      }
    }

    // Test passes if we can switch tabs without errors (even if no prompts exist)
    const inlineTab = configPanel.getByRole("tab", { name: /inline/i });
    await inlineTab.click();
    await expect(inlineTab).toHaveAttribute("data-state", "active");
  });

  test("tab selection persists after closing and reopening config panel", async ({ page }) => {
    // Create a new agent
    await createNewAgent(page, {
      name: "Tab Persist Test",
      description: "Testing tab selection persistence",
    });

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");

    // Switch to Repository tab
    const repositoryTab = configPanel.getByRole("tab", { name: /repository/i });
    await repositoryTab.click();
    await expect(repositoryTab).toHaveAttribute("data-state", "active");

    // Wait for auto-save
    await page.waitForTimeout(500);

    // Close the config panel by clicking elsewhere on canvas
    const canvas = page.getByTestId("workflow-canvas");
    await canvas.click({ position: { x: 100, y: 100 } });

    // Wait for panel to close
    await page.waitForTimeout(300);

    // Re-open the agent node config
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Verify Repository tab is still active (persisted)
    const repositoryTabAfter = page.getByTestId("workflow-node-config").getByRole("tab", { name: /repository/i });
    await expect(repositoryTabAfter).toHaveAttribute("data-state", "active");
  });

  test("can enter and preserve text in inline mode without data loss", async ({ page }) => {
    // Create a new agent
    await createNewAgent(page, {
      name: "Inline Edit Test",
      description: "Testing inline text editing",
    });

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");
    const textarea = configPanel.locator("textarea").first();

    // Type text character by character (simulates real user input)
    const testText = "You are a helpful assistant.";
    await textarea.clear();
    await textarea.pressSequentially(testText, { delay: 50 });

    // Wait for auto-save debounce
    await page.waitForTimeout(500);

    // Verify text is there
    await expect(textarea).toHaveValue(testText);

    // Click elsewhere to trigger save
    const canvas = page.getByTestId("workflow-canvas");
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(300);

    // Re-open config
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    // Verify text persisted
    const textareaAfter = page.getByTestId("workflow-node-config").locator("textarea").first();
    await expect(textareaAfter).toHaveValue(testText);
  });

  test("switching tabs rapidly does not cause data loss", async ({ page }) => {
    // Create a new agent
    await createNewAgent(page, {
      name: "Rapid Switch Test",
      description: "Testing rapid tab switching",
    });

    // Click on agent node
    await clickAgentNode(page);
    await waitForNodeConfigPanel(page);

    const configPanel = page.getByTestId("workflow-node-config");
    const textarea = configPanel.locator("textarea").first();
    const inlineTab = configPanel.getByRole("tab", { name: /inline/i });
    const repositoryTab = configPanel.getByRole("tab", { name: /repository/i });

    // Enter test text
    const testText = `Rapid test ${Date.now()}`;
    await textarea.fill(testText);

    // Rapidly switch tabs multiple times
    await repositoryTab.click();
    await inlineTab.click();
    await repositoryTab.click();
    await inlineTab.click();
    await repositoryTab.click();
    await inlineTab.click();

    // Wait for any pending saves
    await page.waitForTimeout(600);

    // Verify text is still preserved
    await expect(textarea).toHaveValue(testText);
  });
});
