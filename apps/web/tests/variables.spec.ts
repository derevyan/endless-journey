import { expect, registerCleanup, test } from "./test-helpers";
import { clickNodeByLabel, enterEditMode } from "./helpers/e2e-helpers";

/**
 * Variables E2E Tests
 *
 * Tests the journey variables functionality:
 * 1. Variables section in node editors (add/remove operations for user, journey, and global scopes)
 * 2. Variables settings page (global and journey variables management)
 */

// Register cleanup for test data
registerCleanup(test, { variables: true });

/**
 * Helper function to expand Variables section in node editor
 */
async function expandVariablesSection(page: import("@playwright/test").Page) {
  // Use exact match to avoid matching "User Variables", "Journey Variables", "Global Variables"
  const variablesButton = page.getByTestId("node-editor").getByRole("button", { name: "Variables", exact: true });
  await expect(variablesButton).toBeVisible({ timeout: 5000 });

  // Check if already expanded
  const isExpanded = await variablesButton.getAttribute("aria-expanded");
  if (isExpanded !== "true") {
    await variablesButton.click();
    await page.waitForTimeout(300); // Wait for collapsible animation
  }
}

/**
 * Helper function to expand a scope section (User Variables, Journey Variables, or Global Variables)
 */
async function expandScopeSection(page: import("@playwright/test").Page, scope: "user" | "journey" | "global") {
  const sectionName = scope === "journey" ? "Journey Variables" : scope === "global" ? "Global Variables" : "User Variables";
  const sectionButton = page.getByTestId("node-editor").getByRole("button", { name: sectionName });
  await expect(sectionButton).toBeVisible();

  const isExpanded = await sectionButton.getAttribute("aria-expanded");
  if (isExpanded !== "true") {
    await sectionButton.click();
    await page.waitForTimeout(200);
  }
}

// =============================================================================
// NODE EDITOR - VARIABLES SECTION TESTS
// =============================================================================

test.describe("Variables in Node Editor @node-editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
    await enterEditMode(page);
  });

  test("can configure a set operation with key and value", async ({ page }) => {
    await clickNodeByLabel(page, "Welcome");
    await expandVariablesSection(page);
    await expandScopeSection(page, "user");

    // Add operation
    const addButton = page.getByRole("button", { name: "Add operation" }).first();
    await addButton.click();

    // Fill in key
    const keyInput = page.getByTestId("node-editor").getByPlaceholder("variable_name").first();
    await keyInput.fill("test_counter");

    // Fill in value (placeholder depends on operation type)
    const valueInput = page.getByTestId("node-editor").locator('input[placeholder*="hello"]').first();
    if ((await valueInput.count()) > 0) {
      await valueInput.fill("100");
      await expect(valueInput).toHaveValue("100");
    }

    await expect(keyInput).toHaveValue("test_counter");
  });

  test("can change operation type to increment", async ({ page }) => {
    await clickNodeByLabel(page, "Welcome");
    await expandVariablesSection(page);
    await expandScopeSection(page, "user");

    // Add operation
    await page.getByRole("button", { name: "Add operation" }).first().click();

    // Click on operation type selector (shows "Set" by default)
    const operationRow = page.getByTestId("node-editor").locator(".rounded-lg.border.bg-card\\/50").first();
    await operationRow.getByRole("combobox").click();

    // Select Increment option
    await page.getByRole("option", { name: /Increment/i }).click();

    // Verify amount field appears
    await expect(page.getByText("By:")).toBeVisible();
  });

  test("can remove a variable operation", async ({ page }) => {
    await clickNodeByLabel(page, "Welcome");
    await expandVariablesSection(page);
    await expandScopeSection(page, "user");

    // Add operation
    await page.getByRole("button", { name: "Add operation" }).first().click();

    // Fill key to identify the operation
    const keyInput = page.getByTestId("node-editor").getByPlaceholder("variable_name").first();
    await keyInput.fill("temp_var");

    // Click delete button (trash icon button)
    const deleteButton = page.getByTestId("node-editor").locator(".rounded-lg.border.bg-card\\/50").first().getByRole("button").last();
    await deleteButton.click();

    // Verify operation is removed
    await expect(keyInput).not.toBeVisible();
  });

  test("can add operations to multiple scopes", async ({ page }) => {
    await clickNodeByLabel(page, "Welcome");
    await expandVariablesSection(page);

    // Add user operation
    await expandScopeSection(page, "user");
    // Look for the "Add user operation" button specifically, or fallback to empty state button
    const userAddButton = page.getByRole("button", { name: "Add user operation" });
    if ((await userAddButton.count()) > 0) {
      await userAddButton.click();
    } else {
      await page.getByRole("button", { name: "Add operation" }).first().click();
    }
    const userKeyInput = page.getByTestId("node-editor").getByPlaceholder("variable_name").first();
    await userKeyInput.fill("user_var");

    // Add journey operation
    await expandScopeSection(page, "journey");
    const journeyAddButton = page.getByRole("button", { name: "Add journey operation" });
    if ((await journeyAddButton.count()) > 0) {
      await journeyAddButton.click();
    } else {
      // Use the empty state button within the journey section
      const journeySection = page.getByTestId("node-editor").locator("text=Journey Variables").locator("..").locator("..");
      await journeySection.getByRole("button", { name: "Add operation" }).click();
    }

    // Add global operation
    await expandScopeSection(page, "global");
    const globalAddButton = page.getByRole("button", { name: "Add global operation" });
    if ((await globalAddButton.count()) > 0) {
      await globalAddButton.click();
    } else {
      // Use the empty state button within the global section
      const globalSection = page.getByTestId("node-editor").locator("text=Global Variables").locator("..").locator("..");
      await globalSection.getByRole("button", { name: "Add operation" }).click();
    }

    // All three operations should be visible
    await expect(page.getByTestId("node-editor").getByPlaceholder("variable_name")).toHaveCount(3);
  });
});

