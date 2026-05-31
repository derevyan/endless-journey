/**
 * Form Registry Tests
 *
 * Tests for the shared FormRegistry class used by journey and workflow nodes.
 * Verifies registration, retrieval, and type-safe operations.
 *
 * @module features/nodes/shared/__tests__/form-registry.test
 */

import { describe, expect, it, beforeEach } from "vitest";
import { z } from "zod";

import { FormRegistry, type FormHandlers } from "../form-registry";

// =============================================================================
// TEST TYPES
// =============================================================================

type TestNodeType = "alpha" | "beta" | "gamma";

interface TestNode {
  id: string;
  data: {
    type: TestNodeType;
    label: string;
    value?: number;
  };
}

interface TestFormValues {
  label: string;
  value: number;
}

interface TestNodeData {
  type: TestNodeType;
  label: string;
  value?: number;
}

// =============================================================================
// TEST FIXTURES
// =============================================================================

const alphaSchema = z.object({
  label: z.string().min(1),
  value: z.number().min(0),
});

const alphaExtractor = (node: TestNode): TestFormValues => ({
  label: node.data.label,
  value: node.data.value ?? 0,
});

const alphaBuilder = (values: TestFormValues): TestNodeData => ({
  type: "alpha",
  label: values.label,
  value: values.value > 0 ? values.value : undefined,
});

const alphaHandlers: FormHandlers<TestNode, TestFormValues, TestNodeData> = {
  schema: alphaSchema,
  extract: alphaExtractor,
  build: alphaBuilder,
};

const betaSchema = z.object({
  label: z.string(),
  value: z.number().default(100),
});

const betaHandlers: FormHandlers<TestNode, TestFormValues, TestNodeData> = {
  schema: betaSchema,
  extract: (node) => ({
    label: node.data.label.toUpperCase(),
    value: (node.data.value ?? 0) * 2,
  }),
  build: (values) => ({
    type: "beta",
    label: values.label.toLowerCase(),
    value: values.value / 2,
  }),
};

// =============================================================================
// TESTS
// =============================================================================

