/**
 * Mindstate E2E Test Helpers
 *
 * Reusable helper functions for mindstate builder and version history testing.
 */

import { Page, APIRequestContext, expect } from "@playwright/test";
import { createLogger } from "@journey/logger";

const log = createLogger("mindstate-helpers");

/**
 * Create a new mindstate definition with the given key and name.
 * Navigates to /mindstate/new with query parameters.
 */
export async function createMindstateDefinition(
  page: Page,
  key: string,
  name: string,
  options?: { description?: string }
): Promise<void> {
  const params = new URLSearchParams({
    name,
    key,
    ...(options?.description && { description: options.description }),
  });

  await page.goto(`/mindstate/new?${params.toString()}`);
  await page.waitForLoadState("networkidle");

  // Wait for the builder to be ready
  await expect(page.getByText("Add Agent")).toBeVisible({ timeout: 5000 });
}

/**
 * Add an agent to the mindstate definition.
 */
export async function addAgent(
  page: Page,
  agentName: string,
  roleDescription: string = "Test Agent Role"
): Promise<void> {
  const addAgentButton = page.getByRole("button", { name: "Add Agent" });
  await expect(addAgentButton).toBeVisible({ timeout: 3000 });
  await addAgentButton.click();

  // Wait for agent dialog
  await expect(page.getByText("Create Agent")).toBeVisible({ timeout: 3000 });

  // Fill in agent details
  await page.getByLabel("Name").fill(agentName);
  await page.getByLabel("Role Description").fill(roleDescription);

  // Click Create button
  const createButton = page.getByRole("button", { name: "Create" });
  await createButton.click();

  // Wait for dialog to close and agent to appear
  await page.waitForLoadState("networkidle");
}

/**
 * Publish the mindstate definition.
 * Waits for the publish button to be enabled and clicks it.
 * If this is an existing definition, the PublishVersionDialog will appear.
 */
export async function publishDefinition(page: Page, timeoutMs: number = 10000, notes?: string): Promise<void> {
  const publishButton = page.locator("header").getByRole("button", { name: "Publish" });
  await expect(publishButton).toBeEnabled({ timeout: 3000 });
  await publishButton.click();

  // Check if PublishVersionDialog appears (for existing definitions)
  const dialogTitle = page.getByText("Publish Version");
  const dialogVisible = await dialogTitle.isVisible().catch(() => false);

  if (dialogVisible) {
    // Fill in notes if provided
    if (notes) {
      await page.getByPlaceholder(/add notes/i).fill(notes);
    }
    // Click Publish button in dialog
    await page.getByRole("button", { name: "Publish Version" }).click();
  }

  // Wait for publish to complete (unsaved indicator should disappear)
  await verifySavedState(page);
}

/**
 * Verify that the definition has unsaved changes indicator.
 */
export async function verifyUnsavedState(page: Page): Promise<void> {
  const unsavedIndicator = page.getByText("Unsaved");
  await expect(unsavedIndicator).toBeVisible({ timeout: 5000 });
}

/**
 * Verify that the definition has been saved (no unsaved indicator).
 */
export async function verifySavedState(page: Page): Promise<void> {
  const unsavedIndicator = page.getByText("Unsaved");
  await expect(unsavedIndicator).not.toBeVisible({ timeout: 5000 });
}

/**
 * Open the version history panel.
 * Looks for the History button in the header.
 */
export async function openVersionHistory(page: Page): Promise<void> {
  const historyButton = page.locator("header").getByRole("button", { name: /history/i });
  await expect(historyButton).toBeVisible({ timeout: 3000 });
  await historyButton.click();

  // Wait for panel to open
  await expect(page.getByText("Version History")).toBeVisible({ timeout: 5000 });
}

/**
 * Close the version history panel.
 */
export async function closeVersionHistory(page: Page): Promise<void> {
  const closeButton = page.getByRole("button", { name: /close|×/i }).first();
  await closeButton.click();

  // Wait for panel to close
  await expect(page.getByText("Version History")).not.toBeVisible({ timeout: 3000 });
}

