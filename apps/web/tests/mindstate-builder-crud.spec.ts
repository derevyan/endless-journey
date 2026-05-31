/**
 * MindState Builder CRUD E2E Tests
 *
 * Tests for agent CRUD operations with persistence verification.
 * Validates that changes are properly saved to the server and persist after navigation.
 *
 * NOTE: Sidebar buttons require JavaScript event dispatch because React's synthetic
 * event system combined with drag-and-drop libraries doesn't always respond to
 * Playwright's native clicks. Editor panel buttons work normally.
 *
 * @module tests/mindstate-builder-crud
 */

import { expect, test, type Page } from "@playwright/test";

/**
 * Helper to click sidebar buttons that don't respond to normal Playwright clicks.
 * Uses JavaScript event dispatch to trigger React event handlers.
 *
 * The sidebar uses Collapsible components where section headers are buttons,
 * and the + button is a sibling of the header.
 */
async function clickSidebarPlusButton(page: Page, sectionText: string): Promise<void> {
  await page.evaluate((text) => {
    // The sidebar structure is:
    // <div class="flex items-center justify-between">
    //   <button (CollapsibleTrigger)>...Sub-Agents...</button>
    //   <button (Plus button)><Plus icon/></button>
    // </div>

    // Find element containing the section text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let textNode: Text | null;
    let targetParent: HTMLElement | null = null;

    while ((textNode = walker.nextNode() as Text)) {
      if (textNode.textContent?.includes(text)) {
        // Find the parent container that has both trigger and plus button
        const parent = textNode.parentElement?.closest("div.flex");
        if (parent) {
          targetParent = parent as HTMLElement;
          break;
        }
      }
    }

    if (!targetParent) {
      throw new Error(`Could not find section containing "${text}"`);
    }

    // Find the + button (the one with lucide-plus icon)
    const plusButton = targetParent.querySelector("button:has(svg.lucide-plus)") as HTMLElement;

    if (!plusButton) {
      throw new Error(`Could not find plus button near "${text}"`);
    }

    // Dispatch a proper click event that React will capture
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    plusButton.dispatchEvent(clickEvent);
  }, sectionText);
}

/**
 * Helper to click on an agent in the sidebar.
 * SystemAgentList renders agents as <div role="button"> elements, not <button> elements.
 */
async function clickAgentInSidebar(page: Page, agentName: string): Promise<void> {
  // The agent container is a div with role="button" that contains the agent name
  // SystemAgentList renders: <div role="button">...<span>{agent.name}</span>...</div>
  const agentContainer = page.locator(`[role="button"]:has-text("${agentName}")`).first();

  // Wait for the element to be visible before clicking
  await agentContainer.waitFor({ state: "visible", timeout: 5000 });
  await agentContainer.click();
}

test.describe("MindState Builder Persistence", () => {
  test("creates agent, saves definition, verifies persistence after navigation", async ({ page, request }) => {
    // Generate unique key
    const definitionKey = `e2e-persist-${Date.now()}`;
    const definitionName = "E2E Persistence Test";

    try {
      // Step 1: Navigate to new builder
      await page.goto(`/mindstate/new?name=${encodeURIComponent(definitionName)}&key=${definitionKey}`);
      await page.waitForLoadState("load");

      // Wait for builder to be ready - Settings button is always present
      await expect(page.getByRole("button", { name: "Settings" })).toBeVisible({ timeout: 15000 });

      // Step 2: Add a new agent via the plus button (use JS dispatch for sidebar buttons)
      await clickSidebarPlusButton(page, "Sub-Agents");

      // Wait for editor panel to open
      await expect(page.getByTestId("editor-panel")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Create Sub-Agent")).toBeVisible();

      // Step 3: Fill agent form (system prompt is required by API validation)
      await page.getByPlaceholder("Agent name...").fill("Persistence Test Agent");
      await page.getByPlaceholder("Role or specialty...").fill("Tests persistence");
      await page.getByPlaceholder("You are a helpful assistant...").fill("You are a test agent that verifies persistence.");

      // Step 4: Save in panel using the Save button (panel buttons work normally)
      const panelSaveBtn = page.getByTestId("editor-panel").getByRole("button", { name: "Save" });
      await panelSaveBtn.click();

      // Wait for save toast
      await expect(page.getByText("Agent created")).toBeVisible({ timeout: 3000 });

      // Step 5: Close editor panel by clicking X button after save
      // Note: The editor panel does NOT auto-close on Save - must be manually closed
      const closeBtn = page.getByTestId("editor-panel-close");
      await closeBtn.click();
      await expect(page.getByTestId("editor-panel")).not.toBeVisible({ timeout: 3000 });

      // Step 6: Verify agent appears in sidebar
      await expect(page.getByText("Persistence Test Agent").first()).toBeVisible({ timeout: 5000 });

      // Step 7: Publish definition to server via header Publish button
      await expect(page.getByText("Unsaved")).toBeVisible({ timeout: 3000 });

      // Use the header element to find the Publish button (accessible name is "Publish" from sr-only span)
      // The panel is closed at this point, so the only Publish button is in the header
      const headerPublishBtn = page.locator("header").getByRole("button", { name: "Publish" });
      await expect(headerPublishBtn).toBeEnabled({ timeout: 3000 });
      await headerPublishBtn.click();

      // After publishing a new definition, the app navigates from /new to /$key
      // This triggers an "Unsaved Changes" dialog - wait for it with proper timeout
      const unsavedDialog = page.getByRole("alertdialog");
      try {
        await expect(unsavedDialog).toBeVisible({ timeout: 10000 });
        await unsavedDialog.getByRole("button", { name: "Leave" }).click();
        await expect(unsavedDialog).not.toBeVisible({ timeout: 5000 });
      } catch {
        // Dialog didn't appear within timeout - that's OK, continue
      }

      // Wait for URL to change to the definition page (indicates save succeeded)
      await page.waitForURL(`**/mindstate/${definitionKey}`, { timeout: 10000 });

      // Now "Unsaved" text should be gone (we're on the saved definition page)
      await expect(page.getByText("Unsaved")).not.toBeVisible({ timeout: 5000 });

      // Step 8: Navigate away
      await page.goto("/mindstate");
      await page.waitForLoadState("load");

      // Step 9: Navigate back to the definition
      await page.goto(`/mindstate/${definitionKey}`);
      await page.waitForLoadState("load");

      // Wait for builder to load
      await expect(page.getByRole("button", { name: "Settings" })).toBeVisible({ timeout: 15000 });

      // Step 10: Verify agent persisted
      await expect(page.getByText("Persistence Test Agent").first()).toBeVisible({ timeout: 10000 });
    } finally {
      // Cleanup: Delete the definition (runs even if test fails)
      await request.delete(`http://localhost:3001/api/mindstates/definitions/${definitionKey}`, {
        headers: { "X-Mock-User-Id": "00000000-0000-0000-0000-000000000001" },
      });
    }
  });
});
