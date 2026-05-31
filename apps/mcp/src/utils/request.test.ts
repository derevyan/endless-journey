import { describe, it, expect } from "vitest";
import {
  parseListRequest,
  validateRequiredString,
  validateOptionalObject,
  validateRequestOptions,
} from "./request";

describe("parseListRequest", () => {
  it("returns ok for empty body", () => {
    const result = parseListRequest({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.servers).toBeUndefined();
      expect(result.options).toBeUndefined();
    }
  });

  it("returns ok for valid servers array", () => {
    const result = parseListRequest({ servers: ["a", "b"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.servers).toEqual(["a", "b"]);
    }
  });

  it("returns error for non-array servers", () => {
    const result = parseListRequest({ servers: "not-array" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("servers must be an array");
    }
  });

  it("returns error for servers with non-strings", () => {
    const result = parseListRequest({ servers: ["a", 1] });
    expect(result.ok).toBe(false);
  });

  it("returns ok for valid options", () => {
    const result = parseListRequest({ options: { headers: { Authorization: "Bearer token" } } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.options?.headers).toEqual({ Authorization: "Bearer token" });
    }
  });

  it("returns error for non-object options", () => {
    const result = parseListRequest({ options: "not-object" });
    expect(result.ok).toBe(false);
  });

  it("returns error for invalid headers", () => {
    const result = parseListRequest({ options: { headers: { key: 123 } } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("headers must be a string map");
    }
  });
});

describe("validateRequiredString", () => {
  it("returns ok for valid string", () => {
    const result = validateRequiredString("value", "field");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("value");
    }
  });

  it("returns error for undefined", () => {
    const result = validateRequiredString(undefined, "field");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("field is required");
    }
  });

  it("returns error for empty string", () => {
    const result = validateRequiredString("", "field");
    expect(result.ok).toBe(false);
  });

  it("returns error for non-string", () => {
    const result = validateRequiredString(123, "field");
    expect(result.ok).toBe(false);
  });
});

describe("validateOptionalObject", () => {
  it("returns ok for undefined", () => {
    const result = validateOptionalObject(undefined, "field");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it("returns ok for valid object", () => {
    const result = validateOptionalObject({ key: "value" }, "field");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ key: "value" });
    }
  });

  it("returns error for non-object", () => {
    const result = validateOptionalObject("string", "field");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("field must be an object");
    }
  });

  it("returns error for array", () => {
    const result = validateOptionalObject([], "field");
    expect(result.ok).toBe(false);
  });
});

describe("validateRequestOptions", () => {
  it("returns ok for undefined", () => {
    const result = validateRequestOptions(undefined);
    expect(result.ok).toBe(true);
  });

  it("returns ok for valid options", () => {
    const result = validateRequestOptions({ headers: { key: "value" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.options?.headers).toEqual({ key: "value" });
    }
  });

  it("returns error for invalid headers", () => {
    const result = validateRequestOptions({ headers: { key: 123 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("headers must be a string map");
    }
  });

  it("returns error for non-object options", () => {
    const result = validateRequestOptions("string");
    expect(result.ok).toBe(false);
  });
});
