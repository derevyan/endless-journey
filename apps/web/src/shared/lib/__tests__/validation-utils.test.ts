/**
 * Tests for validation utilities
 *
 * Tests the shared validation error extraction utilities used by all form hooks.
 *
 * @module shared/lib/__tests__/validation-utils.test
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractZodErrors, createArrayFieldErrorGetter } from "../validation-utils";

describe("validation-utils", () => {
  describe("extractZodErrors", () => {
    it("should extract single field error with correct path", () => {
      const schema = z.object({ name: z.string().min(1, "Name is required") });

      try {
        schema.parse({ name: "" });
        expect.fail("Should have thrown ZodError");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = extractZodErrors(error);

          expect(errors.size).toBe(1);
          expect(errors.get("name")).toBe("Name is required");
        }
      }
    });

    it("should extract nested field errors with dot notation path", () => {
      const schema = z.object({
        config: z.object({
          url: z.string().url("Invalid URL"),
        }),
      });

      try {
        schema.parse({ config: { url: "not-a-url" } });
        expect.fail("Should have thrown ZodError");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = extractZodErrors(error);

          expect(errors.size).toBe(1);
          expect(errors.get("config.url")).toBe("Invalid URL");
        }
      }
    });

    it("should extract array field errors with index in path", () => {
      const schema = z.object({
        buttons: z.array(
          z.object({
            text: z.string().min(1, "Button text is required"),
          })
        ),
      });

      try {
        schema.parse({ buttons: [{ text: "" }, { text: "Valid" }, { text: "" }] });
        expect.fail("Should have thrown ZodError");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = extractZodErrors(error);

          expect(errors.size).toBe(2);
          expect(errors.get("buttons.0.text")).toBe("Button text is required");
          expect(errors.get("buttons.2.text")).toBe("Button text is required");
          expect(errors.get("buttons.1.text")).toBeUndefined();
        }
      }
    });

    it("should extract multiple errors from different fields", () => {
      const schema = z.object({
        label: z.string().min(1, "Label is required"),
        url: z.string().url("Invalid URL"),
      });

      try {
        schema.parse({ label: "", url: "bad" });
        expect.fail("Should have thrown ZodError");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = extractZodErrors(error);

          expect(errors.size).toBe(2);
          expect(errors.get("label")).toBe("Label is required");
          expect(errors.get("url")).toBe("Invalid URL");
        }
      }
    });

    it("should handle deeply nested paths", () => {
      const schema = z.object({
        questions: z.array(
          z.object({
            buttons: z.array(
              z.object({
                text: z.string().min(1, "Required"),
              })
            ),
          })
        ),
      });

      try {
        schema.parse({ questions: [{ buttons: [{ text: "" }] }] });
        expect.fail("Should have thrown ZodError");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = extractZodErrors(error);

          expect(errors.get("questions.0.buttons.0.text")).toBe("Required");
        }
      }
    });
  });

  describe("createArrayFieldErrorGetter", () => {
    it("should return error for matching index and field", () => {
      const errors = new Map([
        ["buttons.0.text", "Button 0 text is required"],
        ["buttons.1.text", "Button 1 text is required"],
      ]);

      const getButtonError = createArrayFieldErrorGetter(errors, "buttons");

      expect(getButtonError(0, "text")).toBe("Button 0 text is required");
      expect(getButtonError(1, "text")).toBe("Button 1 text is required");
    });

    it("should return undefined for non-matching index", () => {
      const errors = new Map([["buttons.0.text", "Error"]]);

      const getButtonError = createArrayFieldErrorGetter(errors, "buttons");

      expect(getButtonError(1, "text")).toBeUndefined();
      expect(getButtonError(2, "text")).toBeUndefined();
    });

    it("should return undefined for non-matching field", () => {
      const errors = new Map([["buttons.0.text", "Error"]]);

      const getButtonError = createArrayFieldErrorGetter(errors, "buttons");

      expect(getButtonError(0, "value")).toBeUndefined();
      expect(getButtonError(0, "label")).toBeUndefined();
    });

    it("should work without field parameter for array-level errors", () => {
      const errors = new Map([
        ["headers.0", "Header 0 is invalid"],
        ["headers.1", "Header 1 is invalid"],
      ]);

      const getHeaderError = createArrayFieldErrorGetter(errors, "headers");

      expect(getHeaderError(0)).toBe("Header 0 is invalid");
      expect(getHeaderError(1)).toBe("Header 1 is invalid");
      expect(getHeaderError(2)).toBeUndefined();
    });

    it("should return undefined when validationErrors is undefined", () => {
      const getError = createArrayFieldErrorGetter(undefined, "buttons");

      expect(getError(0, "text")).toBeUndefined();
      expect(getError(1, "text")).toBeUndefined();
    });

    it("should handle different prefixes independently", () => {
      const errors = new Map([
        ["buttons.0.text", "Button error"],
        ["headers.0.key", "Header error"],
        ["questions.0.content", "Question error"],
      ]);

      const getButtonError = createArrayFieldErrorGetter(errors, "buttons");
      const getHeaderError = createArrayFieldErrorGetter(errors, "headers");
      const getQuestionError = createArrayFieldErrorGetter(errors, "questions");

      expect(getButtonError(0, "text")).toBe("Button error");
      expect(getHeaderError(0, "key")).toBe("Header error");
      expect(getQuestionError(0, "content")).toBe("Question error");

      // Cross-contamination check
      expect(getButtonError(0, "key")).toBeUndefined();
      expect(getHeaderError(0, "text")).toBeUndefined();
    });
  });

  describe("integration: extractZodErrors + createArrayFieldErrorGetter", () => {
    it("should work together for form validation workflow", () => {
      const schema = z.object({
        buttons: z.array(
          z.object({
            text: z.string().min(1, "Button text is required"),
          })
        ),
      });

      try {
        schema.parse({ buttons: [{ text: "" }, { text: "Valid" }, { text: "" }] });
        expect.fail("Should have thrown ZodError");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = extractZodErrors(error);
          const getButtonError = createArrayFieldErrorGetter(errors, "buttons");

          // First button has error
          expect(getButtonError(0, "text")).toBe("Button text is required");

          // Second button is valid
          expect(getButtonError(1, "text")).toBeUndefined();

          // Third button has error
          expect(getButtonError(2, "text")).toBe("Button text is required");
        }
      }
    });
  });
});
