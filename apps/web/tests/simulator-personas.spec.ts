/**
 * Simulator Personas E2E Tests
 *
 * Tests the persona selection and management flow in the simulator.
 *
 * @module e2e/simulator-personas
 */

import { expect, test } from "@playwright/test";

import { enterSimulatorMode } from "./helpers/e2e-helpers";

test.describe("Simulator Personas @simulator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/saas-onboarding");
    // Wait for nodes to be rendered
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 20000 });
  });

  test("can create a new persona from dropdown", async ({ page }) => {
    // Enter simulator mode using the mode switch toggle
    await enterSimulatorMode(page);

    // Open persona dropdown
    const personaDropdown = page.getByRole("button", { name: /anonymous/i });
    await personaDropdown.click();

    // Click "Create new persona"
    await page.getByText("Create new persona").click();

    // Fill in persona name (use unique name to avoid conflicts)
    const uniqueName = `Create Test ${Date.now()}`;
    const nameInput = page.getByLabel("Name");
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(uniqueName);

    // Click Create
    await page.getByRole("button", { name: "Create", exact: true }).click();

    // Verify persona is selected (dropdown should show the new name)
    await expect(page.getByRole("button", { name: new RegExp(uniqueName, "i") })).toBeVisible({ timeout: 10000 });
  });

  test("can switch between personas", async ({ page }) => {
    // Enter simulator mode using the mode switch toggle
    await enterSimulatorMode(page);

    // Open persona dropdown
    const personaDropdown = page.getByRole("button", { name: /anonymous/i });
    await personaDropdown.click();

    // Create a persona first (to ensure there's one to switch from) - use unique name
    const uniqueName = `Switch Test ${Date.now()}`;
    await page.getByText("Create new persona").click();
    const nameInput = page.getByLabel("Name");
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(uniqueName);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp(uniqueName, "i") })).toBeVisible({ timeout: 10000 });

    // Re-open dropdown and switch to Anonymous
    await page.getByRole("button", { name: new RegExp(uniqueName, "i") }).click();
    await page.getByText("Anonymous").first().click();
    await expect(page.getByRole("button", { name: /anonymous/i })).toBeVisible({ timeout: 5000 });
  });

  test("can clean up test data from dropdown", async ({ page }) => {
    // Enter simulator mode using the mode switch toggle
    await enterSimulatorMode(page);

    // Open persona dropdown
    const personaDropdown = page.getByRole("button", { name: /anonymous/i });
    await expect(personaDropdown).toBeVisible({ timeout: 5000 });
    await personaDropdown.click();

    // Click "Clean up test data"
    await page.getByText("Clean up test data").click();

    // Wait for cleanup to complete (toast notification should appear)
    await expect(page.getByText(/test data cleaned up/i)).toBeVisible({ timeout: 10000 });
  });

  test("persona persists across simulator restart", async ({ page }) => {
    // Enter simulator mode using the mode switch toggle
    await enterSimulatorMode(page);

    // Open persona dropdown and create/select a persona
    const personaDropdown = page.getByRole("button", { name: /anonymous/i });
    await personaDropdown.click();

    // Create a unique persona
    await page.getByText("Create new persona").click();
    const uniqueName = `Persist Test ${Date.now()}`;
    await page.getByLabel("Name").fill(uniqueName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    // Verify persona is selected
    await expect(page.getByRole("button", { name: new RegExp(uniqueName, "i") })).toBeVisible({ timeout: 5000 });

    // Exit simulator mode by toggling the mode switch
    const modeSwitch = page.getByTestId("mode-switch");
    await modeSwitch.getByRole("switch").click();

    // Re-enter simulator mode
    await enterSimulatorMode(page);

    // Verify the same persona is still selected
    await expect(page.getByRole("button", { name: new RegExp(uniqueName, "i") })).toBeVisible({ timeout: 5000 });
  });
});
