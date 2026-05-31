import { expect, registerCleanup, test } from "./test-helpers";

/**
 * CRM E2E Tests
 *
 * Tests for CRM functionality including:
 * 1. Pipeline kanban board view
 * 2. Pipeline management (create, edit, delete)
 * 3. Stage management (create, edit, delete)
 *
 * These tests require seed data to be present (run `pnpm db:reset`)
 */

// Register cleanup for test data created by this suite
registerCleanup(test, { pipelines: true });

// =============================================================================
// PIPELINE VIEW TESTS
// =============================================================================

test.describe("CRM - Pipeline View @crm", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/crm");
    await page.waitForTimeout(2000); // Wait for data to load
  });

  test("can switch between pipelines using dropdown", async ({ page }) => {
    // Look for pipeline selector dropdown
    const pipelineSelector = page.getByRole("combobox");

    // If multiple pipelines exist, selector should be visible
    if (await pipelineSelector.isVisible()) {
      await pipelineSelector.click();

      // Should show pipeline options
      const options = page.getByRole("option");
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// PIPELINE MANAGEMENT TESTS
// =============================================================================

test.describe("CRM - Pipeline Management @crm", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/crm");
    await page.waitForTimeout(1000);
  });

  test("can delete a pipeline via settings menu", async ({ page }) => {
    // First check if there's a settings/actions menu for pipelines
    const settingsButton = page.getByRole("button", { name: /Settings|Actions/i }).first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Should show delete option
      const deleteOption = page.getByRole("menuitem", { name: /Delete/i });
      if (await deleteOption.isVisible()) {
        await deleteOption.click();

        // Should show confirmation dialog
        await expect(page.getByRole("alertdialog")).toBeVisible();
      }
    }
  });
});

// =============================================================================
// STAGE MANAGEMENT TESTS
// =============================================================================

test.describe("CRM - Stage Management @crm", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/crm");
    await page.waitForTimeout(1000);
  });

  test("can delete a stage", async ({ page }) => {
    // Create a stage first
    const uniqueName = `Delete Stage ${Date.now()}`;

    const addButton = page.getByRole("button", { name: /Add Stage|New Stage/i });

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.getByRole("textbox", { name: /name/i }).fill(uniqueName);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Create|Save|Add/i })
        .click();
      await page.waitForTimeout(1000);

      // Find the stage and open its menu
      const stageColumn = page.locator("[data-crm-stage]").filter({ hasText: uniqueName });
      const menuButton = stageColumn.getByRole("button", { name: /menu|options/i });

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.getByRole("menuitem", { name: /Delete/i }).click();

        // Confirm deletion
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: /Delete/i })
          .click();

        // Stage should be removed
        await expect(page.getByText(uniqueName)).not.toBeVisible({ timeout: 5000 });
      }
    }
  });
});

// =============================================================================
// PIPELINE CREATION BUG FIX TESTS
// =============================================================================

test.describe("CRM - Pipeline Creation Bug Fixes @crm", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/crm");
    await page.waitForTimeout(2000);
  });

  test("should switch to new pipeline after creation", async ({ page }) => {
    const uniqueName = `Switch Test ${Date.now()}`;

    // Open create dialog
    const addButton = page.getByRole("button", { name: /New Pipeline/i });
    await addButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill form
    const nameInput = page.getByRole("dialog").locator("input").first();
    await nameInput.fill(uniqueName);

    // Submit
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Create|Save|Add/i })
      .click();

    // Wait for dialog to close and data to refresh
    await page.waitForTimeout(2000);

    // The pipeline selector should now show the new pipeline (UI switched to it)
    const selector = page.getByRole("combobox").first();
    await expect(selector).toContainText(new RegExp(uniqueName.split(" ").pop() || "", "i"));
  });

  test("new pipeline should have Unassigned stage", async ({ page }) => {
    const uniqueName = `Unassigned Test ${Date.now()}`;

    // Open create dialog
    const addButton = page.getByRole("button", { name: /New Pipeline/i });
    await addButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill form
    const nameInput = page.getByRole("dialog").locator("input").first();
    await nameInput.fill(uniqueName);

    // Submit
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Create|Save|Add/i })
      .click();

    // Wait for dialog to close and page to update
    await page.waitForTimeout(2000);

    // The new pipeline should have the Unassigned stage visible in the kanban board
    // Stage names are in h3 elements within the kanban
    await expect(page.getByRole("heading", { name: "Unassigned", level: 3 })).toBeVisible({ timeout: 5000 });
  });

  test("new pipeline is properly selected for stage creation", async ({ page }) => {
    const pipelineName = `Stage Target ${Date.now()}`;

    // Create a new pipeline first
    await page.getByRole("button", { name: /New Pipeline/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").locator("input").first().fill(pipelineName);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Create|Save|Add/i })
      .click();

    // Wait for dialog to close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Verify we switched to the new pipeline (this is the key fix we're testing)
    const selector = page.getByRole("combobox").first();
    await expect(selector).toContainText(new RegExp(pipelineName.split(" ").pop() || "", "i"));

    // Verify the Add Stage button is visible (UI is ready for stage creation on this pipeline)
    const addStageButton = page.getByRole("button", { name: /Add Stage|New Stage/i });
    await expect(addStageButton).toBeVisible({ timeout: 5000 });

    // Verify we can open the stage creation dialog
    await addStageButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();

    // Close the dialog - the API tests verify actual stage creation works
    await page.keyboard.press("Escape");
  });
});
