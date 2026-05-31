import { expect, test } from "@playwright/test";

import {
  clickNodeByLabel,
  enterEditMode,
  getCodeMirrorContent,
  typeInCodeMirror,
} from "./helpers/e2e-helpers";

test.describe("Message Node Editor @node-editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    // Wait for content resolution - node labels are resolved from $content: references
    // "Conversion Offer" is a message node with buttons that has stable test data
    await expect(page.locator('[aria-label*="Conversion Offer"]')).toBeVisible({ timeout: 10000 });
    await enterEditMode(page);
  });

  test("can add and remove buttons", async ({ page }) => {
    // Use "Conversion Offer" which has buttons and stable test data
    await clickNodeByLabel(page, "Conversion Offer");

    // Count initial buttons
    const buttonInputs = page.getByTestId("node-editor").locator('input[placeholder="Button label..."]');
    const initialCount = await buttonInputs.count();

    // Click Add button - use first() to get the main Buttons section (not follow-up steps)
    const addButton = page.getByTestId("node-editor").getByRole("button", { name: /add/i }).first();
    await addButton.click();

    // Verify button count increased
    await expect(buttonInputs).toHaveCount(initialCount + 1);

    // Find and click delete button on the last button row
    // Note: Button rows use "flex items-start gap-2" class (not items-center)
    const buttonRows = page.getByTestId("node-editor").locator('.flex.items-start.gap-2:has(input[placeholder="Button label..."])');
    const lastDeleteBtn = buttonRows.last().locator("button").last();
    await lastDeleteBtn.click();

    // Verify button count decreased back
    await expect(buttonInputs).toHaveCount(initialCount);
  });

  test("text response type shows storeResponseAs in Advanced", async ({ page }) => {
    // Click on "Quick Feedback" which has responseType: "text"
    await clickNodeByLabel(page, "Quick Feedback");

    // Expand Advanced section
    const advancedTrigger = page.getByTestId("node-editor").getByText("Advanced");
    await advancedTrigger.click();

    // Verify storeResponseAs field is visible
    await expect(page.getByLabel(/store response as/i)).toBeVisible();
  });

  test("buttons not shown for auto response type", async ({ page }) => {
    // Click on "Basic Tips" which has responseType: "auto"
    await clickNodeByLabel(page, "Basic Tips");

    // Buttons section should NOT be visible for auto type
    const buttonsLabel = page.getByTestId("node-editor").getByText("Buttons", { exact: true });
    await expect(buttonsLabel).not.toBeVisible();
  });
});

test.describe("Wait Node Editor @node-editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await enterEditMode(page);
  });

  test("duration inputs are visible and editable", async ({ page }) => {
    await clickNodeByLabel(page, "Setup Period");

    // Verify duration inputs using ID patterns (durationDays, durationHours, etc.)
    const daysInput = page.getByTestId("node-editor").locator('[id^="durationDays"]');
    const hoursInput = page.getByTestId("node-editor").locator('[id^="durationHours"]');
    const minInput = page.getByTestId("node-editor").locator('[id^="durationMinutes"]');
    const secInput = page.getByTestId("node-editor").locator('[id^="durationSeconds"]');

    await expect(daysInput).toBeVisible();
    await expect(hoursInput).toBeVisible();
    await expect(minInput).toBeVisible();
    await expect(secInput).toBeVisible();

    // Edit days value
    await daysInput.fill("2");
    await expect(daysInput).toHaveValue("2");
  });

  test("metadata section is collapsible", async ({ page }) => {
    await clickNodeByLabel(page, "Setup Period");

    // Expand Metadata section (use button role for the trigger)
    const metadataTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Metadata" });
    await metadataTrigger.click();

    // Wait for collapsible animation
    await page.waitForTimeout(300);

    // Verify tags label and notes field appear (Tags is text, Notes is linked to textarea)
    await expect(page.getByTestId("node-editor").getByText("Tags", { exact: true })).toBeVisible();
    await expect(page.getByTestId("node-editor").locator('[id^="notes"]')).toBeVisible();
  });
});

