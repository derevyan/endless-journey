/**
 * Journey Node Form Extractors and Builders Tests
 *
 * Tests for extracting form values from node data and building node data from form values.
 * Covers message, condition, wait, webhook, start, end, questionnaire, CRM, agent, and teleport nodes.
 *
 * @module features/nodes/journey/forms/__tests__/node-form-extractors.test
 */

import { describe, expect, it } from "vitest";

import type { JourneyNode, JourneyNodeWithMetadata } from "../../react-flow-types";
import {
  extractCommonFields,
  extractMessageFields,
  extractConditionFields,
  extractWaitFields,
  extractWebhookFields,
  extractSimpleFields,
  extractStartFields,
  extractQuestionnaireFields,
  extractCrmFields,
  extractAgentFields,
  extractTeleportFields,
  extractTimerFields,
  extractTimeoutFields,
  extractHeaders,
  extractAuthFields,
  extractConditionRules,
  extractTagAction,
  extractVariableAction,
  extractCrmAction,
} from "../node-form-extractors";

import {
  buildMessageNodeData,
  buildConditionNodeData,
  buildWaitNodeData,
  buildWebhookNodeData,
  buildSimpleNodeData,
  buildStartNodeData,
  buildQuestionnaireNodeData,
  buildCrmNodeData,
  buildAgentNodeData,
  buildTeleportNodeData,
} from "../node-form-builders";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createNode(data: Record<string, unknown>, metadata?: Record<string, unknown>): JourneyNode {
  const node = {
    id: "test-node-1",
    type: "custom",
    position: { x: 0, y: 0 },
    data: { label: "Test Node", type: "message", ...data },
  } as unknown as JourneyNode;

  if (metadata) {
    (node as JourneyNodeWithMetadata).metadata = metadata as JourneyNodeWithMetadata["metadata"];
  }

  return node;
}

// =============================================================================
// COMMON FIELD EXTRACTORS
// =============================================================================

describe("Common Field Extractors", () => {
  describe("extractCommonFields", () => {
    it("extracts label and metadata fields", () => {
      const node = createNode(
        { label: "My Node", tags: ["tag1", "tag2"] },
        { notes: "Some notes", custom: { key: "value" } }
      );

      const result = extractCommonFields(node);

      expect(result.label).toBe("My Node");
      expect(result.tags).toEqual(["tag1", "tag2"]);
      expect(result.notes).toBe("Some notes");
      expect(result.customJson).toBe('{\n  "key": "value"\n}');
    });

    it("handles missing optional fields", () => {
      const node = createNode({ label: "Simple Node" });

      const result = extractCommonFields(node);

      expect(result.label).toBe("Simple Node");
      expect(result.tags).toEqual([]);
      expect(result.notes).toBe("");
      expect(result.customJson).toBe("");
    });
  });

  describe("extractTagAction", () => {
    it("extracts tag action from node data", () => {
      const node = createNode({
        tagAction: {
          tags: { add: ["new-tag"], remove: ["old-tag"] },
        },
      });

      const result = extractTagAction(node);

      expect(result).toEqual({
        tags: { add: ["new-tag"], remove: ["old-tag"] },
      });
    });

    it("returns undefined when no tag action", () => {
      const node = createNode({});

      const result = extractTagAction(node);

      expect(result).toBeUndefined();
    });
  });

  describe("extractVariableAction", () => {
    it("extracts variable operations from node data", () => {
      const node = createNode({
        variableAction: {
          userOperations: [{ id: "op-1", op: "set", key: "name", value: "test" }],
          journeyOperations: [{ op: "increment", key: "counter", amount: 1 }],
          globalOperations: [],
        },
      });

      const result = extractVariableAction(node);

      expect(result?.userOperations).toHaveLength(1);
      expect(result?.userOperations?.[0].key).toBe("name");
      expect(result?.journeyOperations).toHaveLength(1);
      // Ensures IDs are generated for operations without them
      expect(result?.journeyOperations?.[0].id).toBeDefined();
    });

    it("returns undefined when no variable action", () => {
      const node = createNode({});

      const result = extractVariableAction(node);

      expect(result).toBeUndefined();
    });
  });

  describe("extractCrmAction", () => {
    it("extracts CRM action from node data", () => {
      const node = createNode({
        crmAction: {
          pipelineId: "pipeline-1",
          stageId: "stage-2",
          notes: "Deal updated",
        },
      });

      const result = extractCrmAction(node);

      expect(result).toEqual({
        pipelineId: "pipeline-1",
        stageId: "stage-2",
        notes: "Deal updated",
      });
    });

    it("returns undefined when no CRM action", () => {
      const node = createNode({});

      const result = extractCrmAction(node);

      expect(result).toBeUndefined();
    });
  });
});

