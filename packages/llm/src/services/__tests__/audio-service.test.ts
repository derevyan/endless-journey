/**
 * Audio Service Tests
 *
 * Covers transcription flow and streaming audio decoding.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@journey/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
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

const streamMock = vi.hoisted(() => vi.fn());

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: streamMock,
  })),
}));

vi.mock("../../clients/openai", () => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("../usage-tracking-service", () => ({
  usageTrackingService: {
    recordUsage: vi.fn(),
  },
}));

import * as fs from "node:fs";
import { getOpenAIClient } from "../../clients/openai";
import { transcribeAudio, generateSpeechStream, generateSpeechIterator, generateSpeech } from "../audio-service";

describe("Audio Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transcribes audio and cleans up temp file", async () => {
    const transcribeCreate = vi.fn().mockResolvedValue({ text: "hello world" });
    vi.mocked(getOpenAIClient).mockReturnValue({
      audio: {
        transcriptions: {
          create: transcribeCreate,
        },
      },
    } as any);

    const result = await transcribeAudio(Buffer.from("audio"), "sample.wav", {
      language: "en",
      prompt: "Please transcribe",
    });

    expect(result.transcript).toBe("hello world");
    expect(transcribeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-transcribe",
        language: "en",
        prompt: "Please transcribe",
      })
    );
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it("streams audio chunks and decodes base64", async () => {
    const chunks = [
      { additional_kwargs: { audio: { data: Buffer.from("a").toString("base64") } } },
      { additional_kwargs: { audio: { data: Buffer.from("b").toString("base64") } } },
    ];
    streamMock.mockResolvedValue((async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })());

    const received: Uint8Array[] = [];
    const callbacks = {
      onAudioChunk: (chunk: Uint8Array) => {
        received.push(chunk);
      },
      onComplete: vi.fn(),
      onError: vi.fn(),
    };

    await generateSpeechStream("hello", {}, callbacks);

    expect(received).toHaveLength(2);
    expect(Buffer.from(received[0]).toString()).toBe("a");
    expect(Buffer.from(received[1]).toString()).toBe("b");
    expect(callbacks.onComplete).toHaveBeenCalledWith(2);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("yields audio chunks from iterator", async () => {
    const chunks = [
      { additional_kwargs: { audio: { data: Buffer.from("x").toString("base64") } } },
      { additional_kwargs: { audio: { data: Buffer.from("y").toString("base64") } } },
    ];
    streamMock.mockResolvedValue((async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })());

    const received: Uint8Array[] = [];
    for await (const chunk of generateSpeechIterator("hello")) {
      received.push(chunk);
    }

    expect(received).toHaveLength(2);
    expect(Buffer.from(received[0]).toString()).toBe("x");
    expect(Buffer.from(received[1]).toString()).toBe("y");
  });

  it("returns full audio buffer for non-streaming TTS", async () => {
    const arrayBuffer = new ArrayBuffer(4);
    vi.mocked(getOpenAIClient).mockReturnValue({
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({
            arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
          }),
        },
      },
    } as any);

    const result = await generateSpeech("hello");

    expect(result).toBe(arrayBuffer);
  });
});