/**
 * Get the list of versions from the version history panel.
 * Returns an array of version IDs like ["v003", "v002", "v001"].
 */
export async function getVersionList(page: Page): Promise<string[]> {
  const versionItems = page.locator("[data-testid='version-item']");
  const count = await versionItems.count();

  const versions: string[] = [];
  for (let i = 0; i < count; i++) {
    const item = versionItems.nth(i);
    const versionText = await item.locator("[data-testid='version-id']").textContent();
    if (versionText) {
      versions.push(versionText.trim());
    }
  }

  return versions;
}

/**
 * Restore a specific version from the version history panel.
 * Handles the confirmation dialog if present.
 */
export async function restoreVersion(page: Page, versionId: string): Promise<void> {
  // Find the version item
  const versionItem = page.locator(`[data-testid='version-item-${versionId}']`);
  await expect(versionItem).toBeVisible({ timeout: 3000 });

  // Click restore button
  const restoreButton = versionItem.getByRole("button", { name: "Restore" });
  await restoreButton.click();

  // Handle confirmation dialog if present
  const confirmButton = page.getByRole("button", { name: /confirm|restore/i });
  if ((await confirmButton.count()) > 0) {
    await confirmButton.click();
  }

  // Wait for restore to complete
  await page.waitForLoadState("networkidle");
}

/**
 * Export a version as JSON from the version history panel.
 * Sets up download listener and returns the promise.
 */
export async function exportVersion(page: Page, versionId: string): Promise<void> {
  const versionItem = page.locator(`[data-testid='version-item-${versionId}']`);
  await expect(versionItem).toBeVisible({ timeout: 3000 });

  // Start waiting for download
  const downloadPromise = page.context().waitForEvent("download");

  // Click export button
  const exportButton = versionItem.getByRole("button", { name: "Export" });
  await exportButton.click();

  // Wait for download to complete
  const download = await downloadPromise;

  // Verify download path
  expect(download.suggestedFilename()).toMatch(/mindstate.*\.json/i);
}

/**
 * Cleanup a mindstate definition by deleting it via API.
 * Requires the user to be authenticated.
 */
export async function cleanupDefinition(
  request: APIRequestContext,
  definitionKey: string,
  organizationId?: string
): Promise<void> {
  try {
    const baseUrl = process.env.API_URL || "http://localhost:3001";

    // Try to delete the definition
    const response = await request.delete(`${baseUrl}/api/mindstates/definitions/${definitionKey}`, {
      headers: {
        "Content-Type": "application/json",
        // Critical: Include mock user ID for test API auth
        "X-Mock-User-Id": "00000000-0000-0000-0000-000000000001",
      },
    });

    // Don't fail if cleanup fails (it's just cleanup)
    if (!response.ok()) {
      log.warn({ definitionKey, status: response.status() }, "helpers:cleanupDefinition:failed");
    }
  } catch (error) {
    log.warn({ definitionKey, error }, "helpers:cleanupDefinition:error");
  }
}

/**
 * Wait for a success notification/toast with the given text.
 */
export async function waitForSuccessNotification(
  page: Page,
  textPattern: string | RegExp,
  timeoutMs: number = 5000
): Promise<void> {
  const notification = page.getByRole("alert").filter({ hasText: textPattern });
  await expect(notification).toBeVisible({ timeout: timeoutMs });
}

/**
 * Wait for an error notification/toast.
 */
export async function waitForErrorNotification(
  page: Page,
  timeoutMs: number = 5000
): Promise<void> {
  // Look for error or alert notifications
  const errorNotification = page.getByRole("alert").filter({ has: page.locator("[data-variant='destructive']") });
  await expect(errorNotification).toBeVisible({ timeout: timeoutMs });
}

/**
 * Navigate to a mindstate definition by key.
 */
export async function navigateToDefinition(page: Page, definitionKey: string): Promise<void> {
  await page.goto(`/mindstate/${definitionKey}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Add Agent")).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to the mindstate list page.
 */
export async function navigateToMindstateList(page: Page): Promise<void> {
  await page.goto("/mindstate");
  await page.waitForLoadState("networkidle");
}