// =============================================================================
// TIMER AND TIMEOUT EXTRACTORS
// =============================================================================

describe("Timer and Timeout Extractors", () => {
  describe("extractTimerFields", () => {
    it("extracts timer from seconds", () => {
      const node = createNode({
        timer: { seconds: 3661 }, // 1h 1m 1s
      });

      const result = extractTimerFields(node);

      expect(result.timerHours).toBe(1);
      expect(result.timerMinutes).toBe(1);
      expect(result.timerSeconds).toBe(1);
    });

    it("handles missing timer", () => {
      const node = createNode({});

      const result = extractTimerFields(node);

      expect(result.timerDays).toBeUndefined();
      expect(result.timerHours).toBeUndefined();
      expect(result.timerMinutes).toBeUndefined();
      expect(result.timerSeconds).toBeUndefined();
    });
  });

  describe("extractTimeoutFields", () => {
    it("extracts timeout with target node", () => {
      const node = createNode({
        timeout: {
          seconds: 300,
          targetNodeId: "fallback-node",
        },
      });

      const result = extractTimeoutFields(node);

      expect(result.timeoutMinutes).toBe(5);
      expect(result.timeoutTargetNodeId).toBe("fallback-node");
    });

    it("extracts timeout with message", () => {
      const node = createNode({
        timeout: {
          seconds: 60,
          timeoutMessage: "Session timed out",
        },
      });

      const result = extractTimeoutFields(node);

      expect(result.timeoutMinutes).toBe(1);
      expect(result.timeoutMessage).toBe("Session timed out");
    });
  });
});

// =============================================================================
// MESSAGE NODE
// =============================================================================

describe("Message Node", () => {
  describe("extractMessageFields", () => {
    it("extracts all message fields", () => {
      const node = createNode(
        {
          label: "Welcome Message",
          type: "message",
          content: "Hello, world!",
          responseType: "text",
          storeResponseAs: "userInput",
          delay: 1000,
          buttons: [{ id: "btn-1", text: "Click me", targetNodeId: "next" }],
          media: { type: "image", url: "https://example.com/img.png" },
          timer: { seconds: 30 },
        },
        { status: "published" }
      );

      const result = extractMessageFields(node);

      expect(result.label).toBe("Welcome Message");
      expect(result.type).toBe("message");
      expect(result.content).toBe("Hello, world!");
      expect(result.responseType).toBe("text");
      expect(result.storeResponseAs).toBe("userInput");
      expect(result.delay).toBe(1000);
      expect(result.status).toBe("published");
    });

    it("handles minimal message node", () => {
      const node = createNode({ label: "Simple", type: "message" });

      const result = extractMessageFields(node);

      expect(result.label).toBe("Simple");
      expect(result.content).toBe("");
      expect(result.responseType).toBeUndefined();
      expect(result.status).toBe("draft");
    });
  });

  describe("buildMessageNodeData", () => {
    it("builds message data from form values", () => {
      const values = {
        label: "Test Message",
        type: "message",
        content: "Hello!",
        responseType: "buttons",
        storeResponseAs: "response",
        delay: 500,
        buttons: [{ id: "b1", text: "Yes", targetNodeId: "yes-node" }],
      };

      const result = buildMessageNodeData(values);

      expect(result.label).toBe("Test Message");
      expect(result.type).toBe("message");
      expect(result.content).toBe("Hello!");
      expect(result.responseType).toBe("buttons");
      expect(result.storeResponseAs).toBe("response");
      expect(result.delay).toBe(500);
    });

    it("omits empty/zero values", () => {
      const values = {
        label: "Minimal",
        type: "message",
        content: "",
        delay: 0,
      };

      const result = buildMessageNodeData(values);

      expect(result.content).toBeUndefined();
      expect(result.delay).toBeUndefined();
    });
  });
});

