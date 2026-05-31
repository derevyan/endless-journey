/**
 * Workflow Form Extractors and Builders Tests
 *
 * Tests for extracting form values from node data and building node data from form values.
 * Ensures round-trip consistency: extract(build(values)) ≈ values
 *
 * @module features/nodes/workflow/forms/__tests__/workflow-form-extractors.test
 */

import { describe, expect, it } from "vitest";

import {
  extractEndNodeFields,
  extractQuestionUnderstandingNodeFields,
  extractGuardNodeFields,
  extractMCPNodeFields,
  extractUserApprovalNodeFields,
  extractSetStateNodeFields,
  extractTransformNodeFields,
  extractIfElseNodeFields,
  extractContextNodeFields,
  extractAgentNodeFields,
  extractWorkflowFields,
} from "../workflow-form-extractors";

import {
  buildEndNodeData,
  buildQuestionUnderstandingNodeData,
  buildGuardNodeData,
  buildMCPNodeData,
  buildUserApprovalNodeData,
  buildSetStateNodeData,
  buildTransformNodeData,
  buildIfElseNodeData,
  buildContextNodeData,
  buildAgentNodeData,
  buildWorkflowNodeData,
} from "../workflow-form-builders";

import type {
  EndNodeConfig,
  QuestionUnderstandingNodeConfig,
  GuardNodeConfig,
  MCPNodeConfig,
  UserApprovalNodeConfig,
  SetStateNodeConfig,
  TransformNodeConfig,
  IfElseNodeConfig,
  ContextNodeConfig,
  AgentNodeConfig,
} from "@journey/schemas";

// =============================================================================
// END NODE
// =============================================================================

describe("End Node", () => {
  describe("extractEndNodeFields", () => {
    it("extracts all fields from full data", () => {
      const data: EndNodeConfig = {
        name: "Complete Flow",
        outputTemplate: "Thank you for completing the flow!",
      };

      const result = extractEndNodeFields(data);

      expect(result).toEqual({
        name: "Complete Flow",
        outputTemplate: "Thank you for completing the flow!",
      });
    });

    it("handles undefined optional fields", () => {
      const data: EndNodeConfig = {};

      const result = extractEndNodeFields(data);

      expect(result).toEqual({
        name: undefined,
        outputTemplate: undefined,
      });
    });
  });

  describe("buildEndNodeData", () => {
    it("builds data from form values", () => {
      const values = {
        name: "Finish",
        outputTemplate: "Goodbye!",
      };

      const result = buildEndNodeData(values);

      expect(result).toEqual({
        name: "Finish",
        outputTemplate: "Goodbye!",
      });
    });

    it("converts empty strings to undefined", () => {
      const values = {
        name: "",
        outputTemplate: "",
      };

      const result = buildEndNodeData(values);

      expect(result.name).toBeUndefined();
      expect(result.outputTemplate).toBeUndefined();
    });
  });
});

// =============================================================================
// QUESTION UNDERSTANDING NODE
// =============================================================================

describe("Question Understanding Node", () => {
  describe("extractQuestionUnderstandingNodeFields", () => {
    it("extracts all fields from full data", () => {
      const data: QuestionUnderstandingNodeConfig = {
        name: "Understand Query",
        outputVariable: "parsed_question",
        includeReasoning: true,
      };

      const result = extractQuestionUnderstandingNodeFields(data);

      expect(result).toEqual({
        name: "Understand Query",
        outputVariable: "parsed_question",
        includeReasoning: true,
      });
    });

    it("applies defaults for missing optional fields", () => {
      const data: QuestionUnderstandingNodeConfig = {
        name: "QU",
      };

      const result = extractQuestionUnderstandingNodeFields(data);

      expect(result.outputVariable).toBe("synthesized_question");
      expect(result.includeReasoning).toBe(false);
    });
  });

  describe("buildQuestionUnderstandingNodeData", () => {
    it("builds data from form values", () => {
      const values = {
        name: "QU Node",
        outputVariable: "my_question",
        includeReasoning: true,
      };

      const result = buildQuestionUnderstandingNodeData(values);

      expect(result).toEqual({
        name: "QU Node",
        outputVariable: "my_question",
        includeReasoning: true,
      });
    });
  });
});

