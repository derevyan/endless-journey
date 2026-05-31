import { describe, expect, it } from "vitest";
import {
  createContentRef,
  parseContentRef,
  isContentRef,
  createEmptyContent,
  CONTENT_REF_PREFIX,
  splitJourneyContent,
  mergeJourneyContent,
  hasContentReferences,
  normalizeEdgeStyles,
  denormalizeEdgeStyles,
  getEdgeStyle,
  optimizeJourneyForExport,
  restoreJourneyFromExport,
  type EdgeStyleDefaults,
} from "../runtime/content";
import type { JourneyConfig } from "../journey";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const TEST_EDGE_STYLE_DEFAULTS: EdgeStyleDefaults = {
  success: { stroke: "#16a34a", strokeWidth: 2 },
  default: { stroke: "#16a34a", strokeWidth: 2 },
  retry: { stroke: "#ea580c", strokeWidth: 2, strokeDasharray: "6,6" },
  dropoff: { stroke: "#ea580c", strokeWidth: 2, strokeDasharray: "2,4" },
  exit: { stroke: "#94a3b8", strokeWidth: 2.5, strokeDasharray: "6,4" },
  timer: { stroke: "#ea580c", strokeWidth: 2, strokeDasharray: "8,4" },
};

const createTestJourney = (): JourneyConfig => ({
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      metadata: {
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        version: "1.0.0",
        status: "active",
      },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Welcome",
        content: "Hello and welcome to our journey!",
      },
    },
    {
      id: "message-1",
      type: "custom",
      position: { x: 0, y: 100 },
      metadata: {
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        version: "1.0.0",
        status: "active",
      },
      data: {
        type: "message",
        schemaVersion: 2,
        label: "Choose Option",
        content: "Please select an option below:",
        contentFormat: "text",
        buttons: [
          { id: "btn-1", text: "Option A", targetNodeId: "node-1" },
          { id: "btn-2", text: "Option B", targetNodeId: "node-2" },
        ],
      },
    },
    {
      id: "condition-1",
      type: "custom",
      position: { x: 0, y: 200 },
      metadata: {
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        version: "1.0.0",
        status: "active",
      },
      data: {
        type: "condition",
        schemaVersion: 1,
        label: "Check Plan",
        rulesOperator: "and",
        branches: [
          { id: "br-1", label: "Basic Plan", isDefault: false },
          { id: "br-2", label: "Pro Plan", isDefault: true },
        ],
      },
    },
    {
      id: "wait-1",
      type: "custom",
      position: { x: 0, y: 300 },
      metadata: {
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        version: "1.0.0",
        status: "active",
      },
      data: {
        type: "wait",
        schemaVersion: 1,
        label: "Wait Period",
        duration: { seconds: 60 },
        reason: "Giving user time to think",
      },
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 400 },
      metadata: {
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        version: "1.0.0",
        status: "active",
      },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "Complete",
        content: "Thank you for completing the journey!",
      },
    },
  ],
  edges: [
    {
      id: "e-start-msg",
      source: "start",
      target: "message-1",
      label: "Begin",
      edgeType: "default",
      style: TEST_EDGE_STYLE_DEFAULTS.default,
    },
    {
      id: "e-1",
      source: "message-1",
      target: "condition-1",
      edgeType: "success",
      style: TEST_EDGE_STYLE_DEFAULTS.success,
    },
    {
      id: "e-timer",
      source: "message-1",
      target: "wait-1",
      sourceHandle: "timer",
      edgeType: "timer",
      style: TEST_EDGE_STYLE_DEFAULTS.timer,
    },
  ],
});

// =============================================================================
// CONTENT REFERENCE TESTS
// =============================================================================

describe("Content Reference Utilities", () => {
  describe("parseContentRef", () => {
    it("should extract path from a content reference", () => {
      expect(parseContentRef("$content:node-1.label")).toBe("node-1.label");
      expect(parseContentRef("$content:msg.buttons.0.text")).toBe("msg.buttons.0.text");
    });

    it("should return null for non-references", () => {
      expect(parseContentRef("Hello world")).toBeNull();
      expect(parseContentRef("$other:path")).toBeNull();
    });
  });

  describe("isContentRef", () => {
    it("should return true for content references", () => {
      expect(isContentRef("$content:node-1.label")).toBe(true);
    });

    it("should return false for non-references", () => {
      expect(isContentRef("Hello world")).toBe(false);
      expect(isContentRef(123)).toBe(false);
      expect(isContentRef(null)).toBe(false);
      expect(isContentRef(undefined)).toBe(false);
    });
  });

  describe("createEmptyContent", () => {
    it("should create an empty content structure", () => {
      const content = createEmptyContent();
      expect(content.version).toBe("1.0");
      expect(content.content).toEqual({});
    });
  });
});