// =============================================================================
// CONDITION NODE
// =============================================================================

describe("Condition Node", () => {
  describe("extractConditionFields", () => {
    it("extracts condition fields with rules", () => {
      const node = createNode(
        {
          label: "Check Status",
          type: "condition",
          expression: "user.status === 'active'",
          rules: [
            { field: "user.age", operator: ">=", value: "18" },
            { field: "user.country", operator: "===", value: "US" },
          ],
          rulesOperator: "or",
        },
        { status: "draft" }
      );

      const result = extractConditionFields(node);

      expect(result.label).toBe("Check Status");
      expect(result.type).toBe("condition");
      expect(result.expression).toBe("user.status === 'active'");
      expect(result.rules).toHaveLength(2);
      expect(result.rulesOperator).toBe("or");
    });

    it("defaults rules operator to 'and'", () => {
      const node = createNode({ type: "condition" });

      const result = extractConditionFields(node);

      expect(result.rulesOperator).toBe("and");
      expect(result.rules).toEqual([]);
    });
  });

  describe("extractConditionRules", () => {
    it("extracts rules array", () => {
      const node = createNode({
        rules: [{ field: "x", operator: "===", value: "1" }],
      });

      const result = extractConditionRules(node);

      expect(result).toHaveLength(1);
      expect(result[0].field).toBe("x");
    });

    it("returns empty array when no rules", () => {
      const node = createNode({});

      const result = extractConditionRules(node);

      expect(result).toEqual([]);
    });
  });

  describe("buildConditionNodeData", () => {
    it("builds condition data with rules", () => {
      const values = {
        label: "Condition",
        type: "condition",
        expression: "a > b",
        rules: [{ field: "x", operator: ">", value: "5" }],
        rulesOperator: "and" as const,
      };

      const result = buildConditionNodeData(values);

      expect(result.expression).toBe("a > b");
      expect(result.rules).toHaveLength(1);
      expect(result.rulesOperator).toBe("and");
    });
  });
});

// =============================================================================
// WAIT NODE
// =============================================================================

describe("Wait Node", () => {
  describe("extractWaitFields", () => {
    it("extracts wait fields", () => {
      const node = createNode({
        label: "Wait Step",
        type: "wait",
        reason: "Waiting for user action",
        duration: { seconds: 86400 }, // 1 day
      });

      const result = extractWaitFields(node);

      expect(result.label).toBe("Wait Step");
      expect(result.reason).toBe("Waiting for user action");
    });
  });

  describe("buildWaitNodeData", () => {
    it("builds wait data", () => {
      const values = {
        label: "Wait",
        type: "wait",
        reason: "Processing",
        durationDays: 1,
        durationHours: 2,
      };

      const result = buildWaitNodeData(values);

      expect(result.label).toBe("Wait");
      expect(result.type).toBe("wait");
      expect(result.reason).toBe("Processing");
    });
  });
});

// =============================================================================
// WEBHOOK NODE
// =============================================================================

