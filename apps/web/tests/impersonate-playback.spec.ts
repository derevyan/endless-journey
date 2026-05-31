/**
 * Impersonate & Playback E2E Tests - Simplified
 *
 * Essential tests for the impersonate workflow:
 * - Authentication and users page loading
 * - Starting impersonate mode and verifying playback initialization
 * - Exporting sessions as JSON files
 * - Validating SessionExport schema including new optional fields:
 *   - journeyDefinition (for self-contained offline replay)
 *   - platformMessages (for Telegram message correlation)
 *   - sessionContext (for execution context information)
 *
 * PREREQUISITES:
 * 1. Database must be seeded with test data: `pnpm db:seed`
 * 2. This will create 10 test telegram users (Alice, Bob, Charlie, etc.) with sessions
 * 3. Demo account (demo@journey.app) has access to all test data
 *
 * @module tests/impersonate-playback
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "fs";

async function fetchUsersWithSessions(page: Page): Promise<boolean> {
  const usersResponse = await page.request.get("/api/users?limit=1");
  expect(usersResponse.ok()).toBe(true);

  const usersData = await usersResponse.json();
  return Array.isArray(usersData.users) && usersData.users.length > 0;
}

async function ensureUsersWithSessions(page: Page) {
  if (await fetchUsersWithSessions(page)) return;

  const journeysResponse = await page.request.get("/api/journeys");
  expect(journeysResponse.ok()).toBe(true);

  const journeysData = await journeysResponse.json();
  const journeys = journeysData.journeys ?? [];

  if (journeys.length === 0) {
    throw new Error("No journeys available to seed a simulator session");
  }

  const activeJourney = journeys.find((journey: { status?: string }) => journey.status === "active") ?? journeys[0];

  if (activeJourney.status !== "active") {
    const activateResponse = await page.request.put(`/api/journeys/${activeJourney.id}`, {
      data: { status: "active" },
    });
    expect(activateResponse.ok()).toBe(true);
  }

  const createSessionResponse = await page.request.post("/api/simulator/sessions", {
    data: {
      journeyId: activeJourney.id,
      clientProfile: {
        firstName: "E2E",
        lastName: "Playback",
        username: `e2e_playback_${Date.now()}`,
      },
    },
  });

  expect(createSessionResponse.ok()).toBe(true);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await fetchUsersWithSessions(page)) return;
    await page.waitForTimeout(300);
  }

  throw new Error("Simulator session seeded but users list is still empty");
}

async function getFirstUserRowWithSessions(page: Page) {
  const table = page.locator("table");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const headers = table.locator("thead th");
    const headerCount = await headers.count();
    let sessionColumnIndex = -1;

    for (let i = 0; i < headerCount; i += 1) {
      const headerText = (await headers.nth(i).innerText()).trim();
      if (headerText === "Sessions") {
        sessionColumnIndex = i;
        break;
      }
    }

    if (sessionColumnIndex < 0) {
      throw new Error("Sessions column not found in users table");
    }

    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i);
      const cells = row.locator("td");
      const cellCount = await cells.count();

      if (cellCount <= sessionColumnIndex) continue;

      const sessionCountText = (await cells.nth(sessionColumnIndex).innerText()).trim();
      if (sessionCountText && sessionCountText !== "0") {
        return row;
      }
    }

    await page.waitForTimeout(300);
  }

  return null;
}

test.describe("Impersonate & Playback E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureUsersWithSessions(page);

    // Navigate to users page - uses authenticated page from fixture
    await page.goto("/users", { waitUntil: "domcontentloaded" });
  });

  /**
   * Test 1: Navigate to Users page and verify it loads
   */
  /**
   * Test 1: Start impersonate mode successfully
   * Combines: user row click, detail sheet, impersonate button, playback initialization
   */
  test("should start impersonate mode successfully", async ({ page }) => {
    // Wait for users table to load
    const userRows = page.locator("table tbody tr");
    await userRows.first().waitFor({ state: "visible", timeout: 10000 });

    const userRow = await getFirstUserRowWithSessions(page);
    expect(userRow, "No users with sessions found - run pnpm db:seed").not.toBeNull();

    // Click first user row to open detail sheet
    await userRow!.click();

    // Verify detail sheet opens
    const detailSheet = page.locator("aside, [role='dialog']");
    await expect(detailSheet).toBeVisible({ timeout: 3000 });

    // Find and click impersonate button
    const impersonateBtn = page.locator("button:has-text('Impersonate')");
    await expect(impersonateBtn).toBeVisible({ timeout: 3000 });
    await impersonateBtn.click();

    // Verify session selection dialog appears (shows for all users with sessions)
    // The dialog has title "Select Session to Replay" and contains a Play button (icon-only with title)
    const sessionDialog = page.getByRole("dialog", { name: /Session/i });
    await expect(sessionDialog).toBeVisible({ timeout: 5000 });

    // Verify the Play button is visible (uses title/aria-label, not text content)
    const playButton = sessionDialog.getByRole("button", { name: "Play this session" }).first();
    await expect(playButton).toBeVisible({ timeout: 3000 });
  });

  /**
   * Test 2: Export session as JSON file
   * Verifies download and validates SessionExport schema
   */
  test("should export session as JSON file", async ({ page }) => {
    // Wait for users table to load
    const userRows = page.locator("table tbody tr");
    await userRows.first().waitFor({ state: "visible", timeout: 10000 });

    const userRow = await getFirstUserRowWithSessions(page);
    expect(userRow, "No users with sessions found - run pnpm db:seed").not.toBeNull();

    // Click user row to open detail sheet
    await userRow!.click();

    // Wait for detail sheet
    const detailSheet = page.locator("aside, [role='dialog']");
    await expect(detailSheet).toBeVisible({ timeout: 3000 });

    // Click impersonate button
    const impersonateBtn = page.locator("button:has-text('Impersonate')");
    await impersonateBtn.click();

    // Wait for UI to settle
    await page.waitForTimeout(1000);

    // Set up download listener BEFORE clicking export
    const downloadPromise = page.waitForEvent("download", { timeout: 5000 });

    // Try to find and click download button
    // Option 1: Download button in session selection dialog
    const downloadBtn = page.locator('[role="dialog"] button[title*="Download"]').first();
    const downloadBtnVisible = await downloadBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (downloadBtnVisible) {
      await downloadBtn.click();
    } else {
      // Option 2: Export Session button in playback mode
      const exportBtn = page.locator('button:has-text("Export Session")');
      await exportBtn.waitFor({ state: "visible", timeout: 3000 });
      await exportBtn.click();
    }

    // Verify download started
    const download = await downloadPromise;

    // Verify filename pattern: {journey-slug}-{user-name}-{date}.json
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/.*\.json$/);

    // Get the downloaded file path
    const path = await download.path();
    expect(path).toBeTruthy();

    // Read and validate JSON structure
    const content = fs.readFileSync(path!, "utf-8");
    const sessionExport = JSON.parse(content);

    // Verify SessionExport schema structure - Required fields
    expect(sessionExport).toHaveProperty("exportVersion");
    expect(sessionExport).toHaveProperty("exportedAt");
    expect(sessionExport).toHaveProperty("user");
    expect(sessionExport).toHaveProperty("session");
    expect(sessionExport).toHaveProperty("interactions");

    // Verify specific values
    expect(sessionExport.exportVersion).toBe("1.0");
    expect(sessionExport.journey).toHaveProperty("id");
    expect(sessionExport.journey).toHaveProperty("slug");
    expect(sessionExport.user).toHaveProperty("id");
    expect(sessionExport.user).toHaveProperty("platformUserId");
    expect(sessionExport.user).toHaveProperty("displayName");
    expect(sessionExport.session).toHaveProperty("id");
    expect(sessionExport.session).toHaveProperty("status");
    expect(Array.isArray(sessionExport.interactions)).toBe(true);

    // Optional field validation (if present, they should be valid)
    if (sessionExport.journeyDefinition) {
      expect(sessionExport.journeyDefinition).toHaveProperty("nodes");
      expect(sessionExport.journeyDefinition).toHaveProperty("edges");
      expect(Array.isArray(sessionExport.journeyDefinition.nodes)).toBe(true);
      expect(Array.isArray(sessionExport.journeyDefinition.edges)).toBe(true);
    }

    if (sessionExport.platformMessages) {
      expect(Array.isArray(sessionExport.platformMessages)).toBe(true);
      // If platform messages exist, verify structure
      if (sessionExport.platformMessages.length > 0) {
        const firstMsg = sessionExport.platformMessages[0];
        expect(firstMsg).toHaveProperty("interactionEventId");
        expect(firstMsg).toHaveProperty("platformMessageId");
        expect(firstMsg).toHaveProperty("platformChatId");
        expect(firstMsg).toHaveProperty("messageType");
        expect(firstMsg).toHaveProperty("sentAt");
      }
    }

    if (sessionExport.sessionContext) {
      expect(sessionExport.sessionContext).toHaveProperty("organizationId");
      expect(sessionExport.sessionContext).toHaveProperty("mode");
      // Verify mode is one of the valid enum values
      expect(["live", "test", "simulation"]).toContain(sessionExport.sessionContext.mode);
    }
  });
});