// =============================================================================
// GUARD NODE
// =============================================================================

describe("Guard Node", () => {
  describe("extractGuardNodeFields", () => {
    it("extracts all fields from full data", () => {
      const data: GuardNodeConfig = {
        name: "Safety Check",
        workers: ["safety_guard", "injection_guard"],
        blockedMessage: "This request violates our policy.",
        terminateOnBlock: false,
      };

      const result = extractGuardNodeFields(data);

      expect(result).toEqual({
        name: "Safety Check",
        workers: ["safety_guard", "injection_guard"],
        blockedMessage: "This request violates our policy.",
        terminateOnBlock: false,
      });
    });

    it("applies defaults for missing optional fields", () => {
      const data: GuardNodeConfig = {
        name: "Guard",
      };

      const result = extractGuardNodeFields(data);

      expect(result.workers).toEqual(["safety_guard"]);
      expect(result.blockedMessage).toBe("I can't help with that request.");
      expect(result.terminateOnBlock).toBe(true);
    });
  });

  describe("buildGuardNodeData", () => {
    it("builds data from form values", () => {
      const values = {
        name: "My Guard",
        workers: ["policy_guard"] as ("safety_guard" | "injection_guard" | "policy_guard" | "spam_guard")[],
        blockedMessage: "Blocked!",
        terminateOnBlock: true,
      };

      const result = buildGuardNodeData(values);

      expect(result).toEqual({
        name: "My Guard",
        workers: ["policy_guard"],
        blockedMessage: "Blocked!",
        terminateOnBlock: true,
      });
    });
  });
});

// =============================================================================
// MCP NODE
// =============================================================================

describe("MCP Node", () => {
  describe("extractMCPNodeFields", () => {
    it("extracts all fields from full data", () => {
      const data: MCPNodeConfig = {
        name: "Database Query",
        server: "postgres",
        tool: "query",
        params: { sql: "SELECT * FROM users" },
        timeout: 5000,
        onError: "retry",
        maxRetries: 2,
      };

      const result = extractMCPNodeFields(data);

      expect(result).toEqual({
        name: "Database Query",
        server: "postgres",
        tool: "query",
        params: { sql: "SELECT * FROM users" },
        timeout: 5000,
        onError: "retry",
        maxRetries: 2,
      });
    });

    it("applies defaults for missing optional fields", () => {
      const data: MCPNodeConfig = {
        name: "MCP",
      };

      const result = extractMCPNodeFields(data);

      expect(result.server).toBe("");
      expect(result.tool).toBe("");
      expect(result.params).toEqual({});
      expect(result.timeout).toBe(30000);
      expect(result.onError).toBe("fail");
      expect(result.maxRetries).toBe(1);
    });
  });

  describe("buildMCPNodeData", () => {
    it("builds data from form values", () => {
      const values = {
        name: "MCP Call",
        server: "my-server",
        tool: "my-tool",
        params: { key: "value" },
        timeout: 10000,
        onError: "continue" as const,
        maxRetries: 3,
      };

      const result = buildMCPNodeData(values);

      expect(result).toEqual({
        name: "MCP Call",
        server: "my-server",
        tool: "my-tool",
        params: { key: "value" },
        timeout: 10000,
        onError: "continue",
        maxRetries: 3,
      });
    });
  });
});

// =============================================================================
// USER APPROVAL NODE
// =============================================================================