describe("Webhook Node", () => {
  describe("extractWebhookFields", () => {
    it("extracts all webhook fields", () => {
      const node = createNode({
        label: "API Call",
        type: "webhook",
        url: "https://api.example.com/data",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer xyz" },
        body: '{"key": "value"}',
        auth: { type: "bearer", token: "secret" },
        successPath: "data.result",
        storeAs: "apiResult",
        errorHandling: "retry",
        retryCount: 3,
        timeoutMs: 10000,
        mockResponse: {
          enabled: true,
          statusCode: 200,
          body: '{"mock": true}',
          delay: 100,
        },
      });

      const result = extractWebhookFields(node);

      expect(result.label).toBe("API Call");
      expect(result.url).toBe("https://api.example.com/data");
      expect(result.method).toBe("POST");
      expect(result.headers).toHaveLength(2);
      expect(result.body).toBe('{"key": "value"}');
      expect(result.authType).toBe("bearer");
      expect(result.authToken).toBe("secret");
      expect(result.successPath).toBe("data.result");
      expect(result.storeAs).toBe("apiResult");
      expect(result.errorHandling).toBe("retry");
      expect(result.retryCount).toBe(3);
      expect(result.timeoutMs).toBe(10000);
      expect(result.mockEnabled).toBe(true);
      expect(result.mockStatusCode).toBe(200);
    });

    it("applies defaults for missing fields", () => {
      const node = createNode({ type: "webhook" });

      const result = extractWebhookFields(node);

      expect(result.url).toBe("");
      expect(result.method).toBe("POST");
      expect(result.headers).toEqual([]);
      expect(result.authType).toBe("none");
      expect(result.errorHandling).toBe("continue");
      expect(result.timeoutMs).toBe(30000);
      expect(result.mockEnabled).toBe(false);
    });
  });

  describe("extractHeaders", () => {
    it("converts headers object to array", () => {
      const node = createNode({
        headers: { Accept: "application/json", "X-Custom": "value" },
      });

      const result = extractHeaders(node);

      expect(result).toEqual([
        { key: "Accept", value: "application/json" },
        { key: "X-Custom", value: "value" },
      ]);
    });
  });

  describe("extractAuthFields", () => {
    it("extracts bearer auth", () => {
      const node = createNode({
        auth: { type: "bearer", token: "my-token" },
      });

      const result = extractAuthFields(node);

      expect(result.authType).toBe("bearer");
      expect(result.authToken).toBe("my-token");
    });

    it("extracts basic auth", () => {
      const node = createNode({
        auth: { type: "basic", username: "user", password: "pass" },
      });

      const result = extractAuthFields(node);

      expect(result.authType).toBe("basic");
      expect(result.authUsername).toBe("user");
      expect(result.authPassword).toBe("pass");
    });

    it("extracts API key auth", () => {
      const node = createNode({
        auth: { type: "apiKey", headerName: "X-API-Key", apiKey: "key123" },
      });

      const result = extractAuthFields(node);

      expect(result.authType).toBe("apiKey");
      expect(result.authHeaderName).toBe("X-API-Key");
      expect(result.authApiKey).toBe("key123");
    });
  });

  describe("buildWebhookNodeData", () => {
    it("builds webhook data with auth", () => {
      const values = {
        label: "Webhook",
        url: "https://api.test.com",
        method: "GET",
        headers: [{ key: "Accept", value: "application/json" }],
        authType: "bearer",
        authToken: "token123",
        errorHandling: "fail",
        retryCount: 2,
      };

      const result = buildWebhookNodeData(values);

      expect(result.url).toBe("https://api.test.com");
      expect(result.method).toBe("GET");
      expect(result.headers).toEqual({ Accept: "application/json" });
      expect(result.auth).toEqual({ type: "bearer", token: "token123" });
      expect(result.errorHandling).toBe("fail");
      expect(result.retryCount).toBe(2);
    });

    it("builds mock response when enabled", () => {
      const values = {
        label: "Mock Webhook",
        url: "https://api.test.com",
        method: "POST",
        mockEnabled: true,
        mockStatusCode: 201,
        mockBody: '{"created": true}',
        mockDelay: 50,
      };

      const result = buildWebhookNodeData(values);

      expect(result.mockResponse).toEqual({
        enabled: true,
        statusCode: 201,
        body: '{"created": true}',
        delay: 50,
      });
    });
  });
});

// =============================================================================
// START NODE
// =============================================================================

