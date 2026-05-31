/**
 * Content Integration Tests
 *
 * Tests the split format (journey.json + content.json) with real demo journey data.
 * These tests ensure that:
 * 1. All demo journey files are valid
 * 2. Content merges correctly with no unresolved references
 * 3. Edge styles are properly applied
 * 4. Roundtrip (split → merge) preserves data integrity
 */

import { describe, expect, it } from "vitest";
import {
  JourneyConfigSchema,
  JourneyContentSchema,
  restoreJourneyFromExport,
  optimizeJourneyForExport,
  isContentRef,
  CONTENT_REF_PREFIX,
} from "..";
import type { JourneyConfig, JourneyContent } from "..";
import { EDGE_STYLE_DEFAULTS } from "../../../../apps/web/src/features/nodes/journey/config/node-theme";

// =============================================================================
// IMPORT REAL DEMO DATA
// =============================================================================

// Starter Template
import starterStructure from "../../../../apps/web/src/data/journeys/starter-template/journey.json";
import starterContent from "../../../../apps/web/src/data/journeys/starter-template/content.json";

// SaaS Onboarding
import saasStructure from "../../../../apps/web/src/data/journeys/saas-onboarding/journey.json";
import saasContent from "../../../../apps/web/src/data/journeys/saas-onboarding/content.json";

// Support Triage
import supportStructure from "../../../../apps/web/src/data/journeys/support-triage/journey.json";
import supportContent from "../../../../apps/web/src/data/journeys/support-triage/content.json";

// =============================================================================
// TEST DATA
// =============================================================================

interface DemoJourney {
  name: string;
  structure: unknown;
  content: unknown;
}

const DEMO_JOURNEYS: DemoJourney[] = [
  { name: "starter-template", structure: starterStructure, content: starterContent },
  { name: "saas-onboarding", structure: saasStructure, content: saasContent },
  { name: "support-triage", structure: supportStructure, content: supportContent },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Recursively check if any string value contains an unresolved $content: reference
 */
function findUnresolvedContentRefs(obj: unknown, path = ""): string[] {
  const unresolved: string[] = [];

  if (typeof obj === "string") {
    if (obj.startsWith(CONTENT_REF_PREFIX)) {
      unresolved.push(`${path}: "${obj}"`);
    }
    return unresolved;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      unresolved.push(...findUnresolvedContentRefs(item, `${path}[${index}]`));
    });
    return unresolved;
  }

  if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      unresolved.push(...findUnresolvedContentRefs(value, newPath));
    }
  }

  return unresolved;
}

/**
 * Check if a journey has any unresolved content references
 */
function hasUnresolvedContentRefs(config: JourneyConfig): boolean {
  return findUnresolvedContentRefs(config).length > 0;
}

/**
 * Get all edges without explicit style property
 */
function findEdgesWithoutStyle(config: JourneyConfig): string[] {
  return config.edges.filter((edge) => !edge.style).map((edge) => edge.id);
}

// =============================================================================
// TESTS
// =============================================================================

