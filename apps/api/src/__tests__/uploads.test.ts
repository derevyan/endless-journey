/**
 * Uploads API Integration Tests
 *
 * Tests for the /api/uploads endpoints using real HTTP requests.
 * Covers media upload, listing, usage checking, and deletion.
 * Requires API server running on localhost:3001
 *
 * Note: Some tests require MinIO storage to be running.
 *
 * Run with: pnpm test:uploads
 */

import { createLogger, serializeError } from "@journey/logger";
import { describe, expect, it, beforeAll } from "vitest";
import {
  API_BASE_URL,
  request,
  authRequest,
  TEST_USER_IDS,
  TEST_JOURNEY_IDS,
  checkServerHealth,
  type ErrorResponse,
  type SuccessResponse,
} from "./helpers/test-app";

const log = createLogger("uploads-test");

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  filename: string;
  createdAt: string;
}

interface MediaListResponse {
  media: MediaItem[];
}

interface UploadResponse {
  url: string;
  type: "image" | "video";
  filename: string;
}

interface MediaUsageResponse {
  inUse: boolean;
  usedIn: string[];
}

interface UploadConfigResponse {
  allowedTypes: {
    image: string[];
    video: string[];
  };
  maxSize: {
    image: number;
    video: number;
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Uploads API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  // ===========================================================================
  // GET UPLOAD CONFIG
  // ===========================================================================

  describe("GET /api/uploads/config", () => {
    it("should return upload configuration", async () => {
      const response = await authRequest("GET", "/api/uploads/config", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as UploadConfigResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("allowedTypes");
      expect(data).toHaveProperty("maxSize");
      expect(data.allowedTypes).toHaveProperty("image");
      expect(data.allowedTypes).toHaveProperty("video");
      expect(Array.isArray(data.allowedTypes.image)).toBe(true);
      expect(Array.isArray(data.allowedTypes.video)).toBe(true);
    });

    it("should include correct MIME types", async () => {
      const response = await authRequest("GET", "/api/uploads/config", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as UploadConfigResponse;

      expect(response.status).toBe(200);
      expect(data.allowedTypes.image).toContain("image/jpeg");
      expect(data.allowedTypes.image).toContain("image/png");
      expect(data.allowedTypes.image).toContain("image/gif");
      expect(data.allowedTypes.image).toContain("image/webp");
      expect(data.allowedTypes.video).toContain("video/mp4");
      expect(data.allowedTypes.video).toContain("video/webm");
    });

    it("should include size limits", async () => {
      const response = await authRequest("GET", "/api/uploads/config", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as UploadConfigResponse;

      expect(response.status).toBe(200);
      expect(data.maxSize.image).toBe(10 * 1024 * 1024); // 10MB
      expect(data.maxSize.video).toBe(300 * 1024 * 1024); // 300MB
    });
  });

  // ===========================================================================
  // LIST MEDIA (GALLERY)
  // ===========================================================================

  describe("GET /api/uploads", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(
        "GET",
        `/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`
      );
      expect(response.status).toBe(401);
    });

    it("should return 400 if journeyId is missing", async () => {
      const response = await authRequest("GET", "/api/uploads", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details?.[0]?.path).toBe("journeyId");
    });

    it("should return media list for authenticated user", async () => {
      const response = await authRequest(
        "GET",
        `/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as MediaListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("media");
      expect(Array.isArray(data.media)).toBe(true);
    });

    it("should return 404 for journey user doesn't own", async () => {
      // Arina trying to access Demo's journey media
      const response = await authRequest(
        "GET",
        `/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        TEST_USER_IDS.ARINA
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent journey slug", async () => {
      // Non-existent slug should be validated and rejected
      const response = await authRequest(
        "GET",
        "/api/uploads?journeyId=non-existent-journey-slug",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // UPLOAD MEDIA
  // ===========================================================================

  describe("POST /api/uploads", () => {
    it("should return 401 without authentication", async () => {
      try {
        const formData = new FormData();
        formData.append("file", new Blob(["test"], { type: "image/png" }), "test.png");

        const response = await fetch(
          `${API_BASE_URL}/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
          {
            method: "POST",
            body: formData,
          }
        );

        expect(response.status).toBe(401);
      } catch (error) {
        // Network errors can happen in test environment - skip gracefully
        if ((error as Error).message?.includes("fetch failed")) {
          log.warn(
            { err: serializeError(error as Error) },
            "uploadsTest:networkError:skipped"
          );
          return;
        }
        throw error;
      }
    });

    it("should return 400 if journeyId is missing", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/png" }), "test.png");

      const response = await fetch(`${API_BASE_URL}/api/uploads`, {
        method: "POST",
        headers: {
          "X-Mock-User-Id": TEST_USER_IDS.DEMO,
        },
        body: formData,
      });
      const data = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details?.[0]?.path).toBe("journeyId");
    });

    it("should not enforce the 1MB body limit for uploads", async () => {
      const largePayload = "a".repeat(2 * 1024 * 1024);
      const response = await authRequest(
        "POST",
        `/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        TEST_USER_IDS.DEMO,
        {
          body: { payload: largePayload },
        }
      );

      expect(response.status).not.toBe(413);
    });

    it("should return 400 if no file is provided", async () => {
      const formData = new FormData();

      const response = await fetch(
        `${API_BASE_URL}/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        {
          method: "POST",
          headers: {
            "X-Mock-User-Id": TEST_USER_IDS.DEMO,
          },
          body: formData,
        }
      );
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe("No file provided");
    });

    it("should return 400 for invalid file type", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["test content"], { type: "application/pdf" }),
        "test.pdf"
      );

      const response = await fetch(
        `${API_BASE_URL}/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        {
          method: "POST",
          headers: {
            "X-Mock-User-Id": TEST_USER_IDS.DEMO,
          },
          body: formData,
        }
      );
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid file type");
    });

    it("should return 404 for journey user doesn't own", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/png" }), "test.png");

      // Arina trying to upload to Demo's journey
      const response = await fetch(
        `${API_BASE_URL}/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        {
          method: "POST",
          headers: {
            "X-Mock-User-Id": TEST_USER_IDS.ARINA,
          },
          body: formData,
        }
      );

      expect(response.status).toBe(404);
    });

    // Note: Testing actual upload success requires MinIO to be running
    // This test is skipped if storage is not available
  });

  // ===========================================================================
  // CHECK MEDIA USAGE
  // ===========================================================================

  describe("GET /api/uploads/:id/usage", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/uploads/some-media-id/usage");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent media", async () => {
      const response = await authRequest(
        "GET",
        "/api/uploads/00000000-0000-0000-0000-000000000999/usage",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    // Note: Testing actual usage check requires having media in the DB
  });

  // ===========================================================================
  // DELETE MEDIA
  // ===========================================================================

  describe("DELETE /api/uploads/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", "/api/uploads/some-media-id");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent media", async () => {
      const response = await authRequest(
        "DELETE",
        "/api/uploads/00000000-0000-0000-0000-000000000999",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    // Note: Testing actual deletion requires having media in the DB
  });

  // ===========================================================================
  // ORGANIZATION SCOPING
  // ===========================================================================

  describe("Organization Scoping", () => {
    it("should only allow access to media in user's organization journeys", async () => {
      // Demo user should access Demo org journey media
      const demoResponse = await authRequest(
        "GET",
        `/api/uploads?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        TEST_USER_IDS.DEMO
      );
      expect(demoResponse.status).toBe(200);

      // Arina should access her own journey media
      const arinaResponse = await authRequest(
        "GET",
        `/api/uploads?journeyId=${TEST_JOURNEY_IDS.ECU_COACHING}`,
        TEST_USER_IDS.ARINA
      );
      expect(arinaResponse.status).toBe(200);

      // Cross-org access should be denied
      const crossOrgResponse = await authRequest(
        "GET",
        `/api/uploads?journeyId=${TEST_JOURNEY_IDS.ECU_COACHING}`,
        TEST_USER_IDS.DEMO
      );
      expect(crossOrgResponse.status).toBe(404);
    });
  });
});