describe("Start Node", () => {
  describe("extractStartFields", () => {
    it("extracts start node fields", () => {
      const node = createNode(
        {
          label: "Journey Start",
          type: "start",
          content: "Welcome to the journey!",
          media: { type: "image", url: "https://example.com/welcome.png" },
        },
        { status: "published" }
      );

      const result = extractStartFields(node);

      expect(result.label).toBe("Journey Start");
      expect(result.type).toBe("start");
      expect(result.content).toBe("Welcome to the journey!");
      expect(result.status).toBe("published");
    });
  });

  describe("buildStartNodeData", () => {
    it("builds start node data", () => {
      const values = {
        label: "Start",
        type: "start",
        content: "Let's begin",
      };

      const result = buildStartNodeData(values);

      expect(result.label).toBe("Start");
      expect(result.type).toBe("start");
      expect(result.content).toBe("Let's begin");
    });
  });
});

// =============================================================================
// END NODE (Simple)
// =============================================================================

describe("End Node (Simple)", () => {
  describe("extractSimpleFields", () => {
    it("extracts simple node fields", () => {
      const node = createNode(
        { label: "Finish", type: "end" },
        { status: "published" }
      );

      const result = extractSimpleFields(node);

      expect(result.label).toBe("Finish");
      expect(result.type).toBe("end");
      expect(result.status).toBe("published");
    });
  });

  describe("buildSimpleNodeData", () => {
    it("builds simple node data", () => {
      const values = {
        label: "End",
        type: "end",
      };

      const result = buildSimpleNodeData(values);

      expect(result.label).toBe("End");
      expect(result.type).toBe("end");
    });
  });
});

// =============================================================================
// QUESTIONNAIRE NODE
// =============================================================================

describe("Questionnaire Node", () => {
  describe("extractQuestionnaireFields", () => {
    it("extracts questionnaire fields", () => {
      const node = createNode(
        {
          label: "Survey",
          type: "questionnaire",
          questions: [
            { id: "q1", content: "What is your name?", responseType: "text" },
            { id: "q2", content: "Rate us", responseType: "buttons" },
          ],
          introduction: { content: "Welcome to our survey" },
          completion: { content: "Thank you!", delayBeforeTransition: 2000 },
          allowBack: true,
          shuffle: false,
          storeAllAs: "surveyResults",
          timeout: { seconds: 600, targetNodeId: "timeout-node" },
        },
        { status: "draft" }
      );

      const result = extractQuestionnaireFields(node);

      expect(result.label).toBe("Survey");
      expect(result.type).toBe("questionnaire");
      expect(result.introduction?.content).toBe("Welcome to our survey");
      expect(result.completion?.content).toBe("Thank you!");
      expect(result.completion?.delayBeforeTransition).toBe(2000);
      expect(result.allowBack).toBe(true);
      expect(result.shuffle).toBe(false);
      expect(result.storeAllAs).toBe("surveyResults");
    });

    it("handles minimal questionnaire", () => {
      const node = createNode({ type: "questionnaire" });

      const result = extractQuestionnaireFields(node);

      expect(result.introduction).toBeUndefined();
      expect(result.completion).toBeUndefined();
      expect(result.allowBack).toBe(false);
    });
  });

  describe("buildQuestionnaireNodeData", () => {
    it("builds questionnaire data", () => {
      const values = {
        label: "Quiz",
        type: "questionnaire",
        questions: [{ id: "q1", content: "Question 1" }],
        introduction: { content: "Intro" },
        completion: { content: "Done", delayBeforeTransition: 1000 },
        allowBack: true,
        shuffle: true,
        storeAllAs: "answers",
      };

      const result = buildQuestionnaireNodeData(values);

      expect(result.label).toBe("Quiz");
      expect(result.type).toBe("questionnaire");
      expect(result.introduction).toEqual({ content: "Intro" });
      expect(result.completion).toEqual({ content: "Done", delayBeforeTransition: 1000 });
      expect(result.allowBack).toBe(true);
      expect(result.shuffle).toBe(true);
      expect(result.storeAllAs).toBe("answers");
    });
  });
});

