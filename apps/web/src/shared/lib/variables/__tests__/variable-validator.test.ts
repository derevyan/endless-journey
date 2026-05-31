/**
 * Variable Validator - Unit Tests
 *
 * Tests for template variable validation and fuzzy suggestions.
 */

import { describe, expect, it } from "vitest";
import type { AvailableVariable } from "../variable-resolver";
import { validateTemplate, isValidVariablePath, extractVariablePaths } from "../variable-validator";

const createVar = (path: string, type: AvailableVariable["type"] = "string"): AvailableVariable => ({
  path,
  type,
  description: `Test variable: ${path}`,
  category: path.startsWith("user.") ? "user" : path.startsWith("nodes.") ? "nodes" : "builtin",
});

const availableVars: AvailableVariable[] = [
  createVar("user.firstName"),
  createVar("user.lastName"),
  createVar("user.email"),
  createVar("session.id"),
  createVar("session.status"),
  createVar("nodes.GetCustomer.email"),
  createVar("nodes.GetCustomer.name"),
  createVar("nodes.Welcome.message"),
  createVar("userResponse.value"),
];

describe("variable-validator", () => {
  // ===========================================================================
  // validateTemplate - Valid templates
  // ===========================================================================

  describe("validateTemplate - valid templates", () => {
    it("validates template with no variables", () => {
      const result = validateTemplate("Hello World!", availableVars);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates template with single valid variable", () => {
      const result = validateTemplate("Hello {{user.firstName}}!", availableVars);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates template with multiple valid variables", () => {
      const result = validateTemplate("{{user.firstName}} {{user.lastName}}", availableVars);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates template with nested node paths", () => {
      const result = validateTemplate("Customer: {{nodes.GetCustomer.email}}", availableVars);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ===========================================================================
  // validateTemplate - Invalid templates
  // ===========================================================================

  describe("validateTemplate - invalid templates", () => {
    it("detects undefined variable", () => {
      const result = validateTemplate("Hello {{user.middleName}}!", availableVars);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe("user.middleName");
      expect(result.errors[0].type).toBe("undefined_variable");
      expect(result.errors[0].message).toContain("not found");
    });

    it("provides position information for errors", () => {
      const result = validateTemplate("Hi {{badVar}} there", availableVars);

      expect(result.errors[0].position.start).toBe(3);
      expect(result.errors[0].position.end).toBe(13);
    });

    it("detects multiple undefined variables", () => {
      const result = validateTemplate("{{foo}} and {{bar}}", availableVars);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].path).toBe("foo");
      expect(result.errors[1].path).toBe("bar");
    });

    it("provides fuzzy suggestions for typos", () => {
      const result = validateTemplate("{{user.firstNme}}", availableVars);

      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestions.length).toBeGreaterThan(0);
      expect(result.errors[0].suggestions[0].path).toBe("user.firstName");
    });

    it("provides fuzzy suggestions for missing characters", () => {
      const result = validateTemplate("{{nodes.GetCustmer.email}}", availableVars);

      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestions.some((s) => s.path === "nodes.GetCustomer.email")).toBe(true);
    });

    it("limits suggestions to 3", () => {
      const result = validateTemplate("{{user}}", availableVars);

      expect(result.errors[0].suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  // ===========================================================================
  // validateTemplate - Edge cases
  // ===========================================================================

  describe("validateTemplate - edge cases", () => {
    it("handles empty template", () => {
      const result = validateTemplate("", availableVars);
      expect(result.valid).toBe(true);
    });

    it("handles whitespace in variable paths", () => {
      const result = validateTemplate("{{ user.firstName }}", availableVars);
      expect(result.valid).toBe(true);
    });

    it("handles empty available variables", () => {
      const result = validateTemplate("{{user.firstName}}", []);
      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestions).toHaveLength(0);
    });
  });

  // ===========================================================================
  // isValidVariablePath
  // ===========================================================================

  describe("isValidVariablePath", () => {
    it("returns true for valid path", () => {
      expect(isValidVariablePath("user.firstName", availableVars)).toBe(true);
    });

    it("returns false for invalid path", () => {
      expect(isValidVariablePath("user.middleName", availableVars)).toBe(false);
    });

    it("returns false for empty path", () => {
      expect(isValidVariablePath("", availableVars)).toBe(false);
    });
  });

  // ===========================================================================
  // extractVariablePaths
  // ===========================================================================

  describe("extractVariablePaths", () => {
    it("extracts single variable", () => {
      const paths = extractVariablePaths("Hello {{user.firstName}}!");
      expect(paths).toEqual(["user.firstName"]);
    });

    it("extracts multiple variables", () => {
      const paths = extractVariablePaths("{{user.firstName}} {{user.lastName}}");
      expect(paths).toEqual(["user.firstName", "user.lastName"]);
    });

    it("trims whitespace from paths", () => {
      const paths = extractVariablePaths("{{ user.firstName }}");
      expect(paths).toEqual(["user.firstName"]);
    });

    it("returns empty array for no variables", () => {
      const paths = extractVariablePaths("Hello World!");
      expect(paths).toEqual([]);
    });
  });
});
