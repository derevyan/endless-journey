/**
 * Variable Resolver Tests
 *
 * Tests for Handlebars-style template resolution.
 */

import { describe, it, expect } from "vitest";
import { resolveTemplate, resolveObjectTemplates } from "../variable-resolver";

describe("resolveTemplate", () => {
  const variables = {
    user: {
      name: "Alice",
      age: 30,
      tags: ["admin", "beta"],
    },
    greeting: "Hello",
    empty: "",
    nullValue: null,
    research_result: {
      needs_detail: true,
      summary: "Test summary",
    },
  };

  it("resolves simple variable", () => {
    expect(resolveTemplate("{{greeting}}", variables)).toBe("Hello");
  });

  it("resolves nested variable", () => {
    expect(resolveTemplate("{{user.name}}", variables)).toBe("Alice");
  });

  it("resolves multiple variables in template", () => {
    expect(resolveTemplate("{{greeting}}, {{user.name}}!", variables)).toBe("Hello, Alice!");
  });

  it("preserves text around variables", () => {
    expect(resolveTemplate("Welcome {{user.name}} to the system", variables)).toBe(
      "Welcome Alice to the system"
    );
  });

  it("handles array access", () => {
    expect(resolveTemplate("Role: {{user.tags[0]}}", variables)).toBe("Role: admin");
  });

  it("handles non-string values", () => {
    expect(resolveTemplate("Age: {{user.age}}", variables)).toBe("Age: 30");
    expect(resolveTemplate("Detail: {{research_result.needs_detail}}", variables)).toBe("Detail: true");
  });

  it("replaces missing variables with empty string", () => {
    expect(resolveTemplate("{{nonexistent}}", variables)).toBe("");
    expect(resolveTemplate("Hello {{missing}}!", variables)).toBe("Hello !");
  });

  it("handles empty string values", () => {
    expect(resolveTemplate("Value: {{empty}}", variables)).toBe("Value: ");
  });

  it("handles null values", () => {
    expect(resolveTemplate("Value: {{nullValue}}", variables)).toBe("Value: ");
  });

  it("handles templates without variables", () => {
    expect(resolveTemplate("No variables here", variables)).toBe("No variables here");
  });

  it("handles whitespace in variable names", () => {
    expect(resolveTemplate("{{ user.name }}", variables)).toBe("Alice");
    expect(resolveTemplate("{{  greeting  }}", variables)).toBe("Hello");
  });

  it("handles complex templates", () => {
    const template = `
      User: {{user.name}}
      Age: {{user.age}}
      Role: {{user.tags[0]}}
      Status: Active
    `;
    const result = resolveTemplate(template, variables);
    expect(result).toContain("User: Alice");
    expect(result).toContain("Age: 30");
    expect(result).toContain("Role: admin");
    expect(result).toContain("Status: Active");
  });
});

describe("resolveObjectTemplates", () => {
  const variables = {
    name: "Test",
    count: 5,
    nested: {
      value: "deep",
    },
  };

  it("resolves templates in object values", () => {
    const obj = {
      title: "{{name}} Project",
      count: "{{count}}",
    };
    const result = resolveObjectTemplates(obj, variables);
    expect(result.title).toBe("Test Project");
    expect(result.count).toBe("5");
  });

  it("preserves non-string values", () => {
    const obj = {
      number: 42,
      boolean: true,
      nullVal: null,
      stringVal: "{{name}}",
    };
    const result = resolveObjectTemplates(obj, variables);
    expect(result.number).toBe(42);
    expect(result.boolean).toBe(true);
    expect(result.nullVal).toBeNull();
    expect(result.stringVal).toBe("Test");
  });

  it("resolves nested objects", () => {
    const obj = {
      outer: "{{name}}",
      nested: {
        inner: "{{nested.value}}",
        deep: {
          deepest: "{{count}}",
        },
      },
    };
    const result = resolveObjectTemplates(obj, variables);
    expect(result.outer).toBe("Test");
    expect(result.nested.inner).toBe("deep");
    expect(result.nested.deep.deepest).toBe("5");
  });

  it("resolves arrays", () => {
    const obj = {
      items: ["{{name}}", "static", "{{count}}"],
    };
    const result = resolveObjectTemplates(obj, variables);
    expect(result.items).toEqual(["Test", "static", "5"]);
  });

  it("handles empty objects", () => {
    const result = resolveObjectTemplates({}, variables);
    expect(result).toEqual({});
  });

  it("does not mutate original object", () => {
    const original = { value: "{{name}}" };
    const result = resolveObjectTemplates(original, variables);
    expect(original.value).toBe("{{name}}");
    expect(result.value).toBe("Test");
  });
});