describe("User Approval Node", () => {
  describe("extractUserApprovalNodeFields", () => {
    it("extracts all fields from full data", () => {
      const data: UserApprovalNodeConfig = {
        name: "Manager Approval",
        message: "Please approve this action.",
        timeoutSeconds: 3600,
        timeoutAction: "reject",
        allowedRoles: ["admin", "manager"],
      };

      const result = extractUserApprovalNodeFields(data);

      expect(result).toEqual({
        name: "Manager Approval",
        message: "Please approve this action.",
        timeoutSeconds: 3600,
        timeoutAction: "reject",
        allowedRoles: ["admin", "manager"],
      });
    });

    it("applies defaults for missing optional fields", () => {
      const data: UserApprovalNodeConfig = {
        name: "Approval",
      };

      const result = extractUserApprovalNodeFields(data);

      expect(result.message).toBe("");
      expect(result.timeoutAction).toBe("skip");
    });
  });

  describe("buildUserApprovalNodeData", () => {
    it("builds data from form values", () => {
      const values = {
        name: "Approval Node",
        message: "Approve?",
        timeoutSeconds: 1800,
        timeoutAction: "approve" as const,
        allowedRoles: ["user"],
      };

      const result = buildUserApprovalNodeData(values);

      expect(result).toEqual({
        name: "Approval Node",
        message: "Approve?",
        timeoutSeconds: 1800,
        timeoutAction: "approve",
        allowedRoles: ["user"],
      });
    });
  });
});

// =============================================================================
// SET STATE NODE
// =============================================================================

describe("Set State Node", () => {
  describe("extractSetStateNodeFields", () => {
    it("extracts all fields from full data", () => {
      const data: SetStateNodeConfig = {
        name: "Set Counter",
        key: "counter",
        value: "10",
        isTemplate: true,
      };

      const result = extractSetStateNodeFields(data);

      expect(result).toEqual({
        name: "Set Counter",
        key: "counter",
        value: "10",
        isTemplate: true,
      });
    });

    it("applies defaults for missing optional fields", () => {
      const data: SetStateNodeConfig = {
        name: "Set",
      };

      const result = extractSetStateNodeFields(data);

      expect(result.key).toBe("");
      expect(result.value).toBe("");
      expect(result.isTemplate).toBe(false);
    });
  });

  describe("buildSetStateNodeData", () => {
    it("builds data from form values", () => {
      const values = {
        name: "Set Variable",
        key: "myVar",
        value: "hello",
        isTemplate: false,
      };

      const result = buildSetStateNodeData(values);

      expect(result).toEqual({
        name: "Set Variable",
        key: "myVar",
        value: "hello",
        isTemplate: false,
      });
    });
  });
});

// =============================================================================
// TRANSFORM NODE
// =============================================================================

describe("Transform Node", () => {
  describe("extractTransformNodeFields", () => {
    it("extracts template operation fields", () => {
      const data: TransformNodeConfig = {
        name: "Format Response",
        operation: {
          type: "template",
          template: "Hello, {{name}}!",
        },
        outputVariable: "formatted",
      };

      const result = extractTransformNodeFields(data);

      expect(result).toEqual({
        name: "Format Response",
        operationType: "template",
        outputVariable: "formatted",
        template: "Hello, {{name}}!",
      });
    });

    it("extracts extractJson operation fields", () => {
      const data: TransformNodeConfig = {
        name: "Extract JSON",
        operation: {
          type: "extractJson",
          sourceVariable: "response",
        },
        outputVariable: "parsed",
      };

      const result = extractTransformNodeFields(data);

      expect(result).toEqual({
        name: "Extract JSON",
        operationType: "extractJson",
        outputVariable: "parsed",
        sourceVariable: "response",
      });
    });

    it("extracts pick operation fields", () => {
      const data: TransformNodeConfig = {
        name: "Pick Fields",
        operation: {
          type: "pick",
          sourceVariable: "user",
          fields: ["name", "email"],
        },
        outputVariable: "userData",
      };

      const result = extractTransformNodeFields(data);

      expect(result).toEqual({
        name: "Pick Fields",
        operationType: "pick",
        outputVariable: "userData",
        sourceVariable: "user",
        fields: ["name", "email"],
      });
    });

    it("extracts merge operation fields", () => {
      const data: TransformNodeConfig = {
        name: "Merge Data",
        operation: {
          type: "merge",
          sources: ["user", "settings"],
        },
        outputVariable: "combined",
      };

      const result = extractTransformNodeFields(data);

      expect(result).toEqual({
        name: "Merge Data",
        operationType: "merge",
        outputVariable: "combined",
        sources: ["user", "settings"],
      });
    });

    it("handles missing operation", () => {
      const data: TransformNodeConfig = {
        name: "Transform",
        outputVariable: "output",
      };

      const result = extractTransformNodeFields(data);

      expect(result.operationType).toBe("template");
      expect(result.outputVariable).toBe("output");
    });
  });

  describe("buildTransformNodeData", () => {
    it("builds template operation data", () => {
      const values = {
        name: "Template",
        operationType: "template" as const,
        template: "{{value}}",
        outputVariable: "result",
      };

      const result = buildTransformNodeData(values);

      expect(result).toEqual({
        name: "Template",
        operation: {
          type: "template",
          template: "{{value}}",
        },
        outputVariable: "result",
      });
    });

    it("builds extractJson operation data", () => {
      const values = {
        name: "Extract",
        operationType: "extractJson" as const,
        sourceVariable: "data",
        outputVariable: "parsed",
      };

      const result = buildTransformNodeData(values);

      expect(result.operation).toEqual({
        type: "extractJson",
        sourceVariable: "data",
      });
    });

    it("builds pick operation data", () => {
      const values = {
        name: "Pick",
        operationType: "pick" as const,
        sourceVariable: "obj",
        fields: ["a", "b"],
        outputVariable: "picked",
      };

      const result = buildTransformNodeData(values);

      expect(result.operation).toEqual({
        type: "pick",
        sourceVariable: "obj",
        fields: ["a", "b"],
      });
    });

    it("builds merge operation data", () => {
      const values = {
        name: "Merge",
        operationType: "merge" as const,
        sources: ["x", "y"],
        outputVariable: "merged",
      };

      const result = buildTransformNodeData(values);

      expect(result.operation).toEqual({
        type: "merge",
        sources: ["x", "y"],
      });
    });
  });
});

