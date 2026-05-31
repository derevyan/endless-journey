import { describe, it, expect } from "vitest";
import { ValidationError } from "@journey/schemas";
import { validatePipelineContext } from "../validation";
import type { PipelineContext } from "../../types";

describe("Pipeline Context Validation", () => {
  // Helper to create a valid context
  function createValidContext(): PipelineContext {
    return {
      userState: [
        {
          id: "mood",
          name: "Mood",
          category: "emotion",
          description: "User's mood",
          scaleType: "CATEGORICAL",
          min: undefined,
          max: undefined,
          options: ["happy", "neutral", "sad"],
          responsibleAgentId: "emotion_agent",
          currentValue: "neutral",
          history: [],
        },
      ],
      systemAgents: [
        {
          id: "emotion_agent",
          name: "Emotion Agent",
          role: "Emotional State Tracker",
          promptSource: "inline",
          systemPrompt: "Track and analyze emotional states.",
          llmConfig: { model: "gpt-4" },
        },
      ],
      mainAgent: {
        id: "main",
        name: "Main Agent",
        role: "Primary Assistant",
        promptSource: "inline",
        systemPrompt: "You are a helpful companion.",
        llmConfig: { model: "gpt-4" },
      },
      messages: [],
    };
  }

  describe("systemAgents validation", () => {
    it("should throw ValidationError when systemAgents is empty", () => {
      const context = {
        ...createValidContext(),
        systemAgents: [],
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should throw ValidationError when systemAgents is undefined", () => {
      const context = {
        ...createValidContext(),
        systemAgents: undefined,
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should pass when systemAgents has at least one agent", () => {
      const context = createValidContext();

      expect(() => validatePipelineContext(context)).not.toThrow();
    });
  });

  describe("userState validation", () => {
    it("should throw ValidationError when userState is undefined", () => {
      const context = {
        ...createValidContext(),
        userState: undefined,
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should pass when userState is empty array", () => {
      const context = {
        ...createValidContext(),
        userState: [],
      } as any;

      expect(() => validatePipelineContext(context)).not.toThrow();
    });

    it("should pass when userState has parameters", () => {
      const context = createValidContext();

      expect(() => validatePipelineContext(context)).not.toThrow();
    });
  });

  describe("messages validation", () => {
    it("should throw ValidationError when messages is undefined", () => {
      const context = {
        ...createValidContext(),
        messages: undefined,
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should pass when messages is empty array", () => {
      const context = {
        ...createValidContext(),
        messages: [],
      } as any;

      expect(() => validatePipelineContext(context)).not.toThrow();
    });
  });

  describe("mainAgent validation", () => {
    it("should throw ValidationError when mainAgent is undefined", () => {
      const context = {
        ...createValidContext(),
        mainAgent: undefined,
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should pass when mainAgent is present", () => {
      const context = createValidContext();

      expect(() => validatePipelineContext(context)).not.toThrow();
    });
  });

  describe("categorical parameters validation", () => {
    it("should throw ValidationError when CATEGORICAL parameter has no options", () => {
      const baseContext = createValidContext();
      const context = {
        ...baseContext,
        userState: [
          {
            ...(baseContext.userState[0] as any),
            options: [],
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should throw ValidationError when CATEGORICAL parameter options is undefined", () => {
      const baseContext = createValidContext();
      const context = {
        ...baseContext,
        userState: [
          {
            ...(baseContext.userState[0] as any),
            options: undefined,
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should pass when CATEGORICAL parameter has options", () => {
      const context = createValidContext();

      expect(() => validatePipelineContext(context)).not.toThrow();
    });

    it("should pass when parameter is NUMERIC (not CATEGORICAL)", () => {
      const context = {
        ...createValidContext(),
        userState: [
          {
            id: "energy",
            name: "Energy",
            category: "physical",
            description: "Energy level",
            scaleType: "NUMERIC",
            min: 0,
            max: 100,
            options: undefined,
            responsibleAgentId: "energy_agent",
            currentValue: 50,
            history: [],
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).not.toThrow();
    });

    it("should pass when parameter is BOOLEAN (not CATEGORICAL)", () => {
      const context = {
        ...createValidContext(),
        userState: [
          {
            id: "busy",
            name: "Busy",
            category: "status",
            description: "Is user busy?",
            scaleType: "BOOLEAN",
            min: undefined,
            max: undefined,
            options: undefined,
            responsibleAgentId: "status_agent",
            currentValue: false,
            history: [],
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).not.toThrow();
    });
  });

  describe("duplicate IDs validation", () => {
    it("should throw ValidationError for duplicate StateParameter IDs", () => {
      const baseContext = createValidContext();
      const context = {
        ...baseContext,
        userState: [
          {
            id: "mood",
            name: "Mood",
            category: "emotion",
            description: "User's mood",
            scaleType: "CATEGORICAL",
            options: ["happy", "neutral", "sad"],
            responsibleAgentId: "emotion_agent",
            currentValue: "neutral",
            history: [],
          },
          {
            id: "mood", // Duplicate ID
            name: "Mood Copy",
            category: "emotion",
            description: "Duplicate mood",
            scaleType: "CATEGORICAL",
            options: ["happy", "neutral", "sad"],
            responsibleAgentId: "emotion_agent",
            currentValue: "happy",
            history: [],
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should throw ValidationError for duplicate SystemAgent IDs", () => {
      const baseContext = createValidContext();
      const context = {
        ...baseContext,
        systemAgents: [
          {
            id: "emotion_agent",
            name: "Emotion Agent",
            role: "Emotional State Tracker",
            systemPrompt: "Track and analyze emotional states.",
            llmConfig: { model: "gpt-4" },
          },
          {
            id: "emotion_agent", // Duplicate ID
            name: "Emotion Agent 2",
            role: "Emotional State Tracker",
            systemPrompt: "Track and analyze emotional states.",
            llmConfig: { model: "gpt-4" },
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should pass when all IDs are unique", () => {
      const context = createValidContext();

      expect(() => validatePipelineContext(context)).not.toThrow();
    });
  });

  describe("categorical value membership validation", () => {
    it("should throw ValidationError when CATEGORICAL currentValue not in options", () => {
      const baseContext = createValidContext();
      const context = {
        ...baseContext,
        userState: [
          {
            ...(baseContext.userState[0] as any),
            currentValue: "excited", // Not in options: ["happy", "neutral", "sad"]
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });

    it("should pass when CATEGORICAL currentValue is in options", () => {
      const context = createValidContext();

      expect(() => validatePipelineContext(context)).not.toThrow();
    });

    it("should pass when CATEGORICAL parameter has no currentValue set (optional)", () => {
      const baseContext = createValidContext();
      const context = {
        ...baseContext,
        userState: [
          {
            ...(baseContext.userState[0] as any),
            currentValue: "", // Empty string might be allowed
          },
        ],
      } as any;

      expect(() => validatePipelineContext(context)).not.toThrow();
    });
  });

  describe("full context validation", () => {
    it("should pass with completely valid context", () => {
      const context = createValidContext();

      expect(() => validatePipelineContext(context)).not.toThrow();
    });

    it("should fail if any requirement is not met", () => {
      const context = {
        ...createValidContext(),
        systemAgents: [], // Violate agent requirement
      } as any;

      expect(() => validatePipelineContext(context)).toThrow(ValidationError);
    });
  });
});
