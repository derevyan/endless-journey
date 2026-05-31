/**
 * Mock Data Generator for Node Outputs
 *
 * Generates realistic mock data for node outputs based on node type and configuration.
 * Used by the variable selector UI to show users what data structures they can access.
 *
 * Design principles:
 * - Dynamic: Uses actual node configuration when available
 * - Realistic: Generates meaningful example values
 * - Type-aware: Returns both data and type information
 */

import type { NodeType } from "../nodes";
import type { QuestionnaireNodeData, WebhookNodeData, AgentNodeData, Question } from "../nodes";

/**
 * Result from generating mock data
 */
export interface MockDataResult {
  /** The mock data object */
  data: unknown;
  /** Human-readable type string (e.g., "AgentNodeOutput", "Record<questionId, answer>") */
  typeString: string;
  /** Brief description of what this data represents */
  description: string;
}

/**
 * Generate realistic mock data for a node's output
 *
 * @param nodeType - The type of node to generate mock data for
 * @param nodeData - Optional node configuration for dynamic mock generation
 * @returns MockDataResult with data, type info, and description, or null if node produces no output
 *
 * @example
 * // Basic usage
 * const mock = generateNodeOutputMock("agent");
 * console.log(mock?.data); // { lastResponse: "...", conversationMetrics: {...} }
 *
 * @example
 * // With node configuration (questionnaire)
 * const mock = generateNodeOutputMock("questionnaire", {
 *   questions: [
 *     { id: "email", content: "What's your email?" },
 *     { id: "name", content: "What's your name?" }
 *   ]
 * });
 * console.log(mock?.data); // { email: "user@example.com", name: "Alice Johnson" }
 */
export function generateNodeOutputMock(nodeType: NodeType, nodeData?: unknown): MockDataResult | null {
  const generator = mockGenerators[nodeType];
  return generator ? generator(nodeData) : null;
}

/**
 * Generate a webhook body template for API integration
 *
 * @param variablePath - The variable path to reference (e.g., "nodes.Survey")
 * @returns JSON template string ready for webhook body
 */
export function generateWebhookBodyTemplate(variablePath: string): string {
  return JSON.stringify(
    {
      data: `{{${variablePath}}}`,
      userId: "{{user.id}}",
      sessionId: "{{session.id}}",
      timestamp: "{{session.startedAt}}",
    },
    null,
    2
  );
}

// =============================================================================
// MOCK GENERATORS BY NODE TYPE
// =============================================================================

type MockGenerator = (nodeData?: unknown) => MockDataResult;

