import { expect, test } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

import { clickNodeByLabel, enterEditMode } from "./helpers/e2e-helpers";

/**
 * Media Upload E2E Tests
 *
 * Tests for media upload functionality in node editors.
 * Covers upload, preview, persistence after publish/reload.
 *
 * Uses dedicated e2e-media-test journey that gets reset before tests run
 * to ensure test isolation and prevent state pollution.
 */

// Reset journey to clean state before all media tests
test.beforeAll(async () => {
  // Dynamic import to avoid loading DB in browser context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resetE2EMediaTestJourney } = await import("../../../packages/db/src/test-utils/index.ts");
  await resetE2EMediaTestJourney();
});

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test image file path (use a simple placeholder image)
const TEST_IMAGE_PATH = path.join(__dirname, "fixtures", "test-image.png");

/**
 * Helper to publish the journey version
 */
async function publishJourneyVersion(page: import("@playwright/test").Page) {
  // Use Cmd+S / Ctrl+S to publish
  await page.keyboard.press("Meta+s");

  // Wait for publish dialog or automatic publish
  await page.waitForTimeout(1000);

  // If publish dialog appears, confirm it
  const publishDialog = page.getByRole("dialog");
  if (await publishDialog.isVisible()) {
    const publishButton = publishDialog.getByRole("button", { name: /publish/i });
    if (await publishButton.isVisible()) {
      await publishButton.click();
    }
  }

  // Wait for publish to complete
  await page.waitForTimeout(500);
}

test.describe("Media Upload in Node Editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/e2e-media-test");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("message node editor has Media section", async ({ page }) => {
    await enterEditMode(page);

    // Click on a message node
    await clickNodeByLabel(page, "Test Media");

    // Verify Media section is present (collapsed by default if no media)
    const mediaSection = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await expect(mediaSection).toBeVisible();
  });

  test("Media section expands to show upload area", async ({ page }) => {
    await enterEditMode(page);
    await clickNodeByLabel(page, "Test Media");

    // Click on Media section to expand
    const mediaTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await mediaTrigger.click();

    // Verify upload area is visible
    await expect(page.getByText(/attach an image or video/i)).toBeVisible();
    await expect(page.getByText(/drop file here or browse/i)).toBeVisible();
  });

  test("start node editor has Media section", async ({ page }) => {
    await enterEditMode(page);

    // Click on start node
    await clickNodeByLabel(page, "START");

    // Verify this is the start node editor
    await expect(page.getByTestId("node-editor-heading")).toContainText(/edit start node/i);

    // Verify Media section is present
    const mediaSection = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await expect(mediaSection).toBeVisible();
  });

  test("start node Media section expands to show upload area", async ({ page }) => {
    await enterEditMode(page);
    await clickNodeByLabel(page, "START");

    // Click on Media section to expand
    const mediaTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await mediaTrigger.click();

    // Verify upload area is visible (default description from DynamicNodeSections)
    await expect(page.getByText(/attach an image or video to send with this message/i)).toBeVisible();
    await expect(page.getByText(/drop file here or browse/i)).toBeVisible();
  });
});

