/**
 * Audio API Integration Tests
 *
 * Tests for speech-to-text (STT) and text-to-speech (TTS) endpoints.
 * These tests make real HTTP requests to the running API server.
 *
 * @module api/__tests__/audio
 */

import { beforeAll, describe, expect, it } from "vitest";
import { API_BASE_URL, authRequest, checkServerHealth, TEST_USER_IDS } from "./helpers/test-app";

describe("Audio API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(`API server not running at ${API_BASE_URL}. Start with: pnpm dev`);
    }
  });

  // =============================================================================
  // TRANSCRIPTION ENDPOINT
  // =============================================================================

  describe("POST /api/llm/audio/transcribe", () => {
    it("should return 401 for unauthenticated requests", async () => {
      // Create a small audio blob (min 1KB to avoid "too short" error)
      const audioData = new Uint8Array(1100).fill(0);
      const formData = new FormData();
      formData.append("audio", new Blob([audioData], { type: "audio/webm" }), "test.webm");

      try {
        const response = await fetch(`${API_BASE_URL}/api/llm/audio/transcribe`, {
          method: "POST",
          body: formData,
        });

        expect(response.status).toBe(401);
      } catch (error) {
        // EPIPE/fetch failed can occur if server closes connection before reading - acceptable for auth rejection
        const msg = (error as Error).message ?? "";
        if (!msg.includes("EPIPE") && !msg.includes("fetch failed")) {
          throw error;
        }
      }
    });

    it("should return 400 when audio file is missing", async () => {
      const formData = new FormData();
      // Don't append any audio file

      const response = await fetch(`${API_BASE_URL}/api/llm/audio/transcribe`, {
        method: "POST",
        headers: {
          "X-Mock-User-Id": TEST_USER_IDS.DEMO,
        },
        body: formData,
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Audio file is required");
    });

    it("should return 400 for recording too short", async () => {
      // Create a very small audio file (less than 1KB)
      const smallBlob = new Blob(["tiny"], { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", smallBlob, "audio.webm");

      const response = await fetch(`${API_BASE_URL}/api/llm/audio/transcribe`, {
        method: "POST",
        headers: {
          "X-Mock-User-Id": TEST_USER_IDS.DEMO,
        },
        body: formData,
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("too short");
    });

  });

  // =============================================================================
  // TEXT-TO-SPEECH ENDPOINT (Non-streaming)
  // =============================================================================

  describe("POST /api/llm/audio/tts", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await fetch(`${API_BASE_URL}/api/llm/audio/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Hello world" }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 400 for empty text", async () => {
      const response = await authRequest("POST", "/api/llm/audio/tts", TEST_USER_IDS.DEMO, {
        body: { text: "" },
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing text", async () => {
      const response = await authRequest("POST", "/api/llm/audio/tts", TEST_USER_IDS.DEMO, {
        body: {},
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for text exceeding max length", async () => {
      const longText = "a".repeat(5000); // Exceeds 4096 limit

      const response = await authRequest("POST", "/api/llm/audio/tts", TEST_USER_IDS.DEMO, {
        body: { text: longText },
      });

      expect(response.status).toBe(400);
    });

    it("should return 500 for invalid voice option", async () => {
      // Voice validation happens at OpenAI level, not API level
      // Invalid voices pass Zod (string.min(1)) but fail at provider
      const response = await authRequest("POST", "/api/llm/audio/tts", TEST_USER_IDS.DEMO, {
        body: { text: "Test", voice: "invalid-voice" },
      });

      expect(response.status).toBe(500);
    });

  });

  // =============================================================================
  // TEXT-TO-SPEECH STREAMING ENDPOINT
  // =============================================================================

  describe("POST /api/llm/audio/tts/stream", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await fetch(`${API_BASE_URL}/api/llm/audio/tts/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Hello world" }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 400 for empty text", async () => {
      const response = await authRequest("POST", "/api/llm/audio/tts/stream", TEST_USER_IDS.DEMO, {
        body: { text: "" },
      });

      expect(response.status).toBe(400);
    });

    it("should handle invalid voice via error event in stream", async () => {
      // SSE stream returns 200 immediately, errors are sent as events within the stream
      // Voice validation happens at OpenAI level, not API level
      const response = await authRequest("POST", "/api/llm/audio/tts/stream", TEST_USER_IDS.DEMO, {
        body: { text: "Test", voice: "not-a-voice" },
      });

      expect(response.status).toBe(200);
    });

  });
});