const mockGenerators: Record<NodeType, MockGenerator | null> = {
  // Agent node - most complex output with conversation history
  agent: (data?: unknown) => {
    const nodeData = data as AgentNodeData | undefined;
    const workflowPreview = nodeData?.workflowKey ?? "default-workflow";

    return {
      data: {
        lastResponse: "I'd be happy to help you with that! Is there anything else you'd like to know?",
        lastSuccess: true,
        lastBlocked: false,
        lastBlockedMessage: null,
        lastToolCalls: [],
        lastDurationMs: 1250,
        lastTraceLength: 3,
        lastTurnTokens: 420,
        lastTurnCostUSD: 0.0084,
        allResponses: [
          {
            response: "Hello! How can I assist you today?",
            success: true,
            blocked: false,
            toolCalls: [],
            durationMs: 890,
            traceLength: 2,
            executedAt: "2026-01-05T10:00:00Z",
            userMessage: "/start",
            tokensUsed: 180,
            costUSD: 0.0036,
          },
          {
            response: "I'd be happy to help you with that! Is there anything else you'd like to know?",
            success: true,
            blocked: false,
            toolCalls: [],
            durationMs: 1250,
            traceLength: 3,
            executedAt: "2026-01-05T10:01:30Z",
            userMessage: "Tell me about your services",
            tokensUsed: 420,
            costUSD: 0.0084,
          },
        ],
        conversationMetrics: {
          turnCount: 2,
          messageCount: 4,
          totalTokens: 600,
          totalCostUSD: 0.012,
          conversationStartedAt: "2026-01-05T10:00:00Z",
          lastTurnAt: "2026-01-05T10:01:30Z",
        },
      },
      typeString: "AgentNodeOutput",
      description: `Agent conversation (workflow: ${workflowPreview})`,
    };
  },

  // Questionnaire - dynamic based on actual questions
  questionnaire: (data?: unknown) => {
    const nodeData = data as QuestionnaireNodeData | undefined;
    const responseMap: Record<string, string> = {};

    if (nodeData?.questions?.length) {
      for (const question of nodeData.questions) {
        responseMap[question.id] = generateRealisticAnswer(question);
      }
    } else {
      // Default mock when no questions defined
      responseMap["question_1"] = "Sample answer";
      responseMap["question_2"] = "Another response";
    }

    const questionCount = Object.keys(responseMap).length;
    return {
      data: responseMap,
      typeString: "Record<questionId, answer>",
      description: `${questionCount} question response${questionCount !== 1 ? "s" : ""}`,
    };
  },

  // Webhook - dynamic based on URL patterns or mock config
  webhook: (data?: unknown) => {
    const nodeData = data as WebhookNodeData | undefined;

    // Use mockResponse.body if configured (body is z.unknown(), could be any type)
    if (nodeData?.mockResponse?.enabled && nodeData.mockResponse.body !== undefined) {
      const body = nodeData.mockResponse.body;
      // If body is a string, try to parse it as JSON
      if (typeof body === "string") {
        try {
          const parsedBody = JSON.parse(body);
          return {
            data: parsedBody,
            typeString: "WebhookResponse (configured mock)",
            description: "Webhook response (from mock config)",
          };
        } catch {
          return {
            data: body,
            typeString: "string",
            description: "Webhook response (from mock config)",
          };
        }
      }
      // Otherwise return as-is (already an object)
      return {
        data: body,
        typeString: "WebhookResponse (configured mock)",
        description: "Webhook response (from mock config)",
      };
    }

    // Generate based on URL pattern
    const url = nodeData?.url?.toLowerCase() ?? "";
    let mockData: unknown;
    let context = "generic";

    if (url.includes("user") || url.includes("profile")) {
      mockData = {
        id: "usr_abc123",
        email: "user@example.com",
        name: "Alex Thompson",
        created_at: "2026-01-05T10:00:00Z",
      };
      context = "user";
    } else if (url.includes("order") || url.includes("purchase")) {
      mockData = {
        orderId: "ord_xyz789",
        status: "completed",
        total: 99.99,
        currency: "USD",
        items: [{ sku: "ITEM-001", qty: 2, price: 49.99 }],
      };
      context = "order";
    } else if (url.includes("payment") || url.includes("charge")) {
      mockData = {
        paymentId: "pay_def456",
        status: "succeeded",
        amount: 9999,
        currency: "usd",
        receipt_url: "https://pay.example.com/receipt/abc",
      };
      context = "payment";
    } else if (url.includes("crm") || url.includes("contact") || url.includes("lead")) {
      mockData = {
        contactId: "con_ghi789",
        stage: "qualified",
        score: 85,
        last_activity: "2026-01-05T09:30:00Z",
      };
      context = "crm";
    } else {
      mockData = {
        success: true,
        data: { id: "item_123", status: "ok" },
        timestamp: "2026-01-05T10:00:00Z",
      };
    }

    return {
      data: mockData,
      typeString: "Record<string, unknown>",
      description: `Webhook API response (${context})`,
    };
  },

  // Message node - delivery metadata
  message: () => ({
    data: {
      message: "Your message content here",
      messageDelivered: true,
      mediaAttached: null,
      sentAt: "2026-01-05T10:00:00Z",
      responseType: "text",
      buttonsDisplayed: null,
      delayApplied: null,
      timerScheduled: false,
    },
    typeString: "MessageNodeOutput",
    description: "Message delivery metadata",
  }),

  // Wait node - timing information
  wait: () => ({
    data: {
      duration: 5,
      delayMs: 5000,
      timerScheduledAt: "2026-01-05T10:00:00Z",
      expectedCompletionAt: "2026-01-05T10:00:05Z",
    },
    typeString: "WaitNodeOutput",
    description: "Wait timer metadata",
  }),

  // Condition node - evaluation result
  condition: () => ({
    data: {
      branchId: "branch_true",
      evaluatedAt: "2026-01-05T10:00:00Z",
    },
    typeString: "ConditionNodeOutput",
    description: "Condition evaluation result",
  }),

  // CRM node - operation result
  crm: () => ({
    data: {
      success: true,
      message: "Contact moved to stage: Qualified",
    },
    typeString: "CrmNodeOutput",
    description: "CRM operation result",
  }),

  // Start node - journey initialization
  start: () => ({
    data: {
      message: "Welcome to our journey!",
      messageDelivered: true,
      mediaAttached: null,
      journeyStartedAt: "2026-01-05T10:00:00Z",
    },
    typeString: "StartNodeOutput",
    description: "Journey start metadata",
  }),

  // End node - journey completion
  end: () => ({
    data: {
      message: "Thank you for completing the journey!",
      messageDelivered: true,
      mediaAttached: null,
      journeyCompletedAt: "2026-01-05T10:05:00Z",
      sessionStatus: "completed",
    },
    typeString: "EndNodeOutput",
    description: "Journey completion metadata",
  }),

  // Teleport produces no output
  teleport: null,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a realistic answer based on question content and type
 */
function generateRealisticAnswer(question: Question): string {
  // If buttons, return first button text
  if (question.responseType === "buttons" && question.buttons?.length) {
    return question.buttons[0].text;
  }

  // Analyze question content for patterns
  const content = question.content.toLowerCase();

  // Email patterns
  if (content.includes("email") || content.includes("e-mail")) {
    return "user@example.com";
  }

  // Name patterns
  if (content.includes("name") || content.includes("who are you") || content.includes("introduce")) {
    if (content.includes("full")) return "Alice Marie Johnson";
    if (content.includes("last") || content.includes("surname") || content.includes("family")) return "Johnson";
    if (content.includes("first") || content.includes("given")) return "Alice";
    return "Alice Johnson";
  }

  // Phone patterns
  if (content.includes("phone") || content.includes("mobile") || content.includes("number") || content.includes("cell")) {
    return "+1 555-123-4567";
  }

  // Age patterns
  if (content.includes("age") || content.includes("old are you") || content.includes("birth")) {
    return "32";
  }

  // Company/work patterns
  if (content.includes("company") || content.includes("work") || content.includes("employer") || content.includes("organization")) {
    return "Acme Corporation";
  }

  // Job title patterns
  if (content.includes("role") || content.includes("title") || content.includes("position") || content.includes("job")) {
    return "Product Manager";
  }

  // Location patterns
  if (content.includes("country") || content.includes("location") || content.includes("where") || content.includes("city")) {
    return "San Francisco, CA";
  }

  // Rating patterns (1-5, 1-10)
  if (content.includes("rate") || content.includes("rating") || content.includes("score") || content.includes("scale")) {
    if (content.includes("10") || content.includes("ten")) return "8";
    return "4";
  }

  // Yes/No patterns
  if (
    content.includes("do you") ||
    content.includes("would you") ||
    content.includes("are you") ||
    content.includes("have you") ||
    content.includes("can you")
  ) {
    return "Yes";
  }

  // Preference patterns
  if (content.includes("prefer") || content.includes("favorite") || content.includes("favourite") || content.includes("like")) {
    return "The first option";
  }

  // Feedback/comment patterns
  if (
    content.includes("feedback") ||
    content.includes("comment") ||
    content.includes("suggestion") ||
    content.includes("thoughts") ||
    content.includes("tell us")
  ) {
    return "Great experience overall, very helpful!";
  }

  // Default response
  return "Sample response text";
}

// =============================================================================
// BUILT-IN VARIABLE MOCK GENERATORS
// =============================================================================

/**
 * Built-in variable categories
 */
export type BuiltinVariableCategory = "user" | "session" | "response" | "vars" | "mindstate";

/**
 * Generate mock data for built-in variables (user, session, response, vars, mindstate)
 *
 * @param category - The variable category (e.g., "user", "session")
 * @param property - The property path within the category (e.g., "id", "email")
 * @returns MockDataResult with mock value and type info
 *
 * @example
 * generateBuiltinVariableMock("user", "email")
 * // => { data: "alex@example.com", typeString: "string", description: "User email" }
 */
export function generateBuiltinVariableMock(category: BuiltinVariableCategory, property: string): MockDataResult {
  const generator = builtinMockGenerators[category];
  return generator(property);
}

const builtinMockGenerators: Record<BuiltinVariableCategory, (property: string) => MockDataResult> = {
  user: (property: string): MockDataResult => {
    const lowerProperty = property.toLowerCase();

    if (lowerProperty.includes("id")) {
      return { data: "usr_abc123", typeString: "string", description: "User ID" };
    }
    if (lowerProperty.includes("email")) {
      return { data: "alex@example.com", typeString: "string", description: "User email" };
    }
    if (lowerProperty.includes("firstname") || lowerProperty === "name") {
      return { data: "Alex", typeString: "string", description: "User first name" };
    }
    if (lowerProperty.includes("lastname")) {
      return { data: "Thompson", typeString: "string", description: "User last name" };
    }
    if (lowerProperty.includes("phone")) {
      return { data: "+1 555-123-4567", typeString: "string", description: "User phone" };
    }
    return { data: "user_value", typeString: "string", description: "User property" };
  },

  session: (property: string): MockDataResult => {
    const lowerProperty = property.toLowerCase();

    if (lowerProperty.includes("id")) {
      return { data: "ses_xyz789", typeString: "string", description: "Session ID" };
    }
    if (lowerProperty.includes("started")) {
      return { data: "2026-01-05T10:00:00Z", typeString: "string", description: "Session start time" };
    }
    if (lowerProperty.includes("status")) {
      return { data: "active", typeString: "string", description: "Session status" };
    }
    return { data: "session_value", typeString: "string", description: "Session property" };
  },

  response: (property: string): MockDataResult => {
    // No property - return full response
    if (!property) {
      return {
        data: "Tell me more about your pricing",
        typeString: "string",
        description: "User's last message or button click",
      };
    }

    const lowerProperty = property.toLowerCase();

    if (lowerProperty === "type") {
      return { data: "text", typeString: "string", description: "Response type (text, button, etc.)" };
    }
    if (lowerProperty === "value" || lowerProperty === "text" || lowerProperty === "message") {
      return { data: "Tell me more about your pricing", typeString: "string", description: "Response content" };
    }
    if (lowerProperty === "timestamp" || lowerProperty === "time" || lowerProperty === "at") {
      return { data: "2026-01-06T10:30:00Z", typeString: "string", description: "Response timestamp" };
    }
    if (lowerProperty === "buttonid" || lowerProperty === "button") {
      return { data: "btn_pricing", typeString: "string", description: "Clicked button ID" };
    }
    if (lowerProperty === "intent") {
      return { data: "pricing_inquiry", typeString: "string", description: "Detected intent" };
    }
    return { data: "response_value", typeString: "string", description: "Response property" };
  },

  vars: (property: string): MockDataResult => {
    return {
      data: property ? `custom_${property}_value` : "custom_value",
      typeString: "string",
      description: "Custom journey variable",
    };
  },

  mindstate: (property: string): MockDataResult => {
    if (!property) {
      return {
        data: { score: 85, stage: "engaged" },
        typeString: "object",
        description: "Mindstate parameters",
      };
    }

    const lowerProperty = property.toLowerCase();
    if (lowerProperty === "score") {
      return { data: 85, typeString: "number", description: "Mindstate score" };
    }
    if (lowerProperty === "stage") {
      return { data: "engaged", typeString: "string", description: "Mindstate stage" };
    }
    return { data: "mindstate_value", typeString: "string", description: "Mindstate property" };
  },
};

// =============================================================================
// PATH RESOLUTION UTILITIES
// =============================================================================

/**
 * Resolve a nested path in an object
 *
 * @param obj - The object to traverse
 * @param path - Dot-separated path (e.g., "lastResponse" or "conversationMetrics.turnCount")
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * resolvePathInObject({ a: { b: 1 } }, "a.b") // => 1
 * resolvePathInObject({ a: { b: 1 } }, "a.c") // => undefined
 */
export function resolvePathInObject(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Get human-readable type string for a value
 */
export function getTypeString(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `Array[${value.length}]`;
  const type = typeof value;
  if (type === "string") return "string";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "object") return "object";
  return type;
}

/**
 * Resolve mock data to a specific property path
 *
 * @param mockResult - Full mock data result from generateNodeOutputMock
 * @param propertyPath - Dot-separated path to resolve (e.g., "lastResponse")
 * @returns MockDataResult with only the accessed property value
 *
 * @example
 * const fullMock = generateNodeOutputMock("agent", nodeData);
 * const resolved = resolveMockDataPath(fullMock, "lastResponse");
 * // => { data: "I'd be happy to help...", typeString: "string", description: "..." }
 */
export function resolveMockDataPath(mockResult: MockDataResult, propertyPath: string): MockDataResult {
  if (!propertyPath) return mockResult;

  const resolvedValue = resolvePathInObject(mockResult.data, propertyPath);

  return {
    data: resolvedValue,
    typeString: getTypeString(resolvedValue),
    description: `${mockResult.description} → .${propertyPath}`,
  };
}

// =============================================================================
// SCHEMA-BASED MOCK GENERATION
// =============================================================================

export { generateMockFromSchema, generateSchemaPathMock, generateFullSchemaMock } from "./schema-mock-generator";

// =============================================================================
// WORKFLOW NODE MOCKS
// =============================================================================

export { generateWorkflowNodeMock } from "./workflow-node-mocks";