describe("FormRegistry", () => {
  let registry: FormRegistry<TestNodeType, TestNode, TestFormValues, TestNodeData>;

  beforeEach(() => {
    registry = new FormRegistry();
  });

  describe("register", () => {
    it("registers form handlers for a node type", () => {
      registry.register("alpha", alphaHandlers);

      expect(registry.has("alpha")).toBe(true);
    });

    it("allows multiple node types to be registered", () => {
      registry.register("alpha", alphaHandlers);
      registry.register("beta", betaHandlers);

      expect(registry.has("alpha")).toBe(true);
      expect(registry.has("beta")).toBe(true);
    });

    it("overwrites handlers on re-registration", () => {
      const newHandlers: FormHandlers<TestNode, TestFormValues, TestNodeData> = {
        ...alphaHandlers,
        extract: () => ({ label: "overwritten", value: 999 }),
      };

      registry.register("alpha", alphaHandlers);
      registry.register("alpha", newHandlers);

      const extractor = registry.getExtractor("alpha");
      const result = extractor!({ id: "1", data: { type: "alpha", label: "test" } });

      expect(result.label).toBe("overwritten");
      expect(result.value).toBe(999);
    });
  });

  describe("getHandlers", () => {
    it("returns handlers for registered type", () => {
      registry.register("alpha", alphaHandlers);

      const handlers = registry.getHandlers("alpha");

      expect(handlers).toBeDefined();
      expect(handlers?.schema).toBe(alphaSchema);
      expect(handlers?.extract).toBe(alphaExtractor);
      expect(handlers?.build).toBe(alphaBuilder);
    });

    it("returns undefined for unregistered type", () => {
      const handlers = registry.getHandlers("gamma");

      expect(handlers).toBeUndefined();
    });
  });

  describe("getSchema", () => {
    it("returns schema for registered type", () => {
      registry.register("alpha", alphaHandlers);

      const schema = registry.getSchema("alpha");

      expect(schema).toBe(alphaSchema);
    });

    it("validates data correctly", () => {
      registry.register("alpha", alphaHandlers);

      const schema = registry.getSchema("alpha")!;
      const validResult = schema.safeParse({ label: "test", value: 42 });
      const invalidResult = schema.safeParse({ label: "", value: -5 });

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });

    it("returns undefined for unregistered type", () => {
      const schema = registry.getSchema("gamma");

      expect(schema).toBeUndefined();
    });
  });

  describe("getExtractor", () => {
    it("returns extractor for registered type", () => {
      registry.register("alpha", alphaHandlers);

      const extractor = registry.getExtractor("alpha");

      expect(extractor).toBe(alphaExtractor);
    });

    it("extracts values correctly", () => {
      registry.register("alpha", alphaHandlers);
      registry.register("beta", betaHandlers);

      const alphaNode: TestNode = { id: "1", data: { type: "alpha", label: "Hello", value: 10 } };
      const betaNode: TestNode = { id: "2", data: { type: "beta", label: "World", value: 50 } };

      const alphaExtractor = registry.getExtractor("alpha")!;
      const betaExtractor = registry.getExtractor("beta")!;

      // Alpha extractor returns values as-is
      expect(alphaExtractor(alphaNode)).toEqual({ label: "Hello", value: 10 });

      // Beta extractor transforms values (uppercase, double)
      expect(betaExtractor(betaNode)).toEqual({ label: "WORLD", value: 100 });
    });

    it("returns undefined for unregistered type", () => {
      const extractor = registry.getExtractor("gamma");

      expect(extractor).toBeUndefined();
    });
  });

  describe("getBuilder", () => {
    it("returns builder for registered type", () => {
      registry.register("alpha", alphaHandlers);

      const builder = registry.getBuilder("alpha");

      expect(builder).toBe(alphaBuilder);
    });

    it("builds node data correctly", () => {
      registry.register("alpha", alphaHandlers);
      registry.register("beta", betaHandlers);

      const alphaBuilder = registry.getBuilder("alpha")!;
      const betaBuilder = registry.getBuilder("beta")!;

      // Alpha builder includes value only if > 0
      expect(alphaBuilder({ label: "Test", value: 42 })).toEqual({
        type: "alpha",
        label: "Test",
        value: 42,
      });
      expect(alphaBuilder({ label: "Test", value: 0 })).toEqual({
        type: "alpha",
        label: "Test",
        value: undefined,
      });

      // Beta builder transforms values (lowercase, halve)
      expect(betaBuilder({ label: "HELLO", value: 200 })).toEqual({
        type: "beta",
        label: "hello",
        value: 100,
      });
    });

    it("returns undefined for unregistered type", () => {
      const builder = registry.getBuilder("gamma");

      expect(builder).toBeUndefined();
    });
  });

  describe("has", () => {
    it("returns true for registered type", () => {
      registry.register("alpha", alphaHandlers);

      expect(registry.has("alpha")).toBe(true);
    });

    it("returns false for unregistered type", () => {
      expect(registry.has("alpha")).toBe(false);
      expect(registry.has("gamma")).toBe(false);
    });
  });

  describe("getRegisteredTypes", () => {
    it("returns empty array when no types registered", () => {
      const types = registry.getRegisteredTypes();

      expect(types).toEqual([]);
    });

    it("returns all registered types", () => {
      registry.register("alpha", alphaHandlers);
      registry.register("beta", betaHandlers);

      const types = registry.getRegisteredTypes();

      expect(types).toHaveLength(2);
      expect(types).toContain("alpha");
      expect(types).toContain("beta");
    });

    it("does not include unregistered types", () => {
      registry.register("alpha", alphaHandlers);

      const types = registry.getRegisteredTypes();

      expect(types).not.toContain("gamma");
    });
  });

  describe("integration: extract → validate → build round-trip", () => {
    it("preserves values through full round-trip", () => {
      registry.register("alpha", alphaHandlers);

      const originalNode: TestNode = {
        id: "node-1",
        data: { type: "alpha", label: "Original Label", value: 42 },
      };

      // Extract
      const extractor = registry.getExtractor("alpha")!;
      const formValues = extractor(originalNode);

      // Validate
      const schema = registry.getSchema("alpha")!;
      const validationResult = schema.safeParse(formValues);
      expect(validationResult.success).toBe(true);

      // Build
      const builder = registry.getBuilder("alpha")!;
      const nodeData = builder(formValues);

      // Verify round-trip preserves data
      expect(nodeData.type).toBe("alpha");
      expect(nodeData.label).toBe(originalNode.data.label);
      expect(nodeData.value).toBe(originalNode.data.value);
    });

    it("applies transformations through round-trip", () => {
      registry.register("beta", betaHandlers);

      const originalNode: TestNode = {
        id: "node-2",
        data: { type: "beta", label: "lowercase", value: 50 },
      };

      // Extract (uppercase, double)
      const extractor = registry.getExtractor("beta")!;
      const formValues = extractor(originalNode);
      expect(formValues).toEqual({ label: "LOWERCASE", value: 100 });

      // Build (lowercase, halve) - brings back to original
      const builder = registry.getBuilder("beta")!;
      const nodeData = builder(formValues);
      expect(nodeData).toEqual({
        type: "beta",
        label: "lowercase",
        value: 50,
      });
    });
  });

  describe("type safety", () => {
    it("maintains type safety across operations", () => {
      registry.register("alpha", alphaHandlers);

      const node: TestNode = { id: "1", data: { type: "alpha", label: "Test", value: 10 } };

      const extractor = registry.getExtractor("alpha");
      if (extractor) {
        const values: TestFormValues = extractor(node);
        expect(typeof values.label).toBe("string");
        expect(typeof values.value).toBe("number");
      }

      const builder = registry.getBuilder("alpha");
      if (builder) {
        const data: TestNodeData = builder({ label: "Built", value: 20 });
        expect(data.type).toBe("alpha");
      }
    });
  });
});

// =============================================================================
// WORKFLOW FORM REGISTRY INTEGRATION
// =============================================================================

describe("workflowFormRegistry integration", () => {
  // Import the real workflow registry after all node registrations
  it(
    "has handlers registered for workflow node types",
    async () => {
      // Dynamic import to ensure registration has happened
      const { workflowFormRegistry } = await import("@/features/nodes/workflow/forms/form-registry");

      // Load node definitions to trigger registration
      await import("@/features/nodes/workflow/definitions");

      const registeredTypes = workflowFormRegistry.getRegisteredTypes();

      // Should have at least some workflow types registered
      expect(registeredTypes.length).toBeGreaterThan(0);
    },
    30_000
  );
});

// =============================================================================
// JOURNEY FORM REGISTRY INTEGRATION
// =============================================================================

describe("formRegistry (journey) integration", () => {
  it(
    "has handlers registered for journey node types",
    async () => {
      // Dynamic import to ensure registration has happened
      const { formRegistry } = await import("@/features/nodes/journey/registry/form-registry");

      // Load node type registrations
      await import("@/features/nodes/journey/types");

      const registeredTypes = formRegistry.getRegisteredTypes();

      // Should have journey types registered
      expect(registeredTypes.length).toBeGreaterThan(0);
    },
    30_000
  );
});