// =============================================================================
// IF/ELSE NODE
// =============================================================================

describe("If/Else Node", () => {
  describe("extractIfElseNodeFields", () => {
    it("extracts expression condition fields", () => {
      const data: IfElseNodeConfig = {
        name: "Check Value",
        conditionType: "expression",
        condition: {
          left: "status",
          operator: "===",
          right: "active",
        },
      };

      const result = extractIfElseNodeFields(data);

      expect(result).toEqual({
        name: "Check Value",
        conditionType: "expression",
        left: "status",
        operator: "===",
        right: "active",
      });
    });

    it("extracts intent condition fields", () => {
      const data: IfElseNodeConfig = {
        name: "Check Intent",
        conditionType: "intent",
        intent: {
          intents: ["greeting", "farewell"],
          minConfidence: 0.8,
        },
      };

      const result = extractIfElseNodeFields(data);

      expect(result).toEqual({
        name: "Check Intent",
        conditionType: "intent",
        intents: ["greeting", "farewell"],
        minConfidence: 0.8,
      });
    });
  });

  describe("buildIfElseNodeData", () => {
    it("builds expression condition data", () => {
      const values = {
        name: "Condition",
        conditionType: "expression" as const,
        left: "count",
        operator: ">" as const,
        right: 10,
      };

      const result = buildIfElseNodeData(values);

      expect(result).toEqual({
        name: "Condition",
        conditionType: "expression",
        condition: {
          left: "count",
          operator: ">",
          right: 10,
        },
      });
    });

    it("builds intent condition data", () => {
      const values = {
        name: "Intent Check",
        conditionType: "intent" as const,
        intents: ["help"],
        minConfidence: 0.9,
      };

      const result = buildIfElseNodeData(values);

      expect(result).toEqual({
        name: "Intent Check",
        conditionType: "intent",
        intent: {
          intents: ["help"],
          minConfidence: 0.9,
        },
      });
    });

    it("applies defaults for missing optional fields", () => {
      const values = {
        name: "Condition",
        conditionType: "expression" as const,
      };

      const result = buildIfElseNodeData(values);

      expect(result.condition).toEqual({
        left: "",
        operator: "===",
        right: undefined,
      });
    });
  });
});

// =============================================================================
// CONTEXT NODE
// =============================================================================

