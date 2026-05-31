/**
 * Prompts Repository E2E Tests
 *
 * Tests the prompt management UI - listing, creating, and managing prompts.
 * Verifies CRUD operations and real workflow scenarios through the web interface.
 *
 * These tests require both web and api servers to be running.
 *
 * UI Flow: Prompts list → /prompts/new page → Fill form → Create → Editor page
 *
 * @module tests/prompts.spec
 */

import type { Page } from "@playwright/test";
import { expect, test } from "./test-helpers";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a prompt and navigate to editor page.
 * Returns the generated prompt name for cleanup/reference.
 */
async function createPrompt(page: Page, displayName: string, type: "text" | "chat" = "text"): Promise<void> {
  await page.goto("/prompts/new");
  await page.getByLabel("Display Name").fill(displayName);
  if (type === "chat") {
    await page.getByRole("tab", { name: "Chat" }).click();
  }
  await page.getByRole("button", { name: "Create Prompt" }).click();
  await page.waitForURL(/\/prompts\/(?!new)[a-z0-9-]+$/, { timeout: 10000 });
}

/**
 * Edit text content in the prompt editor (Monaco).
 * Uses Monaco's editor API directly to avoid keyboard race conditions.
 */
async function editPromptContent(page: Page, content: string): Promise<void> {
  const editor = page.locator(".monaco-editor");

  // Wait for Monaco to be fully initialized
  await editor.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(500); // Let Monaco fully initialize

  // Set content using Monaco's editor instance directly via the window object
  // This is more reliable than keyboard simulation which has race conditions
  const success = await page.evaluate((newContent) => {
    // Monaco exposes editors via window.monaco
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    if (!monaco?.editor?.getEditors) return false;

    const editors = monaco.editor.getEditors();
    if (editors.length === 0) return false;

    const editorInstance = editors[0] as { setValue?: (content: string) => void };
    if (typeof editorInstance.setValue !== "function") return false;

    editorInstance.setValue(newContent);
    return true;
  }, content);

  if (!success) {
    // Fallback to keyboard-based approach if Monaco API not available
    await editor.click();
    await page.waitForTimeout(300);

    // Use Cmd+A multiple times to ensure selection
    await page.keyboard.press("Meta+A");
    await page.waitForTimeout(200);
    await page.keyboard.press("Meta+A");
    await page.waitForTimeout(100);

    await page.keyboard.press("Backspace");
    await page.waitForTimeout(100);

    await page.keyboard.type(content, { delay: 20 });
  }

  // Wait for content to be processed
  await page.waitForTimeout(300);
}

/**
 * Save a new version with optional notes.
 */
async function saveVersion(page: Page, notes?: string): Promise<void> {
  await page.getByRole("button", { name: "Save Version" }).click();
  await page.waitForTimeout(300); // Wait for dialog animation

  if (notes) {
    await page.getByPlaceholder(/notes/i).fill(notes);
  }
  await page.getByRole("button", { name: /publish version/i }).click();
  await page.waitForTimeout(1000); // Wait for mutation to complete
}

/**
 * Set production label on current version via Labels popover.
 */
async function setProductionLabel(page: Page): Promise<void> {
  // Open Labels popover
  await page.getByRole("button", { name: /labels/i }).click();
  await page.waitForTimeout(300);

  // Click the production badge to toggle it on (use exact match to avoid sidebar buttons)
  await page.getByRole("button", { name: "production", exact: true }).click();

  // Save the labels (use exact match to avoid "Save Version" button)
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(500);
}

/**
 * Delete a prompt from the list page with confirmation.
 */
async function deletePromptFromList(page: Page, promptName: string): Promise<void> {
  await page.goto("/prompts");
  await page.waitForTimeout(500);

  // Find the row with the prompt and click delete
  const row = page.locator("tr", { hasText: new RegExp(promptName.replace(/\s+/g, ".*"), "i") });
  await row.getByRole("button").filter({ has: page.locator("svg") }).last().click();

  // Confirm deletion in dialog
  await page.getByRole("button", { name: /delete/i }).click();
  await page.waitForTimeout(1000);
}

