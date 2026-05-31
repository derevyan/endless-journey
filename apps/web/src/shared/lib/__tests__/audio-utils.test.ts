/**
 * Audio Utilities Unit Tests
 *
 * Tests for audio processing helper functions.
 * These are pure functions with clear inputs/outputs.
 *
 * @module lib/__tests__/audio-utils
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
  pcm16ToFloat32,
  mergeAudioChunks,
  createAudioBufferFromPCM16,
  getSupportedMimeType,
  getExtensionFromMimeType,
  calculateAudioLevel,
  smoothAudioLevel,
  PCM16_CONFIG,
} from "../audio-utils";

describe("audio-utils", () => {
  // =============================================================================
  // BASE64 CONVERSION
  // =============================================================================

  describe("base64ToUint8Array", () => {
    it("should convert base64 string to Uint8Array", () => {
      // "Hello" in base64 is "SGVsbG8="
      const base64 = "SGVsbG8=";
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(5);
      expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]); // H, e, l, l, o
    });

    it("should handle empty string", () => {
      const result = base64ToUint8Array("");
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    it("should handle binary data", () => {
      // Binary data: [0, 1, 255, 128]
      const base64 = "AAH/gA==";
      const result = base64ToUint8Array(base64);

      expect(Array.from(result)).toEqual([0, 1, 255, 128]);
    });
  });

  describe("uint8ArrayToBase64", () => {
    it("should convert Uint8Array to base64 string", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = uint8ArrayToBase64(bytes);

      expect(result).toBe("SGVsbG8=");
    });

    it("should handle empty array", () => {
      const result = uint8ArrayToBase64(new Uint8Array([]));
      expect(result).toBe("");
    });

    it("should handle binary data", () => {
      const bytes = new Uint8Array([0, 1, 255, 128]);
      const result = uint8ArrayToBase64(bytes);
      expect(result).toBe("AAH/gA==");
    });

    it("should be reversible with base64ToUint8Array", () => {
      const original = new Uint8Array([10, 20, 30, 40, 50, 100, 200, 255]);
      const base64 = uint8ArrayToBase64(original);
      const restored = base64ToUint8Array(base64);

      expect(Array.from(restored)).toEqual(Array.from(original));
    });
  });

  // =============================================================================
  // PCM16 CONVERSION
  // =============================================================================

  describe("pcm16ToFloat32", () => {
    it("should convert PCM16 samples to Float32 normalized values", () => {
      // PCM16: 16-bit signed integers in little-endian
      // Max positive: 32767 (0x7FFF) -> should become ~1.0
      // Max negative: -32768 (0x8000) -> should become -1.0
      // Zero: 0 -> should become 0.0

      // Create PCM16 data: [0, 32767, -32768]
      const pcm16 = new Uint8Array([
        0x00, 0x00, // 0
        0xff, 0x7f, // 32767 (little-endian)
        0x00, 0x80, // -32768 (little-endian)
      ]);

      const result = pcm16ToFloat32(pcm16);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(0, 5);
      expect(result[1]).toBeCloseTo(32767 / 32768, 5); // ~0.99997
      expect(result[2]).toBeCloseTo(-1, 5);
    });

    it("should handle empty input", () => {
      const result = pcm16ToFloat32(new Uint8Array([]));
      expect(result.length).toBe(0);
    });

    it("should handle mid-range values", () => {
      // 16384 -> ~0.5, -16384 -> ~-0.5
      const pcm16 = new Uint8Array([
        0x00, 0x40, // 16384 (little-endian)
        0x00, 0xc0, // -16384 (little-endian)
      ]);

      const result = pcm16ToFloat32(pcm16);

      expect(result[0]).toBeCloseTo(0.5, 2);
      expect(result[1]).toBeCloseTo(-0.5, 2);
    });
  });

  // =============================================================================
  // CHUNK MERGING
  // =============================================================================

  describe("mergeAudioChunks", () => {
    it("should merge multiple chunks into single array", () => {
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5]);
      const chunk3 = new Uint8Array([6, 7, 8, 9]);

      const result = mergeAudioChunks([chunk1, chunk2, chunk3]);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(9);
      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("should handle empty array of chunks", () => {
      const result = mergeAudioChunks([]);
      expect(result.length).toBe(0);
    });

    it("should handle single chunk", () => {
      const chunk = new Uint8Array([1, 2, 3]);
      const result = mergeAudioChunks([chunk]);

      expect(Array.from(result)).toEqual([1, 2, 3]);
    });

    it("should handle empty chunks in array", () => {
      const chunk1 = new Uint8Array([1, 2]);
      const empty = new Uint8Array([]);
      const chunk2 = new Uint8Array([3, 4]);

      const result = mergeAudioChunks([chunk1, empty, chunk2]);

      expect(Array.from(result)).toEqual([1, 2, 3, 4]);
    });
  });

  // =============================================================================
  // MIME TYPE DETECTION
  // =============================================================================

  describe("getSupportedMimeType", () => {
    // Store original MediaRecorder if it exists
    const originalMediaRecorder = globalThis.MediaRecorder;

    beforeEach(() => {
      // Create mock MediaRecorder with isTypeSupported
      globalThis.MediaRecorder = {
        isTypeSupported: vi.fn(() => false),
      } as unknown as typeof MediaRecorder;
    });

    afterEach(() => {
      // Restore original
      if (originalMediaRecorder) {
        globalThis.MediaRecorder = originalMediaRecorder;
      }
    });

    it("should return a supported mime type", () => {
      (MediaRecorder.isTypeSupported as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        return type === "audio/webm;codecs=opus";
      });

      const result = getSupportedMimeType();
      expect(result).toBe("audio/webm;codecs=opus");
    });

    it("should fallback to empty string if none supported", () => {
      (MediaRecorder.isTypeSupported as ReturnType<typeof vi.fn>).mockImplementation(() => false);

      const result = getSupportedMimeType();
      expect(result).toBe("");
    });

    it("should try multiple types in order", () => {
      const triedTypes: string[] = [];
      (MediaRecorder.isTypeSupported as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        triedTypes.push(type);
        return type === "audio/mp4"; // Only mp4 supported
      });

      const result = getSupportedMimeType();
      expect(result).toBe("audio/mp4");
      expect(triedTypes).toContain("audio/webm;codecs=opus");
      expect(triedTypes).toContain("audio/webm");
      expect(triedTypes).toContain("audio/ogg;codecs=opus");
      expect(triedTypes).toContain("audio/mp4");
    });
  });

  describe("getExtensionFromMimeType", () => {
    it("should return webm for webm mime types", () => {
      expect(getExtensionFromMimeType("audio/webm")).toBe("webm");
      expect(getExtensionFromMimeType("audio/webm;codecs=opus")).toBe("webm");
    });

    it("should return ogg for ogg mime types", () => {
      expect(getExtensionFromMimeType("audio/ogg")).toBe("ogg");
      expect(getExtensionFromMimeType("audio/ogg;codecs=opus")).toBe("ogg");
    });

    it("should return mp4 for mp4 mime types", () => {
      expect(getExtensionFromMimeType("audio/mp4")).toBe("mp4");
    });

    it("should default to webm for unknown types", () => {
      expect(getExtensionFromMimeType("audio/unknown")).toBe("webm");
      expect(getExtensionFromMimeType("")).toBe("webm");
    });
  });

  // =============================================================================
  // AUDIO LEVEL CALCULATION
  // =============================================================================

  describe("calculateAudioLevel", () => {
    it("should return 0 for silence (all values at 128)", () => {
      const mockAnalyser = {
        getByteTimeDomainData: vi.fn((array: Uint8Array) => {
          // Fill with 128 (silence in time domain)
          array.fill(128);
        }),
      } as unknown as AnalyserNode;

      const dataArray = new Uint8Array(256);
      const level = calculateAudioLevel(mockAnalyser, dataArray);

      expect(level).toBe(0);
    });

    it("should return higher value for louder audio", () => {
      const mockAnalyser = {
        getByteTimeDomainData: vi.fn((array: Uint8Array) => {
          // Simulate loud audio - values swing between 0 and 255
          for (let i = 0; i < array.length; i++) {
            array[i] = i % 2 === 0 ? 0 : 255;
          }
        }),
      } as unknown as AnalyserNode;

      const dataArray = new Uint8Array(256);
      const level = calculateAudioLevel(mockAnalyser, dataArray);

      expect(level).toBeGreaterThan(0.5);
    });

    it("should clamp to max of 1", () => {
      const mockAnalyser = {
        getByteTimeDomainData: vi.fn((array: Uint8Array) => {
          // Extreme values
          for (let i = 0; i < array.length; i++) {
            array[i] = i % 2 === 0 ? 0 : 255;
          }
        }),
      } as unknown as AnalyserNode;

      const dataArray = new Uint8Array(256);
      const level = calculateAudioLevel(mockAnalyser, dataArray);

      expect(level).toBeLessThanOrEqual(1);
    });

    it("should return mid-range value for moderate audio", () => {
      const mockAnalyser = {
        getByteTimeDomainData: vi.fn((array: Uint8Array) => {
          // Moderate audio - values between 100 and 156 (±28 from center)
          for (let i = 0; i < array.length; i++) {
            array[i] = 128 + Math.sin(i * 0.1) * 28;
          }
        }),
      } as unknown as AnalyserNode;

      const dataArray = new Uint8Array(256);
      const level = calculateAudioLevel(mockAnalyser, dataArray);

      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThan(1);
    });
  });

  describe("smoothAudioLevel", () => {
    it("should interpolate between current and target", () => {
      const result = smoothAudioLevel(0, 1, 0.5);
      expect(result).toBe(0.5);
    });

    it("should use default smoothing factor of 0.3", () => {
      const result = smoothAudioLevel(0, 1);
      expect(result).toBe(0.3);
    });

    it("should smoothly increase level", () => {
      let level = 0;
      level = smoothAudioLevel(level, 1, 0.3);
      expect(level).toBeCloseTo(0.3, 5);

      level = smoothAudioLevel(level, 1, 0.3);
      expect(level).toBeCloseTo(0.51, 2);

      level = smoothAudioLevel(level, 1, 0.3);
      expect(level).toBeCloseTo(0.657, 2);
    });

    it("should smoothly decrease level", () => {
      let level = 1;
      level = smoothAudioLevel(level, 0, 0.3);
      expect(level).toBeCloseTo(0.7, 5);

      level = smoothAudioLevel(level, 0, 0.3);
      expect(level).toBeCloseTo(0.49, 2);
    });

    it("should return current level when target equals current", () => {
      const result = smoothAudioLevel(0.5, 0.5, 0.3);
      expect(result).toBe(0.5);
    });
  });

  // =============================================================================
  // AUDIO BUFFER CREATION
  // =============================================================================

  describe("createAudioBufferFromPCM16", () => {
    it("should create AudioBuffer from PCM16 data", () => {
      // Create a mock AudioContext
      const mockAudioBuffer = {
        getChannelData: vi.fn(() => new Float32Array(3)),
      };

      const mockAudioContext = {
        createBuffer: vi.fn(() => mockAudioBuffer),
      } as unknown as AudioContext;

      // PCM16 data: 3 samples
      const pcm16 = new Uint8Array([
        0x00, 0x00, // 0
        0xff, 0x7f, // 32767
        0x00, 0x80, // -32768
      ]);

      const result = createAudioBufferFromPCM16(mockAudioContext, pcm16);

      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(
        1, // mono
        3, // 3 samples
        PCM16_CONFIG.sampleRate
      );
      expect(result).toBe(mockAudioBuffer);
    });

    it("should use custom sample rate when provided", () => {
      const mockAudioBuffer = {
        getChannelData: vi.fn(() => new Float32Array(2)),
      };

      const mockAudioContext = {
        createBuffer: vi.fn(() => mockAudioBuffer),
      } as unknown as AudioContext;

      const pcm16 = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

      createAudioBufferFromPCM16(mockAudioContext, pcm16, 48000);

      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(1, 2, 48000);
    });
  });

  // =============================================================================
  // PCM16 CONFIG
  // =============================================================================

  describe("PCM16_CONFIG", () => {
    it("should have correct OpenAI audio config values", () => {
      expect(PCM16_CONFIG.sampleRate).toBe(24000);
      expect(PCM16_CONFIG.channels).toBe(1);
      expect(PCM16_CONFIG.bytesPerSample).toBe(2);
    });
  });
});