// =============================================================================
// CRM NODE
// =============================================================================

describe("CRM Node", () => {
  describe("extractCrmFields", () => {
    it("extracts CRM node fields", () => {
      const node = createNode(
        {
          label: "Update Deal",
          type: "crm",
          pipelineId: "pipeline-123",
          stageId: "stage-456",
          notes: "Deal progressed",
        },
        { status: "published" }
      );

      const result = extractCrmFields(node);

      expect(result.label).toBe("Update Deal");
      expect(result.type).toBe("crm");
      expect(result.pipelineId).toBe("pipeline-123");
      expect(result.stageId).toBe("stage-456");
      expect(result.crmNotes).toBe("Deal progressed");
      expect(result.status).toBe("published");
    });
  });

  describe("buildCrmNodeData", () => {
    it("builds CRM node data", () => {
      const values = {
        label: "CRM Update",
        type: "crm",
        pipelineId: "p1",
        stageId: "s2",
        crmNotes: "Stage updated",
      };

      const result = buildCrmNodeData(values);

      expect(result.label).toBe("CRM Update");
      expect(result.type).toBe("crm");
      expect(result.pipelineId).toBe("p1");
      expect(result.stageId).toBe("s2");
      expect(result.notes).toBe("Stage updated"); // crmNotes maps to notes
    });
  });
});

// =============================================================================
// AGENT NODE
// =============================================================================

describe("Agent Node", () => {
  describe("extractAgentFields", () => {
    it("extracts agent workflow fields", () => {
      const node = createNode(
        {
          label: "AI Agent",
          type: "agent",
          workflowKey: "customer-support",
          executionMode: "welcome_first",
          welcome: { message: "Hello! How can I help?" },
          initialPrompt: { template: "User context: {{context}}" },
          voiceMode: "enabled",
          voiceProfile: "professional",
          voiceProvider: "openai",
          timeout: { seconds: 300, timeoutMessage: "Session ended" },
          aiContext: { journeyContext: true, userContext: true },
        },
        { status: "draft" }
      );

      const result = extractAgentFields(node);

      expect(result.label).toBe("AI Agent");
      expect(result.type).toBe("agent");
      expect(result.workflowKey).toBe("customer-support");
      expect(result.executionMode).toBe("welcome_first");
      expect(result.welcome?.message).toBe("Hello! How can I help?");
      expect(result.initialPrompt?.template).toBe("User context: {{context}}");
      expect(result.voiceMode).toBe("enabled");
      expect(result.voiceProfile).toBe("professional");
      expect(result.voiceProvider).toBe("openai");
      expect(result.aiContext?.journeyContext).toBe(true);
      expect(result.status).toBe("draft");
    });

    it("handles minimal agent node", () => {
      const node = createNode({ type: "agent", workflowKey: "basic" });

      const result = extractAgentFields(node);

      expect(result.workflowKey).toBe("basic");
      expect(result.executionMode).toBeUndefined();
      expect(result.welcome).toBeUndefined();
    });
  });

  describe("buildAgentNodeData", () => {
    it("builds agent node data", () => {
      const values = {
        label: "Agent",
        type: "agent" as const,
        workflowKey: "support-flow",
        executionMode: "immediate" as const,
        welcome: { message: "Hi!" },
        initialPrompt: { template: "Help: {{query}}" },
        voiceMode: "enabled" as const,
        aiContext: { journeyContext: true },
      };

      const result = buildAgentNodeData(values);

      expect(result.label).toBe("Agent");
      expect(result.type).toBe("agent");
      expect(result.workflowKey).toBe("support-flow");
      expect(result.executionMode).toBe("immediate");
      expect(result.welcome).toEqual({ message: "Hi!" });
      expect(result.initialPrompt).toEqual({ template: "Help: {{query}}" });
      expect(result.voiceMode).toBe("enabled");
      expect(result.aiContext).toEqual({ journeyContext: true });
    });

    it("omits empty optional fields", () => {
      const values = {
        label: "Basic Agent",
        type: "agent" as const,
        workflowKey: "flow",
      };

      const result = buildAgentNodeData(values);

      expect(result.executionMode).toBeUndefined();
      expect(result.welcome).toBeUndefined();
      expect(result.voiceMode).toBeUndefined();
    });
  });
});

