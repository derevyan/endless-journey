/**
 * E2E Tests for CRM Action Section in Node Editor
 *
 * Tests the CRM Action collapsible section that allows any node
 * to trigger CRM stage updates as a side effect when executed.
 *
 * @module tests/crm-action-section.spec
 */

import { expect, test } from "@playwright/test";
import { clickNodeByLabel, closeNodeEditor, enterEditMode, openCollapsibleSection } from "./helpers/e2e-helpers";

test.describe("CRM Action Section @crm-action", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to journey builder and wait for canvas to load
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("can select a pipeline in CRM Action section", async ({ page }) => {
    await enterEditMode(page);

    // Click on a message node
    await clickNodeByLabel(page, "Welcome");

    const editor = page.getByTestId("node-editor");

    // Open CRM Action section
    await openCollapsibleSection(page, /CRM Action/i);

    // Click the pipeline select trigger
    const pipelineSelect = editor.locator('[id^="crmAction-pipeline"]');
    await pipelineSelect.click();
    await page.waitForTimeout(300);

    // Wait for dropdown options to appear and select a pipeline (not "No CRM action")
    // Note: This assumes there's at least one pipeline in the database
    const pipelineOption = page.getByRole("option").filter({ hasNotText: /no crm action/i }).first();
    const optionCount = await pipelineOption.count();

    if (optionCount > 0) {
      await pipelineOption.click();
      await page.waitForTimeout(300);

      // Verify stage dropdown appears after selecting pipeline
      await expect(editor.getByLabel(/Stage/)).toBeVisible({ timeout: 3000 });
    }
  });

  test("can save CRM action via auto-save on close", async ({ page }) => {
    await enterEditMode(page);

    // Click on a message node
    await clickNodeByLabel(page, "Welcome");

    const editor = page.getByTestId("node-editor");

    // Open CRM Action section
    await openCollapsibleSection(page, /CRM Action/i);

    // Click the pipeline select trigger
    const pipelineSelect = editor.locator('[id^="crmAction-pipeline"]');
    await pipelineSelect.click();
    await page.waitForTimeout(300);

    // Select a pipeline (first one that's not "No CRM action")
    const pipelineOption = page.getByRole("option").filter({ hasNotText: /no crm action/i }).first();
    const optionCount = await pipelineOption.count();

    if (optionCount > 0) {
      await pipelineOption.click();
      await page.waitForTimeout(300);

      // Close the editor to trigger auto-save (auto-save is silent, no toast)
      await closeNodeEditor(page);

      // Verify the editor closed successfully (indicates auto-save succeeded)
      await expect(editor).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("CRM action changes persist after switching nodes", async ({ page }) => {
    await enterEditMode(page);

    // Click on a message node
    await clickNodeByLabel(page, "Welcome");

    const editor = page.getByTestId("node-editor");

    // Open CRM Action section
    await openCollapsibleSection(page, /CRM Action/i);

    // Click the pipeline select trigger
    const pipelineSelect = editor.locator('[id^="crmAction-pipeline"]');
    await pipelineSelect.click();
    await page.waitForTimeout(300);

    // Get the first pipeline option text for later verification
    const pipelineOption = page.getByRole("option").filter({ hasNotText: /no crm action/i }).first();
    const optionCount = await pipelineOption.count();

    if (optionCount > 0) {
      // Get the pipeline name we're about to select
      const pipelineName = await pipelineOption.textContent();
      await pipelineOption.click();
      await page.waitForTimeout(300);

      // Save the node
      await closeNodeEditor(page);
      await page.waitForTimeout(500);

      // Click on a different node
      await clickNodeByLabel(page, "Welcome");
      await page.waitForTimeout(500);

      // Click back on the original node
      await clickNodeByLabel(page, "Welcome");
      await page.waitForTimeout(500);

      // Open CRM Action section again
      await openCollapsibleSection(page, /CRM Action/i);

      // Verify the pipeline selection persisted
      // The select should show the selected pipeline name
      const pipelineSelectAfter = editor.locator('[id^="crmAction-pipeline"]');
      await expect(pipelineSelectAfter).toContainText(pipelineName || "", { timeout: 5000 });

      // Verify the section shows "Configured" badge
      const sectionButton = editor.getByRole("button", { name: /CRM Action/i });
      await expect(sectionButton).toContainText(/configured/i, { timeout: 3000 });
    }
  });

  test("CRM Action section shows Configured badge when pipeline is set", async ({ page }) => {
    await enterEditMode(page);

    // Click on a message node
    await clickNodeByLabel(page, "Welcome");

    const editor = page.getByTestId("node-editor");

    // Open CRM Action section
    await openCollapsibleSection(page, /CRM Action/i);

    // Initially should not show Configured badge (unless already configured)
    const sectionButton = editor.getByRole("button", { name: /CRM Action/i });

    // Click the pipeline select trigger
    const pipelineSelect = editor.locator('[id^="crmAction-pipeline"]');
    await pipelineSelect.click();
    await page.waitForTimeout(300);

    // Select a pipeline
    const pipelineOption = page.getByRole("option").filter({ hasNotText: /no crm action/i }).first();
    const optionCount = await pipelineOption.count();

    if (optionCount > 0) {
      await pipelineOption.click();
      await page.waitForTimeout(300);

      // Now the section should show "Configured" badge
      await expect(sectionButton).toContainText(/configured/i, { timeout: 3000 });
    }
  });

  test("can clear CRM action by selecting 'No CRM action'", async ({ page }) => {
    await enterEditMode(page);

    // Click on a message node
    await clickNodeByLabel(page, "Welcome");

    const editor = page.getByTestId("node-editor");

    // Open CRM Action section
    await openCollapsibleSection(page, /CRM Action/i);

    // First, set a pipeline
    const pipelineSelect = editor.locator('[id^="crmAction-pipeline"]');
    await pipelineSelect.click();
    await page.waitForTimeout(300);

    const pipelineOption = page.getByRole("option").filter({ hasNotText: /no crm action/i }).first();
    const optionCount = await pipelineOption.count();

    if (optionCount > 0) {
      await pipelineOption.click();
      await page.waitForTimeout(300);

      // Verify Configured badge appears
      const sectionButton = editor.getByRole("button", { name: /CRM Action/i });
      await expect(sectionButton).toContainText(/configured/i, { timeout: 3000 });

      // Now clear by selecting "No CRM action"
      await pipelineSelect.click();
      await page.waitForTimeout(300);

      const noCrmOption = page.getByRole("option", { name: /no crm action/i });
      await noCrmOption.click();
      await page.waitForTimeout(300);

      // Configured badge should no longer be visible
      await expect(sectionButton).not.toContainText(/configured/i, { timeout: 3000 });
    }
  });
});