test.describe("Media Upload and Persistence", () => {
  // Skip if test image doesn't exist (will be created in fixtures)
  test.beforeAll(async () => {
    const fs = await import("fs");
    const fixturesDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    // Create a simple test image if it doesn't exist
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      // Create a minimal valid PNG (1x1 pixel, red)
      const png = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR length
        0x49,
        0x48,
        0x44,
        0x52, // IHDR
        0x00,
        0x00,
        0x00,
        0x01, // width: 1
        0x00,
        0x00,
        0x00,
        0x01, // height: 1
        0x08,
        0x02, // bit depth: 8, color type: RGB
        0x00,
        0x00,
        0x00, // compression, filter, interlace
        0x90,
        0x77,
        0x53,
        0xde, // CRC
        0x00,
        0x00,
        0x00,
        0x0c, // IDAT length
        0x49,
        0x44,
        0x41,
        0x54, // IDAT
        0x08,
        0xd7,
        0x63,
        0xf8,
        0xcf,
        0xc0,
        0x00,
        0x00, // compressed data
        0x01,
        0x01,
        0x01,
        0x00, // CRC placeholder
        0x18,
        0xdd,
        0x8d,
        0xb4, // actual CRC
        0x00,
        0x00,
        0x00,
        0x00, // IEND length
        0x49,
        0x45,
        0x4e,
        0x44, // IEND
        0xae,
        0x42,
        0x60,
        0x82, // CRC
      ]);
      fs.writeFileSync(TEST_IMAGE_PATH, png);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/e2e-media-test");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("can upload image via file input", async ({ page }) => {
    await enterEditMode(page);
    await clickNodeByLabel(page, "Test Media");

    // Expand Media section
    const mediaTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await mediaTrigger.click();

    // Get the file input and upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE_PATH);

    // Wait for upload to complete - should show preview or loading
    // After successful upload, the preview should be visible
    await expect(page.getByTestId("node-editor").locator('img[alt*="image"], img[alt*="Image"], img[alt*="Uploaded"]')).toBeVisible({ timeout: 15000 });
  });

  test("uploaded media shows preview with remove button", async ({ page }) => {
    await enterEditMode(page);
    await clickNodeByLabel(page, "Test Media");

    // Expand Media section
    const mediaTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await mediaTrigger.click();
    await page.waitForTimeout(500);

    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE_PATH);

    // Wait for preview - the media upload component shows an img when uploaded
    const mediaPreview = page.getByTestId("node-editor").locator(".aspect-video img");
    await expect(mediaPreview).toBeVisible({ timeout: 15000 });

    // Verify remove button is visible (in the media info bar)
    const mediaInfoBar = page.getByTestId("node-editor").locator(".aspect-video").locator("..").locator("button");
    await expect(mediaInfoBar).toBeVisible();
  });

  test("can remove uploaded media", async ({ page }) => {
    await enterEditMode(page);
    await clickNodeByLabel(page, "Test Media");

    // Expand Media section
    const mediaTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await mediaTrigger.click();
    await page.waitForTimeout(500);

    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE_PATH);

    // Wait for preview
    const mediaPreview = page.getByTestId("node-editor").locator(".aspect-video img");
    await expect(mediaPreview).toBeVisible({ timeout: 15000 });

    // Click remove button (in the media component's info bar)
    const removeButton = page.getByTestId("node-editor").locator(".aspect-video").locator("..").locator("button").last();
    await removeButton.click();

    // Verify upload area is shown again (drop zone text)
    await expect(page.getByTestId("node-editor").getByText(/drop file here/i)).toBeVisible({ timeout: 5000 });
  });

  // Skip persistence tests in CI - they require MinIO to be running
  // Run locally with `docker compose up minio` first
  test("media persists after saving node", async ({ page }) => {
    await enterEditMode(page);
    await clickNodeByLabel(page, "Test Media");

    // Expand Media section
    const mediaTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await mediaTrigger.click();
    await page.waitForTimeout(500);

    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE_PATH);

    // Wait for preview to be visible and loaded
    const mediaPreview = page.getByTestId("node-editor").locator(".aspect-video img");
    await expect(mediaPreview).toBeVisible({ timeout: 15000 });
    // Wait for image to actually load
    await mediaPreview.evaluate((img: HTMLImageElement) => {
      return new Promise<void>((resolve) => {
        if (img.complete) {
          resolve();
        } else {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Resolve even on error to avoid hanging
        }
      });
    });

    // Close the editor to trigger auto-save
    const closeButton = page.getByTestId("node-editor").locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await closeButton.click();

    // Wait for editor to close (indicates auto-save succeeded)
    await expect(page.getByTestId("node-editor")).not.toBeVisible({ timeout: 5000 });

    // Reopen the same node
    await clickNodeByLabel(page, "Test Media");

    // Media section should auto-expand if media exists, but ensure it's visible
    // Wait a bit for auto-expansion, then check if content is visible
    await page.waitForTimeout(300);

    const mediaContent = page.getByTestId("node-editor").locator(".aspect-video");
    const isContentVisible = await mediaContent.isVisible().catch(() => false);

    if (!isContentVisible) {
      // If not visible, expand the media section
      const mediaTriggerReopen = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
      await mediaTriggerReopen.click();
      await page.waitForTimeout(500);
    }

    // Wait for media section content to be visible
    await expect(mediaContent).toBeVisible({ timeout: 5000 });

    // Verify media is still there - wait for image to be visible and loaded
    const mediaPreviewAfterSave = page.getByTestId("node-editor").locator(".aspect-video img");
    await expect(mediaPreviewAfterSave).toBeVisible({ timeout: 10000 });
    // Wait for image to actually load
    await mediaPreviewAfterSave.evaluate((img: HTMLImageElement) => {
      return new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve();
        } else {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Resolve even on error to avoid hanging
        }
      });
    });
  });
});

test.describe("Media Upload Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journeys/e2e-media-test");
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("shows error for unsupported file type", async ({ page }) => {
    await enterEditMode(page);
    await clickNodeByLabel(page, "Test Media");

    // Expand Media section
    const mediaTrigger = page.getByTestId("node-editor").getByRole("button", { name: "Media" });
    await mediaTrigger.click();

    // Create a temporary text file
    const fs = await import("fs");
    const textFilePath = path.join(__dirname, "fixtures", "test.txt");
    fs.writeFileSync(textFilePath, "This is not an image");

    // Try to upload text file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(textFilePath);

    // Should show error message
    await expect(page.getByText(/invalid file type|unsupported/i)).toBeVisible({ timeout: 5000 });

    // Clean up
    fs.unlinkSync(textFilePath);
  });
});
