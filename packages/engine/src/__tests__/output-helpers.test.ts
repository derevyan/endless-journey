/**
 * Output Helpers Test Suite
 *
 * Tests for message metadata, media serialization, button serialization,
 * and timestamp creation utilities.
 */

import { describe, it, expect, vi } from "vitest";
import {
  createMessageMetadata,
  serializeMedia,
  serializeButtons,
  createTimestamp,
} from "../utils/output-helpers";

describe("Output Helpers", () => {
  describe("createMessageMetadata", () => {
    it("should create complete message metadata with all fields", () => {
      const content = "Hello, world!";
      const sendResult = { success: true };
      const validMedia = { type: "image", url: "https://example.com/img.jpg" };

      const result = createMessageMetadata(content, sendResult, validMedia, "sentAt");

      expect(result).toEqual({
        message: "Hello, world!",
        messageDelivered: true,
        mediaAttached: { type: "image", url: "https://example.com/img.jpg" },
        sentAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO timestamp
      });
    });

    it("should handle null content gracefully", () => {
      const sendResult = { success: true };

      const result = createMessageMetadata(undefined, sendResult, undefined, "sentAt");

      expect(result.message).toBeNull();
      expect(result.messageDelivered).toBe(true);
      expect(result.mediaAttached).toBeNull();
    });

    it("should handle message delivery failure", () => {
      const content = "Goodbye!";
      const sendResult = { success: false };

      const result = createMessageMetadata(content, sendResult, null, "sentAt");

      expect(result.message).toBe("Goodbye!");
      expect(result.messageDelivered).toBe(false);
    });

    it("should use custom timestamp field name", () => {
      const sendResult = { success: true };

      const result = createMessageMetadata(
        "Test",
        sendResult,
        null,
        "journeyStartedAt"
      );

      expect(result).toHaveProperty("journeyStartedAt");
      expect(result).not.toHaveProperty("sentAt");
      expect(result.journeyStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should generate valid ISO timestamp", () => {
      const sendResult = { success: true };
      const before = new Date();

      const result = createMessageMetadata("Test", sendResult, null, "ts");

      const after = new Date();
      const timestamp = new Date(result.ts as string);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("serializeMedia", () => {
    it("should serialize valid media object", () => {
      const media = { type: "video", url: "https://example.com/video.mp4", duration: 120 };

      const result = serializeMedia(media as { type: string; url: string });

      expect(result).toEqual({
        type: "video",
        url: "https://example.com/video.mp4",
      });
      expect(result).not.toHaveProperty("duration");
    });

    it("should return null for undefined media", () => {
      const result = serializeMedia(undefined);

      expect(result).toBeNull();
    });

    it("should return null for null media", () => {
      const result = serializeMedia(null);

      expect(result).toBeNull();
    });

    it("should preserve url with special characters", () => {
      const media = {
        type: "image",
        url: "https://example.com/path?query=value&other=123#anchor",
      };

      const result = serializeMedia(media);

      expect(result?.url).toBe("https://example.com/path?query=value&other=123#anchor");
    });
  });

  describe("serializeButtons", () => {
    it("should serialize button array extracting id and text only", () => {
      const buttons = [
        { id: "btn-1", text: "Click me", targetNodeId: "node-123", disabled: false },
        { id: "btn-2", text: "Submit", targetNodeId: "node-456", style: "primary" },
      ];

      const result = serializeButtons(buttons as Array<{ id: string; text: string; [key: string]: unknown }>);

      expect(result).toEqual([
        { id: "btn-1", text: "Click me" },
        { id: "btn-2", text: "Submit" },
      ]);
    });

    it("should return null for empty button array", () => {
      const result = serializeButtons([]);

      expect(result).toBeNull();
    });

    it("should return null for undefined buttons", () => {
      const result = serializeButtons(undefined);

      expect(result).toBeNull();
    });

    it("should handle buttons with special characters in text", () => {
      const buttons = [
        { id: "1", text: 'Click "here" & confirm!' },
        { id: "2", text: "Unicode: 你好 😀" },
      ];

      const result = serializeButtons(buttons as Array<{ id: string; text: string; [key: string]: unknown }>);

      expect(result).toHaveLength(2);
      expect(result?.[0].text).toBe('Click "here" & confirm!');
      expect(result?.[1].text).toBe("Unicode: 你好 😀");
    });

    it("should preserve order of buttons", () => {
      const buttons = [
        { id: "first", text: "A" },
        { id: "second", text: "B" },
        { id: "third", text: "C" },
      ];

      const result = serializeButtons(buttons as Array<{ id: string; text: string; [key: string]: unknown }>);

      expect(result?.map((b) => b.id)).toEqual(["first", "second", "third"]);
    });
  });

  describe("createTimestamp", () => {
    it("should create timestamp field with current time", () => {
      const before = new Date();

      const result = createTimestamp("executedAt");

      const after = new Date();

      expect(result).toHaveProperty("executedAt");
      expect(typeof result.executedAt).toBe("string");

      const timestamp = new Date(result.executedAt);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should use custom field name", () => {
      const result = createTimestamp("customTimestamp");

      expect(result).toHaveProperty("customTimestamp");
      expect(result).not.toHaveProperty("timestamp");
    });

    it("should generate valid ISO format timestamp", () => {
      const result = createTimestamp("ts");

      expect(result.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should handle various field names", () => {
      const names = ["sentAt", "journeyStartedAt", "expectedCompletionAt", "executedAt"];

      names.forEach((name) => {
        const result = createTimestamp(name);
        expect(result).toHaveProperty(name);
        expect(typeof result[name]).toBe("string");
      });
    });
  });
});
