/**
 * Audio Utilities
 *
 * Helper functions for audio processing, conversion, and playback.
 *
 * @module lib/audio-utils
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** PCM16 audio configuration */
export const PCM16_CONFIG = {
  sampleRate: 24000, // OpenAI uses 24kHz for audio
  channels: 1,
  bytesPerSample: 2,
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface AudioChunk {
  index: number;
  data: string; // Base64 encoded PCM16 data
}

// =============================================================================
// CONVERSION UTILITIES
// =============================================================================

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert PCM16 data to Float32 samples for AudioContext
 *
 * PCM16 is signed 16-bit integers (-32768 to 32767)
 * Float32 is normalized floats (-1.0 to 1.0)
 */
export function pcm16ToFloat32(pcm16: Uint8Array): Float32Array {
  const numSamples = pcm16.length / 2;
  const float32 = new Float32Array(numSamples);
  const dataView = new DataView(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);

  for (let i = 0; i < numSamples; i++) {
    // Read as signed 16-bit integer (little endian)
    const sample = dataView.getInt16(i * 2, true);
    // Normalize to [-1, 1]
    float32[i] = sample / 32768;
  }

  return float32;
}

/**
 * Merge multiple audio chunks into a single Uint8Array
 */
export function mergeAudioChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

// =============================================================================
// AUDIO CONTEXT UTILITIES
// =============================================================================

/**
 * Create an AudioBuffer from PCM16 data
 */
export function createAudioBufferFromPCM16(
  audioContext: AudioContext,
  pcm16: Uint8Array,
  sampleRate: number = PCM16_CONFIG.sampleRate
): AudioBuffer {
  const float32 = pcm16ToFloat32(pcm16);
  const audioBuffer = audioContext.createBuffer(1, float32.length, sampleRate);
  audioBuffer.getChannelData(0).set(float32);
  return audioBuffer;
}

// =============================================================================
// MEDIA RECORDER UTILITIES
// =============================================================================

/**
 * Get supported audio MIME type for MediaRecorder
 */
export function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Fallback - let browser decide
  return "";
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  return "webm"; // Default fallback
}

// =============================================================================
// AUDIO LEVEL UTILITIES
// =============================================================================

/**
 * Calculate audio level (0-1) from AnalyserNode time domain data
 * Uses RMS (root mean square) for accurate volume measurement
 */
export function calculateAudioLevel(analyser: AnalyserNode, dataArray: Uint8Array): number {
  // Use time domain data - more responsive for voice input
  analyser.getByteTimeDomainData(dataArray);

  // Calculate RMS (root mean square) of the waveform
  let sumSquares = 0;
  for (let i = 0; i < dataArray.length; i++) {
    // Convert from 0-255 range to -1 to 1 range (128 is silence)
    const normalized = (dataArray[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / dataArray.length);
  // Scale up for better visual feedback (voice is typically quiet)
  return Math.min(1, rms * 3);
}

/**
 * Smooth audio level changes for visual display
 */
export function smoothAudioLevel(
  currentLevel: number,
  targetLevel: number,
  smoothingFactor: number = 0.3
): number {
  return currentLevel + (targetLevel - currentLevel) * smoothingFactor;
}
