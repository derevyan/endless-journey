/**
 * Audio Service Pricing Tests
 *
 * Integration tests for audio cost tracking functionality:
 * - STT: Format-aware duration estimation and cost calculation
 * - TTS: Character-based cost calculation for all 3 TTS functions
 * - Edge cases: Missing model, missing organizationId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks - must be created with vi.hoisted() so they're available when vi.mock() runs
const { mockRecordUsage, mockLogWarn, mockLogDebug, mockLogInfo, mockGetModelMetadata, streamMock } = vi.hoisted(
  () => ({
    mockRecordUsage: vi.fn(),
    mockLogWarn: vi.fn(),
    mockLogDebug: vi.fn(),
    mockLogInfo: vi.fn(),
    mockGetModelMetadata: vi.fn(),
    streamMock: vi.fn(),
  })
);

vi.mock("@journey/logger", () => ({
  createLogger: () => ({
    debug: mockLogDebug,
    info: mockLogInfo,
    warn: mockLogWarn,
    error: vi.fn(),
  }),
  serializeError: (err: Error) => ({ message: err.message }),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 123 })),
  createReadStream: vi.fn(() => ({ path: "/tmp/mock-audio" })),
  unlinkSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  tmpdir: () => "/tmp",
}));

// Mock getModelMetadata from @journey/schemas
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

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: streamMock,
  })),
}));

vi.mock("../../clients/openai", () => ({
  getOpenAIClient: vi.fn(),
}));

import { getOpenAIClient } from "../../clients/openai";
import { transcribeAudio, generateSpeech, generateSpeechStream, generateSpeechIterator } from "../audio-service";

describe("Audio Service Pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // STT Cost Calculation Tests
  // ===========================================================================

  describe("STT Cost Calculation", () => {
    beforeEach(() => {
      // Setup OpenAI mock for transcription
      vi.mocked(getOpenAIClient).mockReturnValue({
        audio: {
          transcriptions: {
            create: vi.fn().mockResolvedValue({ text: "transcribed text" }),
          },
        },
      } as any);
    });

    it("calculates cost using model registry perSecond rate", async () => {
      // Mock model with specific perSecond rate
      mockGetModelMetadata.mockReturnValue({
        id: "gpt-4o-transcribe",
        pricing: { input: 0, output: 0, perSecond: 0.0002 }, // $0.012/min
      });

      // 16000 bytes webm = 1 second at 16KB/s
      const audioBuffer = Buffer.alloc(16000);

      await transcribeAudio(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      const [usage] = mockRecordUsage.mock.calls[0];

      // 1 second × $0.0002/sec = $0.0002
      expect(usage.costUSD).toBeCloseTo(0.0002, 6);
    });

    it("estimates duration correctly for webm format (16KB/s)", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "gpt-4o-transcribe",
        pricing: { input: 0, output: 0, perSecond: 0.0001 },
      });

      // 32000 bytes = 2 seconds at 16KB/s
      const audioBuffer = Buffer.alloc(32000);

      await transcribeAudio(audioBuffer, "recording.webm", {
        organizationId: "org-123",
      });

      const [usage, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(2, 1);
      expect(usage.costUSD).toBeCloseTo(0.0002, 6); // 2 sec × $0.0001
    });

    it("estimates duration correctly for wav format (88.2KB/s)", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "gpt-4o-transcribe",
        pricing: { input: 0, output: 0, perSecond: 0.0001 },
      });

      // 88200 bytes = 1 second at 88.2KB/s for wav
      const audioBuffer = Buffer.alloc(88200);

      await transcribeAudio(audioBuffer, "recording.wav", {
        organizationId: "org-123",
      });

      const [usage, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(1, 1);
      expect(usage.costUSD).toBeCloseTo(0.0001, 6);
    });

    it("uses default perSecond rate when model not found", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      const audioBuffer = Buffer.alloc(16000); // 1 second

      await transcribeAudio(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      const [usage] = mockRecordUsage.mock.calls[0];
      // Default rate is $0.0001/sec
      expect(usage.costUSD).toBeCloseTo(0.0001, 6);
    });

    it("logs warning when model not in registry", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      const audioBuffer = Buffer.alloc(16000);

      await transcribeAudio(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o-transcribe" }),
        "openai:stt:modelNotFound:usingDefaultPricing"
      );
    });

    it("skips tracking when organizationId not provided", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "gpt-4o-transcribe",
        pricing: { input: 0, output: 0, perSecond: 0.0001 },
      });

      const audioBuffer = Buffer.alloc(16000);

      await transcribeAudio(audioBuffer, "test.webm", {
        // No organizationId
      });

      expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it("includes costUSD in usage metadata", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "gpt-4o-transcribe",
        pricing: { input: 0, output: 0, perSecond: 0.0001 },
      });

      const audioBuffer = Buffer.alloc(16000);

      await transcribeAudio(audioBuffer, "test.webm", {
        organizationId: "org-123",
      });

      const [, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.costUSD).toBeDefined();
      expect(context.metadata.costUSD).toBeCloseTo(0.0001, 6);
    });
  });

  // ===========================================================================
  // TTS Cost Calculation - generateSpeech (non-streaming)
  // ===========================================================================

  describe("TTS Cost Calculation - generateSpeech", () => {
    beforeEach(() => {
      vi.mocked(getOpenAIClient).mockReturnValue({
        audio: {
          speech: {
            create: vi.fn().mockResolvedValue({
              arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000)),
            }),
          },
        },
      } as any);
    });

    it("calculates cost from text length × perCharacter rate", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1-hd",
        pricing: { input: 0, output: 0, perCharacter: 0.00003 }, // $30/1M chars
      });

      const text = "Hello, world!"; // 13 characters

      await generateSpeech(text, {
        organizationId: "org-123",
        model: "tts-1-hd",
      });

      const [usage] = mockRecordUsage.mock.calls[0];
      // 13 chars × $0.00003/char = $0.00039
      expect(usage.costUSD).toBeCloseTo(0.00039, 6);
    });

    it("uses default perCharacter rate when model not found", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      const text = "Test message"; // 12 characters

      await generateSpeech(text, {
        organizationId: "org-123",
        model: "unknown-model",
      });

      const [usage] = mockRecordUsage.mock.calls[0];
      // Default rate is $0.000015/char (tts-1 rate)
      // 12 chars × $0.000015 = $0.00018
      expect(usage.costUSD).toBeCloseTo(0.00018, 6);
    });

    it("logs warning when model not in registry", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      await generateSpeech("test", {
        organizationId: "org-123",
        model: "unknown-tts-model",
      });

      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.objectContaining({ model: "unknown-tts-model" }),
        "openai:tts:modelNotFound:usingDefaultPricing"
      );
    });

    it("includes costUSD in usage metadata", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1",
        pricing: { input: 0, output: 0, perCharacter: 0.000015 },
      });

      await generateSpeech("Hello", {
        organizationId: "org-123",
      });

      const [, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.costUSD).toBeDefined();
      expect(context.module).toBe("tts");
    });

    it("skips tracking when organizationId not provided", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1",
        pricing: { input: 0, output: 0, perCharacter: 0.000015 },
      });

      await generateSpeech("Hello", {
        // No organizationId
      });

      expect(mockRecordUsage).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TTS Cost Calculation - generateSpeechStream
  // ===========================================================================

  describe("TTS Cost Calculation - generateSpeechStream", () => {
    beforeEach(() => {
      // Mock streaming response
      streamMock.mockResolvedValue(
        (async function* () {
          yield { additional_kwargs: { audio: { data: Buffer.from("a").toString("base64") } } };
          yield { additional_kwargs: { audio: { data: Buffer.from("b").toString("base64") } } };
        })()
      );
    });

    it("tracks usage with cost after streaming completes", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1",
        pricing: { input: 0, output: 0, perCharacter: 0.000015 },
      });

      const text = "Hello stream"; // 12 characters
      const callbacks = {
        onAudioChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      await generateSpeechStream(text, { organizationId: "org-123" }, callbacks);

      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      const [usage, context] = mockRecordUsage.mock.calls[0];

      // 12 chars × $0.000015 = $0.00018
      expect(usage.costUSD).toBeCloseTo(0.00018, 6);
      expect(context.module).toBe("tts-stream");
      expect(context.metadata.inputCharacters).toBe(12);
      expect(context.metadata.totalChunks).toBe(2);
    });

    it("calculates cost from text length × perCharacter rate", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1-hd",
        pricing: { input: 0, output: 0, perCharacter: 0.00003 },
      });

      const text = "A".repeat(1000); // 1000 characters
      const callbacks = {
        onAudioChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      await generateSpeechStream(text, { organizationId: "org-123", model: "tts-1-hd" }, callbacks);

      const [usage] = mockRecordUsage.mock.calls[0];
      // 1000 chars × $0.00003 = $0.03
      expect(usage.costUSD).toBeCloseTo(0.03, 4);
    });

    it("logs warning when model not in registry", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      const callbacks = {
        onAudioChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      await generateSpeechStream("test", { organizationId: "org-123", model: "fake-model" }, callbacks);

      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.objectContaining({ model: "fake-model" }),
        "openai:tts:stream:modelNotFound:usingDefaultPricing"
      );
    });

    it("skips tracking when organizationId not provided", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1",
        pricing: { input: 0, output: 0, perCharacter: 0.000015 },
      });

      const callbacks = {
        onAudioChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      await generateSpeechStream("Hello", {}, callbacks);

      expect(mockRecordUsage).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TTS Cost Calculation - generateSpeechIterator
  // ===========================================================================

  describe("TTS Cost Calculation - generateSpeechIterator", () => {
    beforeEach(() => {
      streamMock.mockResolvedValue(
        (async function* () {
          yield { additional_kwargs: { audio: { data: Buffer.from("x").toString("base64") } } };
          yield { additional_kwargs: { audio: { data: Buffer.from("y").toString("base64") } } };
        })()
      );
    });

    it("tracks usage with cost after iteration completes", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1",
        pricing: { input: 0, output: 0, perCharacter: 0.000015 },
      });

      const text = "Iterator test"; // 13 characters
      const chunks: Uint8Array[] = [];

      for await (const chunk of generateSpeechIterator(text, { organizationId: "org-123" })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(mockRecordUsage).toHaveBeenCalledTimes(1);

      const [usage, context] = mockRecordUsage.mock.calls[0];
      // 13 chars × $0.000015 = $0.000195
      expect(usage.costUSD).toBeCloseTo(0.000195, 6);
      expect(context.module).toBe("tts-stream");
      expect(context.metadata.inputCharacters).toBe(13);
    });

    it("calculates cost from text length × perCharacter rate", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "gpt-4o-mini-tts",
        pricing: { input: 0, output: 0, perCharacter: 0.000015 },
      });

      const text = "Test"; // 4 characters

      for await (const _ of generateSpeechIterator(text, { organizationId: "org-123", model: "gpt-4o-mini-tts" })) {
        // consume iterator
      }

      const [usage] = mockRecordUsage.mock.calls[0];
      // 4 chars × $0.000015 = $0.00006
      expect(usage.costUSD).toBeCloseTo(0.00006, 6);
    });

    it("logs warning when model not in registry", async () => {
      mockGetModelMetadata.mockReturnValue(undefined);

      for await (const _ of generateSpeechIterator("test", { organizationId: "org-123", model: "missing-model" })) {
        // consume iterator
      }

      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.objectContaining({ model: "missing-model" }),
        "openai:tts:stream:modelNotFound:usingDefaultPricing"
      );
    });

    it("skips tracking when organizationId not provided", async () => {
      mockGetModelMetadata.mockReturnValue({
        id: "tts-1",
        pricing: { input: 0, output: 0, perCharacter: 0.000015 },
      });

      for await (const _ of generateSpeechIterator("Hello", {})) {
        // consume iterator
      }

      expect(mockRecordUsage).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Format-specific Duration Estimation (via STT tests)
  // ===========================================================================

  describe("Format-specific Duration Estimation", () => {
    beforeEach(() => {
      vi.mocked(getOpenAIClient).mockReturnValue({
        audio: {
          transcriptions: {
            create: vi.fn().mockResolvedValue({ text: "text" }),
          },
        },
      } as any);

      mockGetModelMetadata.mockReturnValue({
        id: "gpt-4o-transcribe",
        pricing: { input: 0, output: 0, perSecond: 0.0001 },
      });
    });

    it("handles mp3 format (16KB/s)", async () => {
      const audioBuffer = Buffer.alloc(16000); // 1 second

      await transcribeAudio(audioBuffer, "audio.mp3", { organizationId: "org-123" });

      const [, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(1, 1);
    });

    it("handles ogg format (16KB/s)", async () => {
      const audioBuffer = Buffer.alloc(32000); // 2 seconds

      await transcribeAudio(audioBuffer, "audio.ogg", { organizationId: "org-123" });

      const [, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(2, 1);
    });

    it("handles flac format (100KB/s)", async () => {
      const audioBuffer = Buffer.alloc(100000); // 1 second

      await transcribeAudio(audioBuffer, "audio.flac", { organizationId: "org-123" });

      const [, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(1, 1);
    });

    it("handles m4a format (16KB/s)", async () => {
      const audioBuffer = Buffer.alloc(48000); // 3 seconds

      await transcribeAudio(audioBuffer, "audio.m4a", { organizationId: "org-123" });

      const [, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(3, 1);
    });

    it("uses default 16KB/s for unknown formats", async () => {
      const audioBuffer = Buffer.alloc(16000); // 1 second at default rate

      await transcribeAudio(audioBuffer, "audio.xyz", { organizationId: "org-123" });

      const [, context] = mockRecordUsage.mock.calls[0];
      expect(context.metadata.estimatedDurationSec).toBeCloseTo(1, 1);
    });
  });
});