describe("Context Node", () => {
  describe("extractContextNodeFields", () => {
    it("extracts all fields from full data", () => {
      const data: ContextNodeConfig = {
        name: "Load Context",
        sources: [
          { type: "memory", maxResults: 5, autoInject: true, recencyBias: 0.5 },
          { type: "knowledge_base", kbId: "kb-123", maxResults: 3, similarity: 0.8 },
        ],
        outputVariable: "context",
        _experimental: true,
      };

      const result = extractContextNodeFields(data);

      expect(result).toEqual({
        name: "Load Context",
        sources: [
          { type: "memory", maxResults: 5, autoInject: true, recencyBias: 0.5 },
          { type: "knowledge_base", kbId: "kb-123", maxResults: 3, similarity: 0.8 },
        ],
        outputVariable: "context",
      });
    });

    it("handles missing optional fields", () => {
      const data: ContextNodeConfig = {
        name: "Context",
        _experimental: true,
      };

      const result = extractContextNodeFields(data);

      expect(result.sources).toEqual([]);
      expect(result.outputVariable).toBeUndefined();
    });
  });

  describe("buildContextNodeData", () => {
    it("builds data from form values", () => {
      const values = {
        name: "Context Node",
        sources: [
          { type: "memory" as const, maxResults: 10, autoInject: true, recencyBias: 0.3 },
        ],
        outputVariable: "ctx",
      };

      const result = buildContextNodeData(values);

      expect(result).toEqual({
        name: "Context Node",
        sources: [
          { type: "memory", maxResults: 10, autoInject: true, recencyBias: 0.3 },
        ],
        outputVariable: "ctx",
        _experimental: true,
      });
    });
  });
});

// =============================================================================
// AGENT NODE
// =============================================================================