// =============================================================================
// SPLIT/MERGE TESTS
// =============================================================================

describe("Content Split/Merge", () => {
  describe("splitJourneyContent", () => {
    it("should extract all content fields from nodes", () => {
      const journey = createTestJourney();
      const { structure, content } = splitJourneyContent(journey);

      // Check content was extracted
      expect(content.content["start.label"]?.value).toBe("Welcome");
      expect(content.content["start.content"]?.value).toBe("Hello and welcome to our journey!");
      expect(content.content["message-1.label"]?.value).toBe("Choose Option");
      expect(content.content["message-1.content"]?.value).toBe("Please select an option below:");
      expect(content.content["message-1.buttons.0.text"]?.value).toBe("Option A");
      expect(content.content["message-1.buttons.1.text"]?.value).toBe("Option B");
      expect(content.content["condition-1.branches.0.label"]?.value).toBe("Basic Plan");
      expect(content.content["condition-1.branches.1.label"]?.value).toBe("Pro Plan");
      expect(content.content["wait-1.reason"]?.value).toBe("Giving user time to think");

      // Check structure has references
      expect((structure.nodes[0].data as { label: string }).label).toBe("$content:start.label");
      expect((structure.nodes[1].data as { label: string }).label).toBe("$content:message-1.label");
    });

    it("should extract edge labels", () => {
      const journey = createTestJourney();
      const { structure, content } = splitJourneyContent(journey);

      expect(content.content["e-start-msg.label"]?.value).toBe("Begin");
      expect(structure.edges[0].label).toBe("$content:e-start-msg.label");
    });

    it("should preserve structural data", () => {
      const journey = createTestJourney();
      const { structure } = splitJourneyContent(journey);

      // Positions should be preserved
      expect(structure.nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(structure.nodes[1].position).toEqual({ x: 0, y: 100 });

      // IDs should be preserved
      expect(structure.nodes[0].id).toBe("start");
      expect(structure.edges[0].id).toBe("e-start-msg");
      expect(structure.edges[0].source).toBe("start");
      expect(structure.edges[0].target).toBe("message-1");

      // Metadata should be preserved
      expect(structure.nodes[0].metadata.version).toBe("1.0.0");
    });
  });

  describe("mergeJourneyContent", () => {
    it("should resolve all content references", () => {
      const journey = createTestJourney();
      const { structure, content } = splitJourneyContent(journey);
      const merged = mergeJourneyContent(structure, content);

      // Check content was restored
      expect((merged.nodes[0].data as { label: string }).label).toBe("Welcome");
      expect((merged.nodes[0].data as { content: string }).content).toBe(
        "Hello and welcome to our journey!"
      );
    });

    it("should throw on missing content reference", () => {
      const journey = createTestJourney();
      const { structure } = splitJourneyContent(journey);
      const emptyContent = createEmptyContent();

      expect(() => mergeJourneyContent(structure, emptyContent)).toThrow(
        "Content reference not found"
      );
    });
  });

  describe("roundtrip", () => {
    it("split then merge should equal original", () => {
      const journey = createTestJourney();
      const { structure, content } = splitJourneyContent(journey);
      const restored = mergeJourneyContent(structure, content);

      // Compare key fields
      expect((restored.nodes[0].data as { label: string }).label).toBe(
        (journey.nodes[0].data as { label: string }).label
      );
      expect((restored.nodes[0].data as { content: string }).content).toBe(
        (journey.nodes[0].data as { content: string }).content
      );
      expect((restored.nodes[1].data as { buttons: Array<{ text: string }> }).buttons[0].text).toBe(
        (journey.nodes[1].data as { buttons: Array<{ text: string }> }).buttons[0].text
      );
      expect(restored.edges[0].label).toBe(journey.edges[0].label);
    });
  });

  describe("plugin content extraction", () => {
    it("should extract follow-up plugin content fields", () => {
      const journey: JourneyConfig = {
        nodes: [
          {
            id: "msg-with-plugin",
            type: "custom",
            position: { x: 0, y: 0 },
            metadata: {
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:00:00.000Z",
              version: "1.0.0",
              status: "active",
            },
            data: {
              type: "message",
              schemaVersion: 2,
              label: "Reminder Message",
              content: "Please reply to continue.",
              contentFormat: "text",
              plugins: [
                {
                  pluginType: "followup",
                  enabled: true,
                  steps: [
                    {
                      id: "step-1",
                      delay: { minutes: 5 },
                      content: "Hey, just checking in!",
                      fallbackContent: "Friendly reminder to reply.",
                      buttons: [
                        { id: "btn-1", text: "Got it!", targetNodeId: "next-node" },
                        { id: "btn-2", text: "Need help", targetNodeId: "help-node" },
                      ],
                    },
                    {
                      id: "step-2",
                      delay: { hours: 1 },
                      content: "Final reminder before we move on.",
                    },
                  ],
                  exitPath: { nodeId: "exit-node" },
                },
              ],
            },
          },
        ],
        edges: [],
      };

      const { structure, content } = splitJourneyContent(journey);

      // Check plugin content was extracted
      expect(content.content["msg-with-plugin.plugins.0.steps.0.content"]?.value).toBe(
        "Hey, just checking in!"
      );
      expect(content.content["msg-with-plugin.plugins.0.steps.0.fallbackContent"]?.value).toBe(
        "Friendly reminder to reply."
      );
      expect(content.content["msg-with-plugin.plugins.0.steps.0.buttons.0.text"]?.value).toBe(
        "Got it!"
      );
      expect(content.content["msg-with-plugin.plugins.0.steps.0.buttons.1.text"]?.value).toBe(
        "Need help"
      );
      expect(content.content["msg-with-plugin.plugins.0.steps.1.content"]?.value).toBe(
        "Final reminder before we move on."
      );

      // Check structure has references
      const nodeData = structure.nodes[0].data as unknown as {
        plugins: Array<{
          steps: Array<{
            content: string;
            fallbackContent?: string;
            buttons?: Array<{ text: string }>;
          }>;
        }>;
      };
      expect(nodeData.plugins[0].steps[0].content).toBe(
        "$content:msg-with-plugin.plugins.0.steps.0.content"
      );
      expect(nodeData.plugins[0].steps[0].fallbackContent).toBe(
        "$content:msg-with-plugin.plugins.0.steps.0.fallbackContent"
      );
      expect(nodeData.plugins[0].steps[0].buttons?.[0].text).toBe(
        "$content:msg-with-plugin.plugins.0.steps.0.buttons.0.text"
      );
    });

    it("should roundtrip plugin content correctly", () => {
      const journey: JourneyConfig = {
        nodes: [
          {
            id: "msg",
            type: "custom",
            position: { x: 0, y: 0 },
            metadata: {
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:00:00.000Z",
              version: "1.0.0",
              status: "active",
            },
            data: {
              type: "message",
              schemaVersion: 2,
              label: "Test",
              content: "Test message",
              contentFormat: "text",
              plugins: [
                {
                  pluginType: "followup",
                  enabled: true,
                  steps: [
                    {
                      id: "s1",
                      delay: { seconds: 30 },
                      content: "Follow-up content",
                      buttons: [{ id: "b1", text: "Click me", targetNodeId: "n2" }],
                    },
                  ],
                },
              ],
            },
          },
        ],
        edges: [],
      };

      const { structure, content } = splitJourneyContent(journey);
      const restored = mergeJourneyContent(structure, content);

      // Verify roundtrip
      const originalPlugins = (journey.nodes[0].data as { plugins: unknown[] }).plugins;
      const restoredPlugins = (restored.nodes[0].data as { plugins: unknown[] }).plugins;

      const originalStep = (originalPlugins[0] as { steps: Array<{ content: string }> }).steps[0];
      const restoredStep = (restoredPlugins[0] as { steps: Array<{ content: string }> }).steps[0];

      expect(restoredStep.content).toBe(originalStep.content);

      const originalBtn = (
        originalPlugins[0] as { steps: Array<{ buttons: Array<{ text: string }> }> }
      ).steps[0].buttons[0];
      const restoredBtn = (
        restoredPlugins[0] as { steps: Array<{ buttons: Array<{ text: string }> }> }
      ).steps[0].buttons[0];

      expect(restoredBtn.text).toBe(originalBtn.text);
    });
  });
});

// =============================================================================
// HAS CONTENT REFERENCES TESTS
// =============================================================================

describe("hasContentReferences", () => {
  it("should return false for journey without references", () => {
    const journey = createTestJourney();
    expect(hasContentReferences(journey)).toBe(false);
  });

  it("should return true for journey with references", () => {
    const journey = createTestJourney();
    const { structure } = splitJourneyContent(journey);
    expect(hasContentReferences(structure)).toBe(true);
  });

  it("should detect references in buttons", () => {
    const journey: JourneyConfig = {
      nodes: [
        {
          id: "msg",
          type: "custom",
          position: { x: 0, y: 0 },
          metadata: {
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
            version: "1.0.0",
            status: "active",
          },
          data: {
            type: "message",
            schemaVersion: 2,
            label: "Test",
            content: "Test content",
            contentFormat: "text",
            buttons: [{ id: "b1", text: "$content:msg.buttons.0.text", targetNodeId: "node-1" }],
          },
        },
      ],
      edges: [],
    };
    expect(hasContentReferences(journey)).toBe(true);
  });

  it("should detect references in edges", () => {
    const journey: JourneyConfig = {
      nodes: [],
      edges: [
        {
          id: "e1",
          source: "a",
          target: "b",
          label: "$content:e1.label",
          edgeType: "default",
        },
      ],
    };
    expect(hasContentReferences(journey)).toBe(true);
  });

  it("should detect references in plugin content", () => {
    const journey: JourneyConfig = {
      nodes: [
        {
          id: "msg",
          type: "custom",
          position: { x: 0, y: 0 },
          metadata: {
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
            version: "1.0.0",
            status: "active",
          },
          data: {
            type: "message",
            schemaVersion: 2,
            label: "Test",
            content: "Test",
            contentFormat: "text",
            plugins: [
              {
                pluginType: "followup",
                enabled: true,
                steps: [
                  {
                    id: "s1",
                    delay: { seconds: 30 },
                    content: "$content:msg.plugins.0.steps.0.content",
                  },
                ],
              },
            ],
          },
        },
      ],
      edges: [],
    };
    expect(hasContentReferences(journey)).toBe(true);
  });

  it("should detect references in plugin button text", () => {
    const journey: JourneyConfig = {
      nodes: [
        {
          id: "msg",
          type: "custom",
          position: { x: 0, y: 0 },
          metadata: {
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
            version: "1.0.0",
            status: "active",
          },
          data: {
            type: "message",
            schemaVersion: 2,
            label: "Test",
            content: "Test",
            contentFormat: "text",
            plugins: [
              {
                pluginType: "followup",
                enabled: true,
                steps: [
                  {
                    id: "s1",
                    delay: { seconds: 30 },
                    content: "Plain content",
                    buttons: [
                      {
                        id: "b1",
                        text: "$content:msg.plugins.0.steps.0.buttons.0.text",
                        targetNodeId: "n2",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      edges: [],
    };
    expect(hasContentReferences(journey)).toBe(true);
  });
});

// =============================================================================
// EDGE STYLE TESTS
// =============================================================================

describe("Edge Style Utilities", () => {
  describe("getEdgeStyle", () => {
    it("should return explicit style if present", () => {
      const edge = {
        id: "e1",
        source: "a",
        target: "b",
        edgeType: "default" as const,
        style: { stroke: "#ff0000", strokeWidth: 5 },
      };
      expect(getEdgeStyle(edge, TEST_EDGE_STYLE_DEFAULTS)).toEqual({
        stroke: "#ff0000",
        strokeWidth: 5,
      });
    });

    it("should derive style from edgeType", () => {
      const edge = {
        id: "e1",
        source: "a",
        target: "b",
        edgeType: "timer" as const,
      };
      expect(getEdgeStyle(edge, TEST_EDGE_STYLE_DEFAULTS)).toEqual(TEST_EDGE_STYLE_DEFAULTS.timer);
    });

    it("should use default style when no edgeType", () => {
      const edge = {
        id: "e1",
        source: "a",
        target: "b",
      };
      expect(getEdgeStyle(edge, TEST_EDGE_STYLE_DEFAULTS)).toEqual(TEST_EDGE_STYLE_DEFAULTS.default);
    });
  });

  describe("normalizeEdgeStyles", () => {
    it("should remove redundant styles", () => {
      const journey = createTestJourney();
      const normalized = normalizeEdgeStyles(journey, TEST_EDGE_STYLE_DEFAULTS);

      // Default/success edges should have style removed
      expect(normalized.edges[0].style).toBeUndefined();
      expect(normalized.edges[1].style).toBeUndefined();

      // Timer edge should have style removed (matches default for timer)
      expect(normalized.edges[2].style).toBeUndefined();
    });

    it("should preserve custom styles", () => {
      const journey: JourneyConfig = {
        nodes: [],
        edges: [
          {
            id: "e1",
            source: "a",
            target: "b",
            edgeType: "default",
            style: { stroke: "#ff0000", strokeWidth: 3 }, // Custom style
          },
        ],
      };
      const normalized = normalizeEdgeStyles(journey, TEST_EDGE_STYLE_DEFAULTS);
      expect(normalized.edges[0].style).toEqual({ stroke: "#ff0000", strokeWidth: 3 });
    });
  });

  describe("denormalizeEdgeStyles", () => {
    it("should add explicit styles to all edges", () => {
      const journey: JourneyConfig = {
        nodes: [],
        edges: [
          { id: "e1", source: "a", target: "b", edgeType: "default" },
          { id: "e2", source: "b", target: "c", edgeType: "timer" },
        ],
      };
      const denormalized = denormalizeEdgeStyles(journey, TEST_EDGE_STYLE_DEFAULTS);

      expect(denormalized.edges[0].style).toEqual(TEST_EDGE_STYLE_DEFAULTS.default);
      expect(denormalized.edges[1].style).toEqual(TEST_EDGE_STYLE_DEFAULTS.timer);
    });
  });

  describe("roundtrip", () => {
    it("normalize then denormalize should produce equivalent styles", () => {
      const journey = createTestJourney();
      const normalized = normalizeEdgeStyles(journey, TEST_EDGE_STYLE_DEFAULTS);
      const denormalized = denormalizeEdgeStyles(normalized, TEST_EDGE_STYLE_DEFAULTS);

      // All edges should have styles matching their edgeType defaults
      for (const edge of denormalized.edges) {
        const defaultStyle = TEST_EDGE_STYLE_DEFAULTS[edge.edgeType ?? "default"];
        expect(edge.style).toEqual(defaultStyle);
      }
    });
  });
});

// =============================================================================
// COMBINED OPTIMIZATION TESTS
// =============================================================================

describe("Full Optimization Pipeline", () => {
  describe("optimizeJourneyForExport", () => {
    it("should split content and normalize edges", () => {
      const journey = createTestJourney();
      const { structure, content } = optimizeJourneyForExport(journey, TEST_EDGE_STYLE_DEFAULTS);

      // Content should be extracted
      expect(content.content["start.label"]?.value).toBe("Welcome");

      // Structure should have references
      expect(hasContentReferences(structure)).toBe(true);

      // Edges should be normalized (no redundant styles)
      expect(structure.edges[0].style).toBeUndefined();
    });
  });

  describe("restoreJourneyFromExport", () => {
    it("should merge content and denormalize edges", () => {
      const journey = createTestJourney();
      const { structure, content } = optimizeJourneyForExport(journey, TEST_EDGE_STYLE_DEFAULTS);
      const restored = restoreJourneyFromExport(structure, content, TEST_EDGE_STYLE_DEFAULTS);

      // Content should be restored
      expect((restored.nodes[0].data as { label: string }).label).toBe("Welcome");

      // Should not have references
      expect(hasContentReferences(restored)).toBe(false);

      // Edges should have explicit styles
      expect(restored.edges[0].style).toBeDefined();
    });
  });

  describe("full roundtrip", () => {
    it("optimize then restore should produce equivalent journey", () => {
      const journey = createTestJourney();
      const { structure, content } = optimizeJourneyForExport(journey, TEST_EDGE_STYLE_DEFAULTS);
      const restored = restoreJourneyFromExport(structure, content, TEST_EDGE_STYLE_DEFAULTS);

      // Content should match
      expect((restored.nodes[0].data as { label: string }).label).toBe(
        (journey.nodes[0].data as { label: string }).label
      );
      expect((restored.nodes[0].data as { content: string }).content).toBe(
        (journey.nodes[0].data as { content: string }).content
      );

      // Edge labels should match
      expect(restored.edges[0].label).toBe(journey.edges[0].label);

      // Edge styles should be equivalent (matching defaults for edgeType)
      expect(restored.edges[0].style?.stroke).toBe(journey.edges[0].style?.stroke);
    });
  });
});