// =============================================================================
// TELEPORT NODE
// =============================================================================

describe("Teleport Node", () => {
  describe("extractTeleportFields", () => {
    it("extracts teleport fields", () => {
      const node = createNode(
        {
          label: "Go to Onboarding",
          type: "teleport",
          targetJourneyId: "journey-onboarding",
          targetNodeId: "step-1",
          preserveContext: true,
        },
        { status: "published" }
      );

      const result = extractTeleportFields(node);

      expect(result.label).toBe("Go to Onboarding");
      expect(result.type).toBe("teleport");
      expect(result.targetJourneyId).toBe("journey-onboarding");
      expect(result.targetNodeId).toBe("step-1");
      expect(result.preserveContext).toBe(true);
      expect(result.status).toBe("published");
    });

    it("defaults preserveContext to true", () => {
      const node = createNode({
        type: "teleport",
        targetJourneyId: "other-journey",
      });

      const result = extractTeleportFields(node);

      expect(result.preserveContext).toBe(true);
    });
  });

  describe("buildTeleportNodeData", () => {
    it("builds teleport node data", () => {
      const values = {
        label: "Teleport",
        type: "teleport" as const,
        targetJourneyId: "journey-2",
        targetNodeId: "node-5",
        preserveContext: false,
      };

      const result = buildTeleportNodeData(values);

      expect(result.label).toBe("Teleport");
      expect(result.type).toBe("teleport");
      expect(result.targetJourneyId).toBe("journey-2");
      expect(result.targetNodeId).toBe("node-5");
      expect(result.preserveContext).toBe(false);
    });
  });
});

// =============================================================================
// ROUND-TRIP CONSISTENCY
// =============================================================================

describe("Round-trip consistency", () => {
  it("message node: extract → build → extract preserves core values", () => {
    const original = createNode({
      label: "Test Message",
      type: "message",
      content: "Hello world",
      responseType: "text",
      storeResponseAs: "input",
    });

    const extracted = extractMessageFields(original);
    const built = buildMessageNodeData({
      label: extracted.label,
      type: extracted.type,
      content: extracted.content,
      responseType: extracted.responseType,
      storeResponseAs: extracted.storeResponseAs,
    });

    expect(built.label).toBe("Test Message");
    expect(built.content).toBe("Hello world");
    expect(built.responseType).toBe("text");
    expect(built.storeResponseAs).toBe("input");
  });

  it("condition node: extract → build → extract preserves core values", () => {
    const original = createNode({
      label: "Check",
      type: "condition",
      expression: "x > 5",
      rules: [{ field: "y", operator: "===", value: "test" }],
      rulesOperator: "or",
    });

    const extracted = extractConditionFields(original);
    const built = buildConditionNodeData({
      label: extracted.label,
      type: extracted.type,
      expression: extracted.expression,
      rules: extracted.rules,
      rulesOperator: extracted.rulesOperator,
    });

    expect(built.label).toBe("Check");
    expect(built.expression).toBe("x > 5");
    expect((built.rules as unknown[]).length).toBe(1);
    expect(built.rulesOperator).toBe("or");
  });

  it("webhook node: extract → build preserves auth config", () => {
    const original = createNode({
      label: "API",
      type: "webhook",
      url: "https://api.test.com",
      method: "POST",
      auth: { type: "bearer", token: "secret123" },
    });

    const extracted = extractWebhookFields(original);
    const built = buildWebhookNodeData({
      label: extracted.label,
      url: extracted.url,
      method: extracted.method,
      authType: extracted.authType,
      authToken: extracted.authToken,
    });

    expect(built.auth).toEqual({ type: "bearer", token: "secret123" });
  });
});