describe("Agent Node", () => {
  describe("extractAgentNodeFields", () => {
    it("extracts all fields from full data with inline prompt", () => {
      const data: AgentNodeConfig = {
        name: "Main Agent",
        promptSource: "inline",
        systemPrompt: "You are a helpful assistant.",
        llm: {
          provider: "openai",
          model: "gpt-4o",
          temperature: 0.5,
          reasoningEffort: "medium",
        },
        unifiedTools: {
          enabled: ["web_search", "calculator"],
          toolTimingOverrides: { web_search: "deferred" },
        },
        history: {
          strategy: "summarize",
          maxMessages: 20,
        },
        memory: {
          enabled: true,
          maxResults: 15,
          autoInject: true,
          recencyBias: 0.3,
        },
        responseFormat: {
          type: "json_schema",
          name: "Response",
          schema: { type: "object" },
          strict: true,
          method: "functionCalling",
        },
        outputVariable: "agentResponse",
        messageSource: "original",
        enableQuickReplies: true,
      };

      const result = extractAgentNodeFields(data);

      expect(result.name).toBe("Main Agent");
      expect(result.promptSource).toBe("inline");
      expect(result.systemPrompt).toBe("You are a helpful assistant.");
      expect(result.model).toBe("gpt-4o");
      expect(result.temperature).toBe(0.5);
      expect(result.reasoningEffort).toBe("medium");
      expect(result.enabledTools).toEqual(["web_search", "calculator"]);
      expect(result.toolTimingOverrides).toEqual({ web_search: "deferred" });
      expect(result.historyStrategy).toBe("summarize");
      expect(result.historyMaxMessages).toBe(20);
      expect(result.memoryEnabled).toBe(true);
      expect(result.memoryMaxResults).toBe(15);
      expect(result.responseFormatType).toBe("json_schema");
      expect(result.responseFormatName).toBe("Response");
      expect(result.responseFormatSchema).toBe('{\n  "type": "object"\n}');
      expect(result.outputVariable).toBe("agentResponse");
      expect(result.messageSource).toBe("original");
      expect(result.enableQuickReplies).toBe(true);
    });

    it("extracts fields for repository prompt", () => {
      const data: AgentNodeConfig = {
        name: "Repo Agent",
        promptSource: "repository",
        promptRef: {
          name: "welcome-prompt",
          versionId: "v2",
          label: "staging",
        },
        promptVariables: {
          userName: "user.name",
        },
        llm: {
          provider: "openai",
          model: "gpt-4o-mini",
        },
      };

      const result = extractAgentNodeFields(data);

      expect(result.promptSource).toBe("repository");
      expect(result.promptRefName).toBe("welcome-prompt");
      expect(result.promptRefVersionId).toBe("v2");
      expect(result.promptRefLabel).toBe("staging");
      expect(result.promptVariables).toEqual({ userName: "user.name" });
    });

    it("derives promptSource from promptRef for backward compatibility", () => {
      // Old data without explicit promptSource
      const data: AgentNodeConfig = {
        name: "Legacy Agent",
        promptRef: {
          name: "old-prompt",
          label: "production",
        },
        llm: {
          provider: "openai",
          model: "gpt-4o-mini",
        },
      };

      const result = extractAgentNodeFields(data);

      expect(result.promptSource).toBe("repository");
    });

    it("applies defaults for missing optional fields", () => {
      const data: AgentNodeConfig = {
        name: "Simple Agent",
        llm: {
          provider: "openai",
          model: "gpt-4o-mini",
        },
      };

      const result = extractAgentNodeFields(data);

      expect(result.promptSource).toBe("inline");
      expect(result.systemPrompt).toBe("");
      expect(result.model).toBe("gpt-4o-mini");
      expect(result.promptRefLabel).toBe("production");
    });
  });

  describe("buildAgentNodeData", () => {
    it("builds data for inline prompt", () => {
      const values = {
        name: "My Agent",
        promptSource: "inline" as const,
        systemPrompt: "Be helpful.",
        model: "gpt-4o",
        temperature: 0.7,
        historyStrategy: "simple" as const,
        historyMaxMessages: 10,
      };

      const result = buildAgentNodeData(values);

      expect(result.name).toBe("My Agent");
      expect(result.promptSource).toBe("inline");
      expect(result.systemPrompt).toBe("Be helpful.");
      expect(result.llm.model).toBe("gpt-4o");
      expect(result.llm.temperature).toBe(0.7);
      expect(result.history).toEqual({
        strategy: "simple",
        maxMessages: 10,
      });
    });

    it("builds data for repository prompt", () => {
      const values = {
        name: "Repo Agent",
        promptSource: "repository" as const,
        promptRefName: "my-prompt",
        promptRefVersionId: "v1",
        promptRefLabel: "production",
        promptVariables: { input: "user.message" },
        model: "gpt-4o-mini",
      };

      const result = buildAgentNodeData(values);

      expect(result.promptSource).toBe("repository");
      expect(result.promptRef).toEqual({
        name: "my-prompt",
        versionId: "v1",
        label: "production",
      });
      expect(result.promptVariables).toEqual({ input: "user.message" });
    });

    it("builds memory config when enabled", () => {
      const values = {
        name: "Memory Agent",
        model: "gpt-4o",
        memoryEnabled: true,
        memoryMaxResults: 20,
      };

      const result = buildAgentNodeData(values);

      expect(result.memory).toEqual({
        enabled: true,
        autoInject: true,
        maxResults: 20,
        recencyBias: 0.3,
      });
    });

    it("builds tools config when enabled", () => {
      const values = {
        name: "Tool Agent",
        model: "gpt-4o",
        enabledTools: ["web_search"],
        toolTimingOverrides: { web_search: "immediate" as const },
      };

      const result = buildAgentNodeData(values);

      expect(result.unifiedTools).toEqual({
        enabled: ["web_search"],
        mcpServers: undefined,
        toolTimingOverrides: { web_search: "immediate" },
      });
    });

    it("builds JSON schema response format", () => {
      const values = {
        name: "Schema Agent",
        model: "gpt-4o",
        responseFormatType: "json_schema" as const,
        responseFormatName: "Output",
        responseFormatSchema: '{"type": "object", "properties": {"result": {"type": "string"}}}',
      };

      const result = buildAgentNodeData(values);

      expect(result.responseFormat).toEqual({
        type: "json_schema",
        name: "Output",
        schema: { type: "object", properties: { result: { type: "string" } } },
        strict: true,
        method: "functionCalling",
      });
    });

    it("keeps existing response format on JSON parse error", () => {
      const existingData: AgentNodeConfig = {
        llm: { provider: "openai", model: "gpt-4o" },
        responseFormat: {
          type: "json_schema",
          name: "Existing",
          schema: { type: "string" },
          strict: true,
          method: "functionCalling",
        },
      };

      const values = {
        name: "Agent",
        model: "gpt-4o",
        responseFormatType: "json_schema" as const,
        responseFormatName: "NewFormat",
        responseFormatSchema: "invalid json {",
      };

      const result = buildAgentNodeData(values, existingData);

      expect(result.responseFormat).toEqual(existingData.responseFormat);
    });
  });
});

