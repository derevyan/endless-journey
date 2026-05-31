/**
 * Audio API Routes
 *
 * Provides endpoints for speech-to-text (STT) and text-to-speech (TTS).
 * Used by the voice chat feature in the mindstate builder.
 *
 * Endpoints:
 * - POST /api/llm/audio/transcribe - Speech-to-text
 * - POST /api/llm/audio/tts - Text-to-speech (complete audio)
 * - POST /api/llm/audio/tts/stream - Text-to-speech (streaming SSE)
 *
 * Auth: Protected (settings:read)
 *
 * @module modules/llm/routes/audio
 */

import { zValidator } from "@hono/zod-validator";
import { generateSpeech, generateSpeechIterator, transcribeAudio } from "@journey/llm/server";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, VoiceProfileSchema, type VoiceProfile } from "@journey/schemas";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import { createProtectedRouter } from "../../../lib/protected-router";

const log = createLogger("api:llm:audio");

export const audio = createProtectedRouter({
  defaultPermission: { resource: "settings", action: "read" },
});

// =============================================================================
// SCHEMAS
// =============================================================================

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(4096),
  voice: VoiceProfileSchema.optional(),
});

// =============================================================================
// POST /transcribe - Speech-to-Text
// =============================================================================

/**
 * Transcribe audio to text using OpenAI's gpt-4o-transcribe
 *
 * Accepts audio file via multipart/form-data
 * Returns JSON with transcript
 */
audio.post("/transcribe", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");

  const requestLog = log.child({ userId: user.id, orgId: organization.id });
  requestLog.debug({}, "audio:transcribe:start");

  // Get form data with audio file
  const formData = await c.req.formData();
  const audioFile = formData.get("audio");

  if (!audioFile || !(audioFile instanceof File)) {
    requestLog.warn({}, "audio:transcribe:missingFile");
    throw new BadRequestError("Audio file is required");
  }

  // Convert file to buffer
  const arrayBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate minimum file size (at least 1KB)
  if (buffer.length < 1000) {
    requestLog.warn({ size: buffer.length }, "audio:transcribe:tooSmall");
    throw new BadRequestError("Recording too short. Please hold the button longer.");
  }

  // Determine filename with proper extension based on MIME type
  let filename = audioFile.name || "audio.webm";
  if (!filename.includes(".")) {
    // Add extension based on MIME type if missing
    const ext = audioFile.type.includes("webm")
      ? "webm"
      : audioFile.type.includes("ogg")
        ? "ogg"
        : audioFile.type.includes("mp4")
          ? "mp4"
          : audioFile.type.includes("mpeg")
            ? "mp3"
            : "webm";
    filename = `audio.${ext}`;
  }

  // Log file details for debugging
  // webm magic bytes: 0x1A 0x45 0xDF 0xA3 (EBML header)
  const headerBytes = buffer.slice(0, 16).toString("hex");
  const isValidWebm = headerBytes.startsWith("1a45dfa3");
  requestLog.info(
    {
      filename,
      size: buffer.length,
      type: audioFile.type,
      headerBytes,
      isValidWebm,
    },
    "audio:transcribe:processing"
  );

  // Transcribe using LLM service
  const result = await transcribeAudio(buffer, filename, {
    organizationId: organization.id,
  });

  requestLog.info({ transcriptLength: result.transcript.length, duration: result.duration }, "audio:transcribe:success");

  return c.json({
    transcript: result.transcript,
    language: result.language,
    duration: result.duration,
  });
});

// =============================================================================
// POST /tts/stream - Text-to-Speech (Streaming)
// =============================================================================

/**
 * Generate streaming speech from text using OpenAI's gpt-4o-audio-preview
 *
 * Accepts JSON body with text and optional voice
 * Returns SSE stream with audio chunks (base64 encoded PCM16)
 */
audio.post("/tts/stream", zValidator("json", ttsRequestSchema), async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");

  const requestLog = log.child({ userId: user.id, orgId: organization.id });
  const { text, voice } = c.req.valid("json");

  requestLog.debug({ textLength: text.length, voice }, "audio:tts:stream:start");

  return streamSSE(c, async (stream) => {
    let chunkCount = 0;

    try {
      // Stream audio chunks from LLM service
      const audioIterator = generateSpeechIterator(text, {
        voice: voice as VoiceProfile,
        format: "pcm16",
        organizationId: organization.id,
      });

      for await (const chunk of audioIterator) {
        // Send audio chunk as SSE event (base64 encoded)
        const base64Chunk = Buffer.from(chunk).toString("base64");
        await stream.writeSSE({
          event: "audio_chunk",
          data: JSON.stringify({
            index: chunkCount,
            data: base64Chunk,
          }),
        });
        chunkCount++;
      }

      // Send completion event
      await stream.writeSSE({
        event: "audio_complete",
        data: JSON.stringify({
          totalChunks: chunkCount,
        }),
      });

      requestLog.info({ chunkCount }, "audio:tts:stream:complete");
    } catch (error) {
      requestLog.error({ err: serializeError(error) }, "audio:tts:stream:error");

      // Send error event
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          message: "Failed to generate speech",
        }),
      });
    }
  });
});

// =============================================================================
// POST /tts - Text-to-Speech (Non-streaming, complete audio)
// =============================================================================

/**
 * Generate complete speech audio from text using OpenAI's TTS
 *
 * Accepts JSON body with text and optional voice
 * Returns audio file (mp3)
 */
audio.post("/tts", zValidator("json", ttsRequestSchema), async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");

  const requestLog = log.child({ userId: user.id, orgId: organization.id });
  const { text, voice } = c.req.valid("json");

  requestLog.debug({ textLength: text.length, voice }, "audio:tts:start");

  // Generate complete audio using LLM service
  const audioBuffer = await generateSpeech(text, {
    voice: voice as VoiceProfile,
    organizationId: organization.id,
  });

  requestLog.info({ audioSize: audioBuffer.byteLength }, "audio:tts:success");

  // Return as audio file
  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.byteLength.toString(),
    },
  });
});