// =============================================================================
// VARIABLES SETTINGS PAGE TESTS
// =============================================================================

test.describe("Variables Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/variables");
    await page.waitForTimeout(1000); // Wait for page to load
  });

  test("can create a global variable", async ({ page }) => {
    // Click Add Variable button
    await page.getByRole("button", { name: "Add Variable" }).click();

    // Fill in the form
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Key").fill(`test_var_${Date.now()}`);
    await page.getByLabel("Value").fill("42");

    // Save (button text is "Create" for new variables)
    await page.getByRole("button", { name: "Create" }).click();

    // Should show success toast
    await expect(page.getByText(/created/i)).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

test.describe("Variables Integration", () => {
  test("variable operations can be added and saved to node", async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
    await enterEditMode(page);

    // Use "Welcome" node (end node) which has no existing user variables
    await clickNodeByLabel(page, "Welcome");
    await expandVariablesSection(page);
    await expandScopeSection(page, "user");

    // Count existing operations before adding
    const initialCount = await page.getByTestId("node-editor").getByPlaceholder("variable_name").count();

    // Add a unique operation
    const uniqueKey = `test_save_${Date.now()}`;
    const addButton = page.getByRole("button", { name: "Add user operation" });
    if ((await addButton.count()) > 0) {
      await addButton.click();
    } else {
      await page.getByRole("button", { name: "Add operation" }).first().click();
    }

    // Verify operation was added
    const keyInputs = page.getByTestId("node-editor").getByPlaceholder("variable_name");
    const newCount = await keyInputs.count();
    expect(newCount).toBeGreaterThan(initialCount);

    // Fill in the key for the new operation (it should be the last one)
    await keyInputs.nth(newCount - 1).fill(uniqueKey);
    await expect(keyInputs.nth(newCount - 1)).toHaveValue(uniqueKey);

    // Also add a value
    const valueInputs = page.getByTestId("node-editor").locator('input[placeholder*="hello"]');
    const valueCount = await valueInputs.count();
    if (valueCount > 0) {
      await valueInputs.nth(valueCount - 1).fill("test_value");
      await expect(valueInputs.nth(valueCount - 1)).toHaveValue("test_value");
    }

    // Close the editor to trigger auto-save
    const closeButton = page.getByTestId("node-editor").locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();

    // Wait for editor to close (indicates auto-save succeeded)
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 5000 });

    // Re-open the node and verify the data is still there
    await clickNodeByLabel(page, "Welcome");
    await expandVariablesSection(page);
    await expandScopeSection(page, "user");

    // Check if the operation is still there after re-opening
    const reopenedKeyInputs = page.getByTestId("node-editor").getByPlaceholder("variable_name");
    const reopenedCount = await reopenedKeyInputs.count();
    expect(reopenedCount).toBeGreaterThan(initialCount);

    // Check if any of the inputs has our unique key
    let found = false;
    for (let i = 0; i < reopenedCount; i++) {
      const value = await reopenedKeyInputs.nth(i).inputValue();
      if (value === uniqueKey) {
        found = true;
        break;
      }
    }

    expect(found).toBeTruthy();
  });
});