// =============================================================================
// GENERIC EXTRACTORS/BUILDERS
// =============================================================================

describe("extractWorkflowFields", () => {
  it("dispatches to correct extractor by node type", () => {
    const guardData: GuardNodeConfig = {
      name: "Test Guard",
      workers: ["safety_guard"],
      blockedMessage: "Blocked",
      terminateOnBlock: true,
    };

    const result = extractWorkflowFields("guard", guardData);

    expect(result.name).toBe("Test Guard");
    expect(result.workers).toEqual(["safety_guard"]);
  });

  it("returns data as-is for unknown node type", () => {
    const unknownData = { custom: "data" };

    const result = extractWorkflowFields("unknown_type" as never, unknownData);

    expect(result).toEqual({ custom: "data" });
  });
});

describe("buildWorkflowNodeData", () => {
  it("dispatches to correct builder by node type", () => {
    const endValues = {
      name: "End",
      outputTemplate: "Done!",
    };

    const result = buildWorkflowNodeData("end", endValues);

    expect(result.name).toBe("End");
    expect(result.outputTemplate).toBe("Done!");
  });

  it("returns values as-is for unknown node type", () => {
    const values = { custom: "value" };

    const result = buildWorkflowNodeData("unknown_type" as never, values);

    expect(result).toEqual({ custom: "value" });
  });
});

// =============================================================================
// ROUND-TRIP CONSISTENCY
// =============================================================================

describe("Round-trip consistency", () => {
  it("end node: extract → build → extract preserves values", () => {
    const original: EndNodeConfig = {
      name: "Complete",
      outputTemplate: "Thanks!",
    };

    const extracted = extractEndNodeFields(original);
    const rebuilt = buildEndNodeData(extracted);
    const reExtracted = extractEndNodeFields(rebuilt);

    expect(reExtracted).toEqual(extracted);
  });

  it("guard node: extract → build → extract preserves values", () => {
    const original: GuardNodeConfig = {
      name: "Safety",
      workers: ["safety_guard", "injection_guard"],
      blockedMessage: "Not allowed",
      terminateOnBlock: false,
    };

    const extracted = extractGuardNodeFields(original);
    const rebuilt = buildGuardNodeData(extracted);
    const reExtracted = extractGuardNodeFields(rebuilt);

    expect(reExtracted).toEqual(extracted);
  });

  it("transform node (template): extract → build → extract preserves values", () => {
    const original: TransformNodeConfig = {
      name: "Format",
      operation: {
        type: "template",
        template: "Hello {{name}}",
      },
      outputVariable: "greeting",
    };

    const extracted = extractTransformNodeFields(original);
    const rebuilt = buildTransformNodeData(extracted);
    const reExtracted = extractTransformNodeFields(rebuilt);

    expect(reExtracted).toEqual(extracted);
  });

  it("if-else node (expression): extract → build → extract preserves values", () => {
    const original: IfElseNodeConfig = {
      name: "Check",
      conditionType: "expression",
      condition: {
        left: "value",
        operator: "===",
        right: "test",
      },
    };

    const extracted = extractIfElseNodeFields(original);
    const rebuilt = buildIfElseNodeData(extracted);
    const reExtracted = extractIfElseNodeFields(rebuilt);

    expect(reExtracted).toEqual(extracted);
  });
});