test.describe("Condition Node Editor @node-editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await enterEditMode(page);
  });

  test("can add new rule with Add Rule button", async ({ page }) => {
    await clickNodeByLabel(page, "Check Plan Type");

    // Count initial rules
    const ruleCards = page.getByTestId("node-editor").locator(".rounded-lg.border");
    const initialCount = await ruleCards.count();

    // Click Add Rule button (AND variant in the Condition Rules section)
    const addAndButton = page.getByTestId("node-editor").getByRole("button", { name: /\+ and/i });
    await expect(addAndButton).toBeVisible();
    await addAndButton.click();

    // Verify rule count increased
    await expect(ruleCards).toHaveCount(initialCount + 1);
  });

  test("AND/OR toggle changes operator between rules", async ({ page }) => {
    await clickNodeByLabel(page, "Check Plan Type");

    const editor = page.getByTestId("node-editor");

    // First add a rule so we can see the operator badge between rules
    // (plan-check starts with only 1 rule, need 2+ to see AND/OR badge)
    const addAndButton = editor.getByRole("button", { name: /\+ and/i });
    await addAndButton.click();

    // Operator badge between rules should show "and" (rulesOperator is "and")
    const operatorBadge = editor.locator(".flex.justify-center.my-2 .bg-muted").first();
    await expect(operatorBadge).toBeVisible();
    await expect(operatorBadge).toHaveText(/and/i);

    // Click "+ OR" to add another rule and change the global operator to OR
    const addOrButton = editor.getByRole("button", { name: /\+ or/i });
    await addOrButton.click();

    // Verify operator badge text changed to OR
    await expect(operatorBadge).toHaveText(/or/i);
  });
});

test.describe("Condition Node Expression Mode @node-editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await enterEditMode(page);
  });

  test("can type expression and see validation status", async ({ page }) => {
    await clickNodeByLabel(page, "Check Plan Type");

    const editor = page.getByTestId("node-editor");

    // Switch to expression mode
    await editor.getByRole("tab", { name: /expression/i }).click();

    // Type a valid expression using CodeMirror
    await typeInCodeMirror(page, "user.score > 50", editor);

    // Wait for validation
    await page.waitForTimeout(300);

    // Should show "Valid" status
    await expect(editor.getByText("Valid")).toBeVisible();
  });

  test("shows validation error for invalid expression", async ({ page }) => {
    await clickNodeByLabel(page, "Check Plan Type");

    const editor = page.getByTestId("node-editor");

    // Switch to expression mode
    await editor.getByRole("tab", { name: /expression/i }).click();

    // Type an invalid expression (unmatched parenthesis)
    await typeInCodeMirror(page, "user.score > (50", editor);

    // Wait for validation
    await page.waitForTimeout(300);

    // Should show error about unmatched parenthesis
    await expect(editor.getByText(/unmatched/i)).toBeVisible();
  });

  test("expression is saved and persists after closing and reopening editor", async ({ page }) => {
    await clickNodeByLabel(page, "Check Plan Type");

    const editor = page.getByTestId("node-editor");

    // Switch to expression mode
    await editor.getByRole("tab", { name: /expression/i }).click();

    // Type an expression
    const testExpression = "user.premium === true";
    await typeInCodeMirror(page, testExpression, editor);

    // Wait for validation and auto-save
    await page.waitForTimeout(500);

    // Close the editor by clicking outside (on the canvas)
    await page.locator(".react-flow__pane").click();

    // Wait for editor to close
    await expect(editor).not.toBeVisible();

    // Wait for auto-save to complete and propagate to store
    // Auto-save is async and needs time to update the node data
    await page.waitForTimeout(200);

    // Re-open the same node
    await clickNodeByLabel(page, "Check Plan Type");
    await expect(editor).toBeVisible();

    // Switch to expression mode
    await editor.getByRole("tab", { name: /expression/i }).click();

    // Verify the expression was saved and is still there
    const cmContent = getCodeMirrorContent(page, editor);
    await expect(cmContent).toHaveText(testExpression);
  });
});

test.describe("Webhook Node Editor @node-editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await enterEditMode(page);
  });

  test("can type JSON in mock body editor", async ({ page }) => {
    await clickNodeByLabel(page, "Sync to CRM");

    const editor = page.getByTestId("node-editor");

    // Scroll to and expand Mock Response section
    await editor.locator("text=Mock Response").scrollIntoViewIfNeeded();
    const mockTrigger = editor.getByRole("button", { name: /mock response/i });
    await mockTrigger.click();
    await page.waitForTimeout(500);

    // The seed data has mockEnabled: true, so the JsonEditor is already visible
    const mockSwitch = editor.locator('[id^="mockEnabled"]');
    await expect(mockSwitch).toBeChecked();

    // Type JSON in the CodeMirror editor
    const testJson = '{"status": "ok", "userId": 123}';
    await typeInCodeMirror(page, testJson, editor);

    // Verify JSON is visible in editor
    const cmContent = getCodeMirrorContent(page, editor);
    await expect(cmContent).toContainText("status");
    await expect(cmContent).toContainText("userId");
  });
});