test.describe("Prompts Repository", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to prompts page
    await page.goto("/prompts");
    await page.waitForTimeout(1000); // Wait for data to load
  });

  test("displays prompts list page", async ({ page }) => {
    // Verify page header text is visible (it's an h1 with text "Prompts")
    await expect(page.locator("h1", { hasText: "Prompts" })).toBeVisible({ timeout: 10000 });

    // Verify "New Prompt" link is available (Button with asChild renders as Link)
    await expect(page.getByRole("link", { name: /New Prompt/i })).toBeVisible();
  });

  test("can navigate to new prompt page", async ({ page }) => {
    // Click New Prompt link
    await page.getByRole("link", { name: /New Prompt/i }).click();

    // Wait for navigation to /prompts/new
    await page.waitForURL("**/prompts/new");

    // Page should show title "Create New Prompt"
    await expect(page.getByRole("heading", { name: "Create New Prompt" })).toBeVisible({ timeout: 5000 });

    // Form fields should be present
    await expect(page.getByLabel("Display Name")).toBeVisible();
    await expect(page.getByLabel("Identifier")).toBeVisible();
    await expect(page.getByLabel(/Description/i)).toBeVisible();
  });

  test("can create a text prompt", async ({ page }) => {
    const displayName = `E2E Test ${Date.now()}`;

    // Navigate to new prompt page
    await page.getByRole("link", { name: /New Prompt/i }).click();
    await page.waitForURL("**/prompts/new");

    // Fill in prompt details
    await page.getByLabel("Display Name").fill(displayName);
    // Identifier is auto-generated from display name
    // Text type is default, no need to select

    // Submit (button in header)
    await page.getByRole("button", { name: "Create Prompt" }).click();

    // Wait for navigation to editor (URL should change from /new to /<prompt-name>)
    await page.waitForURL(/\/prompts\/(?!new)[a-z0-9-]+$/, { timeout: 10000 });

    // Verify we navigated to the editor
    const currentUrl = page.url();
    expect(currentUrl).toContain("/prompts/");
    expect(currentUrl).not.toContain("/new");
  });

  test("can create a chat prompt", async ({ page }) => {
    const displayName = `E2E Chat ${Date.now()}`;

    // Navigate to new prompt page
    await page.getByRole("link", { name: /New Prompt/i }).click();
    await page.waitForURL("**/prompts/new");

    // Fill in prompt details
    await page.getByLabel("Display Name").fill(displayName);

    // Select chat type using Tabs
    await page.getByRole("tab", { name: "Chat" }).click();

    // Submit
    await page.getByRole("button", { name: "Create Prompt" }).click();

    // Wait for navigation to editor (URL should change from /new to /<prompt-name>)
    await page.waitForURL(/\/prompts\/(?!new)[a-z0-9-]+$/, { timeout: 10000 });

    // Verify we navigated to the editor
    const currentUrl = page.url();
    expect(currentUrl).toContain("/prompts/");
    expect(currentUrl).not.toContain("/new");
  });

  test("validates required fields", async ({ page }) => {
    // Navigate to new prompt page
    await page.getByRole("link", { name: /New Prompt/i }).click();
    await page.waitForURL("**/prompts/new");

    // Button should be disabled when name is empty
    const createButton = page.getByRole("button", { name: "Create Prompt" });
    await expect(createButton).toBeDisabled();
  });

  test("can navigate to prompt editor after creation", async ({ page }) => {
    const displayName = `E2E Nav ${Date.now()}`;

    // Navigate to new prompt page
    await page.getByRole("link", { name: /New Prompt/i }).click();
    await page.waitForURL("**/prompts/new");

    await page.getByLabel("Display Name").fill(displayName);
    await page.getByRole("button", { name: "Create Prompt" }).click();

    // Wait for navigation to editor (URL should change from /new to /<prompt-name>)
    await page.waitForURL(/\/prompts\/(?!new)[a-z0-9-]+$/, { timeout: 10000 });

    // Verify we're on the prompt editor page (not /new)
    expect(page.url()).toContain("/prompts/");
    expect(page.url()).not.toContain("/new");

    // The editor should show version info - use first match since v001 appears multiple times
    await expect(page.getByText(/v001/i).first()).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// EDITOR WORKFLOW TESTS
// =============================================================================

test.describe("Prompts Editor Workflows", () => {
  test("edit content and save new version", async ({ page }) => {
    const name = `Edit Test ${Date.now()}`;
    await createPrompt(page, name);

    // Edit content
    await editPromptContent(page, "Hello {{name}}, welcome!");

    // Save with notes
    await saveVersion(page, "Added greeting template");

    // Verify new version appears in sidebar (displays as v2, not v002)
    await expect(page.getByText("v2")).toBeVisible({ timeout: 5000 });
  });

  test("switch between versions preserves content", async ({ page }) => {
    const name = `Version Test ${Date.now()}`;
    await createPrompt(page, name);

    // v001 already exists (displays as v1), edit and save v002 (displays as v2)
    await editPromptContent(page, "Version 2 content");
    await saveVersion(page, "Second version");

    // Verify v2 exists in sidebar (versions display without leading zeros)
    await expect(page.getByText("v2")).toBeVisible({ timeout: 5000 });

    // Click on v1 in sidebar to switch - the version sidebar shows "v1" as text inside buttons
    // Use text locator to find v1 (not v10, v11 etc) and then click parent button
    await page.getByText("v1", { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Content should NOT contain v002 text
    const editor = page.locator(".monaco-editor");
    await expect(editor).not.toContainText("Version 2 content");
  });

  test("set version as production shows badge", async ({ page }) => {
    const name = `Prod Test ${Date.now()}`;
    await createPrompt(page, name);

    // Edit and save version
    await editPromptContent(page, "Production content");
    await saveVersion(page, "Release version");

    // Set production label via Labels popover
    await setProductionLabel(page);

    // Reload to ensure labels are persisted
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify production label appears in version info or sidebar
    await expect(page.getByText("production")).toBeVisible({ timeout: 5000 });
  });

  test("discard changes reverts content", async ({ page }) => {
    const name = `Discard Test ${Date.now()}`;
    await createPrompt(page, name);

    // Edit content (makes it dirty)
    await editPromptContent(page, "This will be discarded");

    // Click discard button
    await page.getByRole("button", { name: /discard/i }).click();

    // Content should be empty (original v001 has no content)
    const editor = page.locator(".monaco-editor");
    await expect(editor).not.toContainText("This will be discarded");
  });

  test("add and persist tags", async ({ page }) => {
    const name = `Tags Test ${Date.now()}`;
    await createPrompt(page, name);

    // Find tag input in config panel and add tags
    const tagInput = page.getByPlaceholder(/add tag/i);
    await tagInput.fill("onboarding");
    await tagInput.press("Enter");
    await page.waitForTimeout(300);
    await tagInput.fill("email");
    await tagInput.press("Enter");
    await page.waitForTimeout(500);

    // Reload page to verify persistence
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify tags persisted
    await expect(page.getByText("onboarding")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("email")).toBeVisible({ timeout: 5000 });
  });

  test("delete prompt removes from list", async ({ page }) => {
    const name = `Delete Test ${Date.now()}`;
    await createPrompt(page, name);

    // Go back to list and delete
    await deletePromptFromList(page, name);

    // Verify removed from list
    await expect(page.locator("tr", { hasText: new RegExp(name.split(" ").pop() || "", "i") })).not.toBeVisible({ timeout: 5000 });
  });

  test("variables extracted and displayed in config panel", async ({ page }) => {
    const name = `Vars Test ${Date.now()}`;
    await createPrompt(page, name);

    // Add content with variables
    await editPromptContent(page, "Hello {{myvar}}, your email is {{person.email}}");
    await saveVersion(page);

    // Wait for variables to be extracted and displayed (backend fetch)
    await page.waitForTimeout(2000);

    // Reload to ensure variables are fetched fresh
    await page.reload();
    await page.waitForTimeout(1000);

    // Check config panel shows extracted variables as clickable buttons
    // Variables section shows root variable names (myvar, person)
    // Use getByRole('button') to specifically target config panel buttons,
    // avoiding Monaco editor syntax highlighting spans that also contain the text
    await expect(page.getByRole("button", { name: "myvar" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "person" })).toBeVisible({ timeout: 5000 });
  });
});
