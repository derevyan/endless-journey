import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

/**
 * Test credentials - matches demo user from packages/db/src/seed.ts
 * These users need to be created via API before tests can run.
 *
 * @see packages/db/src/seed.ts for user creation instructions
 */
const TEST_CREDENTIALS = {
  email: "demo@journey.app",
  password: "demo1234",
  name: "Demo User",
};

/**
 * Global setup that authenticates before running tests.
 * Stores the authenticated state to be reused across tests.
 *
 * Uses demo credentials from seed.ts or environment overrides.
 * Will attempt to sign up if sign in fails (first run).
 */
setup("authenticate", async ({ page, request }) => {
  const email = process.env.TEST_USER_EMAIL || TEST_CREDENTIALS.email;
  const password = process.env.TEST_USER_PASSWORD || TEST_CREDENTIALS.password;
  const name = TEST_CREDENTIALS.name;
  const apiUrl = process.env.VITE_API_URL || "http://localhost:3001";

  // Disable edge animations BEFORE any navigation to prevent 80%+ CPU usage
  // This ensures the setting is in localStorage before the app loads
  await page.addInitScript(() => {
    localStorage.setItem("journey-edge-animations-v2", "false");
  });

  // First, try to sign up the test user via API (idempotent - will fail if exists)
  try {
    await request.post(`${apiUrl}/api/auth/sign-up/email`, {
      data: { email, password, name },
    });
  } catch {
    // User might already exist, continue to login
  }

  // Go to the app - will show login form
  await page.goto("/");

  // Wait for login form to be visible
  await expect(page.getByRole("heading", { name: /login/i })).toBeVisible({ timeout: 10000 });

  // Fill in credentials
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Click login button
  await page.getByRole("button", { name: /login/i }).click();

  // Wait for navigation to dashboard (heading "Dashboard" should be visible)
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({ timeout: 15000 });

  // Navigate to journeys page to verify full auth flow works
  await page.goto("/journeys");

  // Wait for journeys list to be visible (confirms auth works on journeys page)
  // The page now shows a list of journeys with "Active Journeys" heading
  await expect(page.getByRole("heading", { name: /active journeys/i })).toBeVisible({ timeout: 15000 });

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
