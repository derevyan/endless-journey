import { expect, test } from "@playwright/test";

/**
 * Profile Settings Page E2E Tests
 *
 * Tests the Profile settings page which allows users to edit their name and change password.
 *
 * Uses authenticated context from auth.setup.ts
 */

test.describe("Profile Settings Page", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/profile");
    // Wait for page to load - check for heading "Profile"
    await expect(page.getByRole("heading", { name: "Profile", level: 2 })).toBeVisible({ timeout: 10000 });
  });

  test("can edit user name", async ({ page }) => {
    // Find and click the edit button for name
    const editButton = page.locator('button').filter({ has: page.locator('svg[class*="lucide-pencil"]') }).first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Name field should become editable
    const nameInput = page.locator('input[placeholder*="name" i], input[value*="Demo"]').first();
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toBeEditable();

    // Clear and enter new name
    await nameInput.clear();
    const newName = `Test User ${Date.now()}`;
    await nameInput.fill(newName);

    // Click save button (check icon)
    const saveButton = page.locator('button').filter({ has: page.locator('svg[class*="lucide-check"]') }).first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 });

    // Name should be updated (wait a bit for the UI to update, then check)
    await page.waitForTimeout(1000);
    // Check if name appears in the read-only field or input
    const nameDisplay = page.locator(`div:has-text("${newName}"), input[value="${newName}"]`).first();
    await expect(nameDisplay).toBeVisible({ timeout: 5000 });
  });

  test("password change form validates input", async ({ page }) => {
    // Open password change form
    const changePasswordButton = page.getByRole("button", { name: /change password/i });
    await changePasswordButton.click();

    // Wait for form to appear
    await expect(page.getByLabel(/current password/i)).toBeVisible({ timeout: 3000 });

    // Try to submit without filling fields
    const submitButton = page.getByRole("button", { name: /change password/i }).filter({ hasText: /change password/i });
    await expect(submitButton).toBeDisabled();

    // Fill current password only
    await page.getByLabel(/current password/i).fill("demo1234");
    await expect(submitButton).toBeDisabled();

    // Fill new password that's too short
    await page.getByLabel("New Password", { exact: true }).fill("short");
    await expect(submitButton).toBeDisabled();

    // Fill valid new password
    await page.getByLabel("New Password", { exact: true }).fill("newpassword123");
    await page.getByLabel("Confirm New Password").fill("differentpassword");
    await expect(submitButton).toBeDisabled();

    // Fill matching passwords
    await page.getByLabel("Confirm New Password").fill("newpassword123");
    await expect(submitButton).toBeEnabled();
  });
});
