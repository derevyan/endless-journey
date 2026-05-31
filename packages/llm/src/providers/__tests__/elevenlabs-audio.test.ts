/**
 * ElevenLabs Audio Provider Tests
 *
 * Integration tests for ElevenLabs TTS and STT providers:
 * - Cost calculation with model registry pricing
 * - Fallback pricing when model not found
 * - Usage tracking with correct metadata
 *
 * @module providers/__tests__/elevenlabs-audio.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted mocks
const { mockRecordUsage, mockLogWarn, mockLogDebug, mockLogInfo, mockLogError, mockGetModelMetadata } = vi.hoisted(
  () => ({
    mockRecordUsage: vi.fn(),
    mockLogWarn: vi.fn(),
    mockLogDebug: vi.fn(),
    mockLogInfo: vi.fn(),
    mockLogError: vi.fn(),
    mockGetModelMetadata: vi.fn(),
  })
);

// Mock logger
vi.mock("@journey/logger", () => ({
  createLogger: () => ({
    debug: mockLogDebug,
    info: mockLogInfo,
    warn: mockLogWarn,
    error: mockLogError,
  }),
  serializeError: (err: Error) => ({ message: err.message }),
}));

// Mock getModelMetadata
vi.mock("@journey/schemas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@journey/schemas")>();
  return {
    ...actual,
    getModelMetadata: mockGetModelMetadata,
  };
});

// Mock usage tracking adapter
vi.mock("../../adapters/usage-tracking-context", () => ({
  getUsageTrackingAdapter: () => ({
    isReady: () => true,
    recordUsage: mockRecordUsage,
  }),
}));

// Mock ElevenLabs client
vi.mock("../../clients/elevenlabs", () => ({
  ELEVENLABS_BASE_URL: "https://api.elevenlabs.io/v1",
  getElevenLabsApiKey: () => "test-api-key",
  getElevenLabsHeaders: () => ({
    "xi-api-key": "test-api-key",
    "Content-Type": "application/json",
  }),
  mapToElevenLabsFormat: (format: string) => {
    const map: Record<string, string> = {
      mp3: "mp3_44100_128",
      opus: "opus_48000_64",
    };
    return map[format] ?? "mp3_44100_128";
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { ElevenLabsSTTProvider, ElevenLabsTTSProvider } from "../elevenlabs-audio";

describe("ElevenLabs Audio Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // ElevenLabs TTS Provider Tests
  // ===========================================================================

  describe("ElevenLabsTTSProvider", () => {
    let provider: ElevenLabsTTSProvider;

    beforeEach(() => {
      provider = new ElevenLabsTTSProvider();
      // Mock successful TTS response
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10000)),
      });
    });

    it("calculates cost using perCharacter rate from model registry", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "eleven_multilingual_v2",
        pricing: { input: 0, output: 0, perCharacter: 0.000167 },
      });

      const text = "Hello, world!"; // 13 characters

      await provider.speak(text, {
        organizationId: "org-123",
        model: "eleven_multilingual_v2",
        voice: "test-voice-id",
      });

      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      const [usage] = mockRecordUsage.mock.calls[0];

      // 13 chars × $0.000167/char = $0.002171
      expect(usage.costUSD).toBeCloseTo(0.002171, 5);
    });

    it("tracks usage with correct metadata", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "eleven_multilingual_v2",
        pricing: { input: 0, output: 0, perCharacter: 0.000167 },
      });

      await provider.speak("Test message", {
        organizationId: "org-123",
        voice: "test-voice-id",
      });

      const [, context] = mockRecordUsage.mock.calls[0];

      expect(context.organizationId).toBe("org-123");
      expect(context.service).toBe("audio-service");
      expect(context.module).toBe("tts");
      expect(context.provider).toBe("elevenlabs");
      expect(context.metadata.inputCharacters).toBe(12);
      expect(context.metadata.voice).toBe("test-voice-id");
      expect(context.metadata.costUSD).toBeDefined();
    });

    it("falls back to default rate ($0.000167/char) when model not found", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      const text = "A".repeat(1000); // 1000 characters

      await provider.speak(text, {
        organizationId: "org-123",
        model: "unknown-model",
        voice: "test-voice-id",
      });

      const [usage] = mockRecordUsage.mock.calls[0];

      // 1000 chars × $0.000167/char = $0.167
      expect(usage.costUSD).toBeCloseTo(0.167, 3);
    });

    it("logs warning when model not in registry", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      await provider.speak("test", {
        organizationId: "org-123",
        model: "fake-model",
        voice: "test-voice-id",
      });

      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.objectContaining({ model: "fake-model" }),
        "elevenlabs:tts:modelNotFound:usingDefaultPricing"
      );
    });

    it("skips tracking when organizationId not provided", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "eleven_multilingual_v2",
        pricing: { input: 0, output: 0, perCharacter: 0.000167 },
      });

      await provider.speak("Hello", {
        voice: "test-voice-id",
        // No organizationId
      });

      expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it("handles API error gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      });

      await expect(
        provider.speak("test", { organizationId: "org-123", voice: "test-voice-id" })
      ).rejects.toThrow("ElevenLabs TTS failed: 401");
    });
  });

  // ===========================================================================
  // ElevenLabs STT Provider Tests
  // ===========================================================================

  describe("ElevenLabsSTTProvider", () => {
    let provider: ElevenLabsSTTProvider;

    beforeEach(() => {
      provider = new ElevenLabsSTTProvider();
      // Mock successful STT response
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: "transcribed text",
          language_code: "en",
          audio_duration: 5.0, // 5 seconds
        }),
      });
    });

    it("calculates cost using perSecond rate from model registry", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "scribe_v1",
        pricing: { input: 0, output: 0, perSecond: 0.000167 },
      });

      const audioBuffer = Buffer.alloc(16000); // ~1 second at 16KB/s

      await provider.transcribe(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      const [usage] = mockRecordUsage.mock.calls[0];

      // 5 seconds (from API) × $0.000167/sec = $0.000835
      expect(usage.costUSD).toBeCloseTo(0.000835, 5);
    });

    it("uses audio_duration from API response when available", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "scribe_v1",
        pricing: { input: 0, output: 0, perSecond: 0.000167 },
      });

      // API returns audio_duration: 5.0 seconds
      const audioBuffer = Buffer.alloc(160000); // Would be ~10 seconds estimated

      await provider.transcribe(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      const [, context] = mockRecordUsage.mock.calls[0];

      // Should use API duration (5 sec), not estimated (10 sec)
      expect(context.metadata.estimatedDurationSec).toBe(5.0);
    });

    it("estimates duration from file size when API duration not available", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "scribe_v1",
        pricing: { input: 0, output: 0, perSecond: 0.000167 },
      });

      // Mock response without audio_duration
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: "transcribed text",
          language_code: "en",
          // No audio_duration
        }),
      });

      const audioBuffer = Buffer.alloc(32000); // ~2 seconds at 16KB/s

      await provider.transcribe(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      const [, context] = mockRecordUsage.mock.calls[0];

      // Estimated: 32000 / 16000 = 2 seconds
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(2, 1);
    });

    it("tracks usage with correct metadata", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "scribe_v1",
        pricing: { input: 0, output: 0, perSecond: 0.000167 },
      });

      const audioBuffer = Buffer.alloc(16000);

      await provider.transcribe(audioBuffer, "test.webm", {
        organizationId: "org-123",
        language: "en",
      });

      const [, context] = mockRecordUsage.mock.calls[0];

      expect(context.organizationId).toBe("org-123");
      expect(context.service).toBe("audio-service");
      expect(context.module).toBe("stt");
      expect(context.provider).toBe("elevenlabs");
      expect(context.metadata.audioSizeBytes).toBe(16000);
      expect(context.metadata.transcriptLength).toBe(16); // "transcribed text".length
      expect(context.metadata.costUSD).toBeDefined();
    });

    it("falls back to default rate ($0.000167/sec) when model not found", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      // Mock response with 10 second duration
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: "long transcription",
          audio_duration: 10.0,
        }),
      });

      const audioBuffer = Buffer.alloc(16000);

      await provider.transcribe(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      const [usage] = mockRecordUsage.mock.calls[0];

      // 10 sec × $0.000167/sec = $0.00167
      expect(usage.costUSD).toBeCloseTo(0.00167, 4);
    });

    it("logs warning when model not in registry", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      const audioBuffer = Buffer.alloc(16000);

      await provider.transcribe(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.objectContaining({ model: "scribe_v1" }),
        "elevenlabs:stt:modelNotFound:usingDefaultPricing"
      );
    });

    it("skips tracking when organizationId not provided", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "scribe_v1",
        pricing: { input: 0, output: 0, perSecond: 0.000167 },
      });

      const audioBuffer = Buffer.alloc(16000);

      await provider.transcribe(audioBuffer, "test.webm", {
        // No organizationId
      });

      expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it("handles API error gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad request"),
      });

      const audioBuffer = Buffer.alloc(16000);

      await expect(
        provider.transcribe(audioBuffer, "test.webm", { organizationId: "org-123" })
      ).rejects.toThrow("ElevenLabs STT failed: 400");
    });
  });

  // ===========================================================================
  // Pricing Accuracy Tests
  // ===========================================================================

  describe("Pricing Accuracy", () => {
    it("TTS: 1000 chars at Starter tier should cost ~$0.167", async () => {
      const provider = new ElevenLabsTTSProvider();

      mockGetModelMetadata.mockReturnValue({
        id: "eleven_multilingual_v2",
        pricing: { input: 0, output: 0, perCharacter: 0.000167 },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10000)),
      });

      await provider.speak("A".repeat(1000), { organizationId: "org-123", voice: "test-voice-id" });

      const [usage] = mockRecordUsage.mock.calls[0];
      expect(usage.costUSD).toBeCloseTo(0.167, 3);
    });

    it("STT: 60 seconds (1 minute) should cost ~$0.01", async () => {
      const provider = new ElevenLabsSTTProvider();

      mockGetModelMetadata.mockReturnValue({
        id: "scribe_v1",
        pricing: { input: 0, output: 0, perSecond: 0.000167 },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: "transcribed text",
          audio_duration: 60.0, // 1 minute
        }),
      });

      await provider.transcribe(Buffer.alloc(16000), "test.webm", {
        organizationId: "org-123",
      });

      const [usage] = mockRecordUsage.mock.calls[0];
      // 60 sec × $0.000167 = $0.01002
      expect(usage.costUSD).toBeCloseTo(0.01, 2);
    });
  });
});
