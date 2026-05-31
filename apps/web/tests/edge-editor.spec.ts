/**
 * Edge Editor E2E Tests
 *
 * Tests for the edge editor panel which allows editing:
 * - Edge label
 * - Guard conditions (expression, variable, tag)
 * - Fallback edge toggle
 *
 * Note: Edge type is read-only and displayed but not editable.
 */

import { expect, test } from "@playwright/test";

import { clickFirstEditableEdge, enterEditMode, getCodeMirrorContent, typeInCodeMirror } from "./helpers/e2e-helpers";

test.describe("Edge Editor @edge-editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await enterEditMode(page);
  });

  test("guard type selector switches between types", async ({ page }) => {
    await clickFirstEditableEdge(page);

    // Add guard condition
    await page.getByRole("button", { name: /add guard condition/i }).click();

    // Find the guard type selector
    const guardTypeSelect = page.getByTestId("edge-editor").locator('[role="combobox"]').first();
    await expect(guardTypeSelect).toBeVisible();

    // Click to open dropdown and select Variable type
    await guardTypeSelect.click();
    await page.getByRole("option", { name: /variable/i }).click();

    // Verify Variable guard UI appears (has key, operator, value fields)
    await expect(page.getByText("Operator", { exact: true })).toBeVisible();
    await expect(page.getByText("Value", { exact: true })).toBeVisible();

    // Switch to Tag type
    await guardTypeSelect.click();
    await page.getByRole("option", { name: /tag/i }).click();

    // Verify Tag guard UI appears
    await expect(page.getByPlaceholder(/vip/i)).toBeVisible();
  });

  test("can remove guard condition", async ({ page }) => {
    await clickFirstEditableEdge(page);

    // Add guard condition
    await page.getByRole("button", { name: /add guard condition/i }).click();

    // Verify guard is added
    await expect(page.getByTestId("edge-editor").locator('[role="combobox"]').first()).toBeVisible();

    // Find and click the remove button (trash icon in the guard section - not the Delete edge button)
    // The guard section has a smaller trash button in the header row
    const removeBtn = page.getByTestId("edge-editor").getByTestId("guard-remove-button");
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Verify Add Guard button is back (guard was removed)
    await expect(page.getByRole("button", { name: /add guard condition/i })).toBeVisible();
  });

  test("fallback toggle works", async ({ page }) => {
    await clickFirstEditableEdge(page);

    // Find fallback toggle section
    await expect(page.getByText("Fallback Edge")).toBeVisible();

    // Find the switch
    const fallbackSwitch = page.getByTestId("edge-editor").getByRole("switch");
    await expect(fallbackSwitch).toBeVisible();

    // Get initial state
    const initialState = await fallbackSwitch.getAttribute("aria-checked");

    // Toggle it
    await fallbackSwitch.click();

    // Verify state changed
    const newState = await fallbackSwitch.getAttribute("aria-checked");
    expect(newState).not.toBe(initialState);
  });

  test("close (X) button closes editor with auto-save", async ({ page }) => {
    await clickFirstEditableEdge(page);
    const editor = page.getByTestId("edge-editor");
    await expect(editor).toBeVisible();

    // Click the X button in the header (auto-saves on close)
    const closeBtn = editor.locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeBtn.click();

    // Verify editor closed
    await expect(editor).not.toBeVisible();
  });

  test("auto-saves changes on close", async ({ page }) => {
    await clickFirstEditableEdge(page);
    const editor = page.getByTestId("edge-editor");

    // Add a guard condition
    await page.getByRole("button", { name: /add guard condition/i }).click();

    // Enter an expression using CodeMirror
    await typeInCodeMirror(page, "user.score > 50", editor);

    // Close via X button (auto-saves)
    const closeBtn = editor.locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeBtn.click();

    // Verify editor closed (indicates save succeeded - validation would keep it open)
    await expect(editor).not.toBeVisible({ timeout: 5000 });

    // Re-open to verify changes persisted
    await clickFirstEditableEdge(page);
    const cmContent = getCodeMirrorContent(page, page.getByTestId("edge-editor"));
    await expect(cmContent).toContainText("user.score > 50");
  });
});