describe("Demo Journey Integration Tests", () => {
  describe.each(DEMO_JOURNEYS)("$name", ({ name, structure, content }) => {
    // Parse structure and content once for each journey
    let validatedStructure: JourneyConfig;
    let validatedContent: JourneyContent;

    it("content.json validates against JourneyContentSchema", () => {
      const result = JourneyContentSchema.safeParse(content);
      expect(result.success, `Content validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      if (result.success) {
        validatedContent = result.data;
      }
    });

    it("journey.json validates against JourneyConfigSchema", () => {
      const result = JourneyConfigSchema.safeParse(structure);
      expect(result.success, `Structure validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      if (result.success) {
        validatedStructure = result.data;
      }
    });

    it("structure contains $content: references (split format)", () => {
      // The structure file should have content references
      const refs = findUnresolvedContentRefs(structure);
      expect(refs.length).toBeGreaterThan(0);
    });

    it("restoreJourneyFromExport merges without errors", () => {
      // Parse fresh to ensure we have valid data
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);

      expect(() => {
        restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);
      }).not.toThrow();
    });

    it("merged journey has no unresolved $content: references", () => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);
      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);

      const unresolved = findUnresolvedContentRefs(merged);
      expect(unresolved, `Unresolved references found:\n${unresolved.join("\n")}`).toHaveLength(0);
    });

    it("merged journey has all edges with explicit style", () => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);
      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);

      const edgesWithoutStyle = findEdgesWithoutStyle(merged);
      expect(
        edgesWithoutStyle,
        `Edges without style: ${edgesWithoutStyle.join(", ")}`
      ).toHaveLength(0);
    });

    it("merged journey has valid edge styles", () => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);
      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);

      for (const edge of merged.edges) {
        expect(edge.style).toBeDefined();
        expect(edge.style?.stroke).toBeDefined();
        expect(edge.style?.strokeWidth).toBeDefined();
        expect(typeof edge.style?.stroke).toBe("string");
        expect(typeof edge.style?.strokeWidth).toBe("number");
      }
    });

    it("node labels are resolved to actual text", () => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);
      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);

      for (const node of merged.nodes) {
        const data = node.data as Record<string, unknown>;
        if (data.label) {
          expect(isContentRef(data.label)).toBe(false);
          expect(typeof data.label).toBe("string");
          expect((data.label as string).length).toBeGreaterThan(0);
        }
      }
    });

    it("button texts are resolved to actual text", () => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);
      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);

      for (const node of merged.nodes) {
        const data = node.data as Record<string, unknown>;
        if (Array.isArray(data.buttons)) {
          for (const btn of data.buttons as Array<{ text: unknown }>) {
            expect(isContentRef(btn.text)).toBe(false);
            expect(typeof btn.text).toBe("string");
          }
        }
      }
    });

    it("edge labels are resolved to actual text", () => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);
      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);

      for (const edge of merged.edges) {
        if (edge.label) {
          expect(isContentRef(edge.label)).toBe(false);
          expect(typeof edge.label).toBe("string");
        }
      }
    });
  });

  describe("Roundtrip Integrity", () => {
    it.each(DEMO_JOURNEYS)("$name: split → merge preserves node count", ({ structure, content }) => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);

      // Merge to get full journey
      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);

      // Split again
      const { structure: newStructure, content: newContent } = optimizeJourneyForExport(
        merged,
        EDGE_STYLE_DEFAULTS
      );

      // Merge the new split
      const reMerged = restoreJourneyFromExport(newStructure, newContent, EDGE_STYLE_DEFAULTS);

      // Node count should be preserved
      expect(reMerged.nodes.length).toBe(merged.nodes.length);
      expect(reMerged.edges.length).toBe(merged.edges.length);
    });

    it.each(DEMO_JOURNEYS)("$name: split → merge preserves node IDs", ({ structure, content }) => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);

      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);
      const { structure: newStructure, content: newContent } = optimizeJourneyForExport(
        merged,
        EDGE_STYLE_DEFAULTS
      );
      const reMerged = restoreJourneyFromExport(newStructure, newContent, EDGE_STYLE_DEFAULTS);

      const originalIds = merged.nodes.map((n) => n.id).sort();
      const reMergedIds = reMerged.nodes.map((n) => n.id).sort();

      expect(reMergedIds).toEqual(originalIds);
    });

    it.each(DEMO_JOURNEYS)("$name: split → merge preserves edge connections", ({ structure, content }) => {
      const structResult = JourneyConfigSchema.parse(structure);
      const contentResult = JourneyContentSchema.parse(content);

      const merged = restoreJourneyFromExport(structResult, contentResult, EDGE_STYLE_DEFAULTS);
      const { structure: newStructure, content: newContent } = optimizeJourneyForExport(
        merged,
        EDGE_STYLE_DEFAULTS
      );
      const reMerged = restoreJourneyFromExport(newStructure, newContent, EDGE_STYLE_DEFAULTS);

      // Check that all edge source/target pairs are preserved
      const originalConnections = merged.edges.map((e) => `${e.source}->${e.target}`).sort();
      const reMergedConnections = reMerged.edges.map((e) => `${e.source}->${e.target}`).sort();

      expect(reMergedConnections).toEqual(originalConnections);
    });
  });

  describe("Content Coverage", () => {
    it.each(DEMO_JOURNEYS)("$name: all content entries are used", ({ structure, content }) => {
      const contentResult = JourneyContentSchema.parse(content);

      // Get all content keys
      const contentKeys = Object.keys(contentResult.content);

      // Find all $content: references in structure
      const refs = findUnresolvedContentRefs(structure);
      const referencedKeys = refs.map((ref) => {
        // Extract the key from the reference (e.g., "nodes[0].data.label: \"$content:start.label\"")
        const match = ref.match(/\$content:([^"]+)/);
        return match ? match[1] : null;
      }).filter(Boolean);

      // Every content entry should be referenced
      for (const key of contentKeys) {
        expect(
          referencedKeys.includes(key),
          `Content key "${key}" is not referenced in structure`
        ).toBe(true);
      }
    });

    it.each(DEMO_JOURNEYS)("$name: content file has at least node labels", ({ content }) => {
      const contentResult = JourneyContentSchema.parse(content);
      const keys = Object.keys(contentResult.content);

      // Should have at least some .label entries
      const labelKeys = keys.filter((k) => k.endsWith(".label"));
      expect(labelKeys.length).toBeGreaterThan(0);
    });
  });

  describe("Structure Integrity", () => {
    it.each(DEMO_JOURNEYS)("$name: structure has nodes and edges", ({ structure }) => {
      const structResult = JourneyConfigSchema.parse(structure);

      expect(structResult.nodes.length).toBeGreaterThan(0);
      expect(structResult.edges.length).toBeGreaterThan(0);
    });

    it.each(DEMO_JOURNEYS)("$name: structure has start and end nodes", ({ structure }) => {
      const structResult = JourneyConfigSchema.parse(structure);

      const nodeTypes = structResult.nodes.map((n) => {
        const data = n.data as Record<string, unknown>;
        return data.type;
      });

      expect(nodeTypes).toContain("start");
      expect(nodeTypes).toContain("end");
    });

    it.each(DEMO_JOURNEYS)("$name: all edges reference existing nodes", ({ structure }) => {
      const structResult = JourneyConfigSchema.parse(structure);
      const nodeIds = new Set(structResult.nodes.map((n) => n.id));

      for (const edge of structResult.edges) {
        expect(nodeIds.has(edge.source), `Edge ${edge.id} source "${edge.source}" not found`).toBe(true);
        expect(nodeIds.has(edge.target), `Edge ${edge.id} target "${edge.target}" not found`).toBe(true);
      }
    });
  });
});
