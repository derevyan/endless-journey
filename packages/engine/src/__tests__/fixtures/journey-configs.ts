import type { ButtonConfig, JourneyConfig, NodeMetadata } from "@journey/schemas";

// Helper to create metadata
const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

// Helper to create buttons with target node references
export const btn = (id: string, text: string, targetNodeId?: string): ButtonConfig => ({
  id,
  text,
  targetNodeId,
});

/**
 * Simple linear journey: Start → Message → End
 */
export const linearJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome to the journey!",
      },
      metadata: createMetadata(),
    },
    {
      id: "msg-1",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Info Message",
        content: "This is an informational message.",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Journey completed!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "msg-1",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "msg-1",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with button-based navigation
 */
export const buttonJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome! Choose an option:",
      },
      metadata: createMetadata(),
    },
    {
      id: "msg-with-buttons",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Question",
        content: "What would you like to do?",
        responseType: "buttons",
        buttons: [btn("btn-opt-a", "Option A", "option-a"), btn("btn-opt-b", "Option B", "option-b")],
      },
      metadata: createMetadata(),
    },
    {
      id: "option-a",
      type: "custom",
      position: { x: -100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Option A Response",
        content: "You selected Option A!",
      },
      metadata: createMetadata(),
    },
    {
      id: "option-b",
      type: "custom",
      position: { x: 100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Option B Response",
        content: "You selected Option B!",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Thank you!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "msg-with-buttons",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "msg-with-buttons",
      target: "option-a",
      edgeType: "default",
      label: "Option A",
    },
    {
      id: "e3",
      source: "msg-with-buttons",
      target: "option-b",
      edgeType: "default",
      label: "Option B",
    },
    {
      id: "e4",
      source: "option-a",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e5",
      source: "option-b",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with wait node (timer)
 */
export const waitJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting journey with delay...",
      },
      metadata: createMetadata(),
    },
    {
      id: "wait",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "wait",
        schemaVersion: 1,
        label: "Wait",
        duration: { seconds: 2 },
      },
      metadata: createMetadata(),
    },
    {
      id: "after-wait",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "After Wait",
        content: "Wait completed!",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "wait",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "wait",
      target: "after-wait",
      edgeType: "timer",
      label: "After 2 seconds",
    },
    {
      id: "e3",
      source: "after-wait",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with message timer (user can click or wait)
 */
export const messageWithTimerJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome!",
      },
      metadata: createMetadata(),
    },
    {
      id: "msg-with-timer",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message with Timer",
        content: "Click continue or wait 5 seconds",
        responseType: "buttons",
        buttons: [btn("btn-continue", "Continue", "clicked")],
        timer: { seconds: 5 },
      },
      metadata: createMetadata(),
    },
    {
      id: "clicked",
      type: "custom",
      position: { x: -100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "User Clicked",
        content: "You clicked the button!",
      },
      metadata: createMetadata(),
    },
    {
      id: "timeout",
      type: "custom",
      position: { x: 100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Timeout",
        content: "Time expired, moving forward.",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "msg-with-timer",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "msg-with-timer",
      target: "clicked",
      edgeType: "default",
      label: "Continue",
    },
    {
      id: "e3",
      source: "msg-with-timer",
      target: "timeout",
      edgeType: "timer",
      label: "5s timeout",
    },
    {
      id: "e4",
      source: "clicked",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e5",
      source: "timeout",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with condition node
 */
export const conditionJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting conditional journey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "condition",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "condition",
        schemaVersion: 1,
        label: "Check Condition",
        rulesOperator: "and",
        branches: [
          { id: "yes-branch", label: "Yes" },
          { id: "no-branch", label: "No", isDefault: true },
        ],
      },
      metadata: createMetadata(),
    },
    {
      id: "yes-path",
      type: "custom",
      position: { x: -100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Yes Path",
        content: "Condition was true!",
      },
      metadata: createMetadata(),
    },
    {
      id: "no-path",
      type: "custom",
      position: { x: 100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "No Path",
        content: "Condition was false!",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "condition",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "condition",
      target: "yes-path",
      edgeType: "success",
      label: "Yes",
    },
    {
      id: "e3",
      source: "condition",
      target: "no-path",
      edgeType: "default",
      label: "No (default)",
    },
    {
      id: "e4",
      source: "yes-path",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e5",
      source: "no-path",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with webhook node (uses mock response to avoid real HTTP calls in tests)
 */
export const webhookJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting API call journey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "webhook",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "webhook",
        schemaVersion: 1,
        label: "API Call",
        url: "https://api.example.com/data",
        method: "POST",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 200,
          body: { success: true, message: "Mock response" },
          delay: 0,
        },
      },
      metadata: createMetadata(),
    },
    {
      id: "after-api",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "After API",
        content: "API call completed!",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "webhook",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "webhook",
      target: "after-api",
      edgeType: "success",
      label: "Success",
    },
    {
      id: "e3",
      source: "after-api",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with condition node using expression evaluation
 */
export const conditionExpressionJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting expression-based condition journey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "condition",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "condition",
        schemaVersion: 1,
        label: "Check Score",
        expression: "score > 50",
        rulesOperator: "and",
        branches: [
          { id: "high", label: "Yes" },
          { id: "low", label: "No", isDefault: true },
        ],
      },
      metadata: createMetadata(),
    },
    {
      id: "high-score",
      type: "custom",
      position: { x: -100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "High Score",
        content: "Your score is high!",
      },
      metadata: createMetadata(),
    },
    {
      id: "low-score",
      type: "custom",
      position: { x: 100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Low Score",
        content: "Your score is low.",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "condition",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "condition",
      target: "high-score",
      sourceHandle: "high",
      edgeType: "success",
      label: "Yes",
    },
    {
      id: "e3",
      source: "condition",
      target: "low-score",
      sourceHandle: "low",
      edgeType: "default",
      label: "No",
    },
    {
      id: "e4",
      source: "high-score",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e5",
      source: "low-score",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with condition node using rule-based evaluation
 */
export const conditionRulesJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting rule-based condition journey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "condition",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "condition",
        schemaVersion: 1,
        label: "Check Rules",
        rules: [{ field: "tier", operator: "equals", value: "premium" }],
        rulesOperator: "and",
        branches: [
          { id: "premium", label: "Yes" },
          { id: "standard", label: "No", isDefault: true },
        ],
      },
      metadata: createMetadata(),
    },
    {
      id: "premium-path",
      type: "custom",
      position: { x: -100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Premium",
        content: "Welcome, premium user!",
      },
      metadata: createMetadata(),
    },
    {
      id: "standard-path",
      type: "custom",
      position: { x: 100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Standard",
        content: "Welcome, standard user!",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "condition",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "condition",
      target: "premium-path",
      sourceHandle: "premium",
      edgeType: "success",
      label: "Yes",
    },
    {
      id: "e3",
      source: "condition",
      target: "standard-path",
      sourceHandle: "standard",
      edgeType: "default",
      label: "No",
    },
    {
      id: "e4",
      source: "premium-path",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e5",
      source: "standard-path",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with webhook using mock response
 */
export const webhookMockJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting mock webhook journey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "webhook",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "webhook",
        schemaVersion: 1,
        label: "API Call",
        url: "https://api.example.com/users/{{userId}}",
        method: "GET",
        storeAs: "apiResult",
        successPath: "$.data.name",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 200,
          body: { data: { name: "John Doe", score: 85 } },
          delay: 10,
        },
      },
      metadata: createMetadata(),
    },
    {
      id: "after-api",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "After API",
        content: "API returned successfully!",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "webhook",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "webhook",
      target: "after-api",
      edgeType: "success",
      label: "Success",
    },
    {
      id: "e3",
      source: "after-api",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with webhook using mock error response
 */
export const webhookMockErrorJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting mock error webhook journey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "webhook",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "webhook",
        schemaVersion: 1,
        label: "API Call",
        url: "https://api.example.com/data",
        method: "POST",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 500,
          body: { error: "Internal Server Error" },
          delay: 0,
        },
      },
      metadata: createMetadata(),
    },
    {
      id: "error-handler",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Error Handler",
        content: "API call failed, but continuing...",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "webhook",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "webhook",
      target: "error-handler",
      edgeType: "retry",
      label: "Error",
    },
    {
      id: "e3",
      source: "error-handler",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with storeResponseAs - stores button response in custom variable
 */
export const responseStorageJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome! Please select an option.",
      },
      metadata: createMetadata(),
    },
    {
      id: "question",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Question",
        content: "Which plan do you want?",
        buttons: [btn("btn-basic", "Basic", "confirmation"), btn("btn-pro", "Pro", "confirmation"), btn("btn-enterprise", "Enterprise", "confirmation")],
        responseType: "buttons",
        storeResponseAs: "selectedPlan",
      },
      metadata: createMetadata(),
    },
    {
      id: "confirmation",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Confirmation",
        content: "You selected a plan!",
        responseType: "auto",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "question",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "question",
      target: "confirmation",
      edgeType: "default",
      label: "User responds",
    },
    {
      id: "e3",
      source: "confirmation",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with text response type
 */
export const textResponseJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome!",
      },
      metadata: createMetadata(),
    },
    {
      id: "text-input",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Feedback",
        content: "What is your main challenge?",
        responseType: "text",
        storeResponseAs: "userChallenge",
      },
      metadata: createMetadata(),
    },
    {
      id: "thanks",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Thanks",
        content: "Thanks for your feedback!",
        responseType: "auto",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "text-input",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "text-input",
      target: "thanks",
      edgeType: "default",
      label: "User responds",
    },
    {
      id: "e3",
      source: "thanks",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with "any" response type (buttons + text)
 */
export const anyResponseJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome!",
      },
      metadata: createMetadata(),
    },
    {
      id: "flexible-input",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Question",
        content: "Click a button or type your response:",
        buttons: [btn("btn-any-a", "Option A", "result"), btn("btn-any-b", "Option B", "result")],
        responseType: "any",
        storeResponseAs: "userChoice",
      },
      metadata: createMetadata(),
    },
    {
      id: "result",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Result",
        content: "Got your response!",
        responseType: "auto",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "flexible-input",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "flexible-input",
      target: "result",
      edgeType: "default",
      label: "User responds",
    },
    {
      id: "e3",
      source: "result",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Complex multi-path journey
 */
export const complexJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome to the complex journey!",
      },
      metadata: createMetadata(),
    },
    {
      id: "question-1",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Question 1",
        content: "Do you want to continue?",
        responseType: "buttons",
        buttons: [btn("btn-yes", "Yes", "wait-node"), btn("btn-no", "No", "declined")],
      },
      metadata: createMetadata(),
    },
    {
      id: "wait-node",
      type: "custom",
      position: { x: -100, y: 200 },
      data: {
        type: "wait",
        schemaVersion: 1,
        label: "Wait",
        duration: { seconds: 1 },
      },
      metadata: createMetadata(),
    },
    {
      id: "question-2",
      type: "custom",
      position: { x: -100, y: 300 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Question 2",
        content: "Choose your path:",
        responseType: "buttons",
        buttons: [btn("btn-path-a", "Path A", "path-a-msg"), btn("btn-path-b", "Path B", "path-b-msg")],
      },
      metadata: createMetadata(),
    },
    {
      id: "path-a-msg",
      type: "custom",
      position: { x: -200, y: 400 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Path A",
        content: "You chose Path A!",
      },
      metadata: createMetadata(),
    },
    {
      id: "path-b-msg",
      type: "custom",
      position: { x: 0, y: 400 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Path B",
        content: "You chose Path B!",
      },
      metadata: createMetadata(),
    },
    {
      id: "declined",
      type: "custom",
      position: { x: 100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Declined",
        content: "You declined to continue.",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 500 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Journey completed!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "question-1",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "question-1",
      target: "wait-node",
      edgeType: "default",
      label: "Yes",
    },
    {
      id: "e3",
      source: "question-1",
      target: "declined",
      edgeType: "default",
      label: "No",
    },
    {
      id: "e4",
      source: "wait-node",
      target: "question-2",
      edgeType: "timer",
      label: "After 1 second",
    },
    {
      id: "e5",
      source: "question-2",
      target: "path-a-msg",
      edgeType: "default",
      label: "Path A",
    },
    {
      id: "e6",
      source: "question-2",
      target: "path-b-msg",
      edgeType: "default",
      label: "Path B",
    },
    {
      id: "e7",
      source: "path-a-msg",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e8",
      source: "path-b-msg",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e9",
      source: "declined",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with tag actions on nodes
 */
export const tagActionJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome!",
        tagAction: {
          tags: { add: ["new_user", "started"] },
        },
      },
      metadata: createMetadata(),
    },
    {
      id: "msg-1",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message",
        content: "Processing your request...",
        tagAction: {
          tags: { add: ["processing"], remove: ["started"] },
        },
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
        tagAction: {
          tags: { add: ["completed_journey", "finished"], remove: ["processing"] },
        },
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "msg-1",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "msg-1",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey with variable actions on nodes
 */
export const variableActionJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome!",
        variableAction: {
          journeyOperations: [{ op: "set", key: "visitCount", value: 1 }],
          globalOperations: [{ op: "increment", key: "totalVisits", amount: 1 }],
        },
      },
      metadata: createMetadata(),
    },
    {
      id: "msg-1",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message",
        content: "Processing...",
        variableAction: {
          journeyOperations: [{ op: "increment", key: "visitCount", amount: 1 }],
          userOperations: [{ op: "set", key: "lastAction", value: "processing" }],
        },
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
        variableAction: {
          journeyOperations: [{ op: "set", key: "completed", value: true }],
        },
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "msg-1",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "msg-1",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Journey without start node (for error testing)
 */
export const noStartNodeJourney: JourneyConfig = {
  nodes: [
    {
      id: "msg-1",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message",
        content: "Hello!",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "msg-1",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

// =============================================================================
// QUESTIONNAIRE JOURNEYS
// =============================================================================

/**
 * Basic questionnaire journey: Start → Questionnaire (3 questions) → End
 * Tests: intro, questions, completion, response storage
 */
export const questionnaireJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Welcome! You'll be asked a few questions.",
      },
      metadata: createMetadata(),
    },
    {
      id: "questionnaire",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "questionnaire",
        schemaVersion: 1,
        label: "Customer Survey",
        questions: [
          {
            id: "q1",
            content: "What is your name?",
            responseType: "text",
            storeResponseAs: "userName",
            required: true,
          },
          {
            id: "q2",
            content: "What is your favorite color?",
            responseType: "buttons",
            buttons: [
              { id: "btn-red", text: "Red" },
              { id: "btn-blue", text: "Blue" },
              { id: "btn-green", text: "Green" },
            ],
            storeResponseAs: "favoriteColor",
            required: true,
          },
          {
            id: "q3",
            content: "How would you rate our service?",
            responseType: "buttons",
            buttons: [
              { id: "btn-great", text: "Great" },
              { id: "btn-good", text: "Good" },
              { id: "btn-poor", text: "Poor" },
            ],
            storeResponseAs: "rating",
            required: true,
          },
        ],
        introduction: { content: "Welcome to our customer survey! This will only take a minute." },
        completion: { content: "Thank you for completing the survey!", delayBeforeTransition: 0 },
        storeAllAs: "surveyResponses",
        allowBack: false,
        shuffle: false,
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Survey completed. Have a great day!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "questionnaire",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "questionnaire",
      target: "end",
      edgeType: "default",
      label: "Complete",
    },
  ],
};

/**
 * Questionnaire with back navigation enabled
 */
export const questionnaireWithBackJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting survey with back navigation...",
      },
      metadata: createMetadata(),
    },
    {
      id: "questionnaire",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "questionnaire",
        schemaVersion: 1,
        label: "Survey with Back",
        questions: [
          {
            id: "q1",
            content: "Question 1?",
            responseType: "buttons",
            buttons: [
              { id: "btn-q1-a", text: "Option A" },
              { id: "btn-q1-b", text: "Option B" },
            ],
            required: true,
          },
          {
            id: "q2",
            content: "Question 2?",
            responseType: "buttons",
            buttons: [
              { id: "btn-q2-a", text: "Option A" },
              { id: "btn-q2-b", text: "Option B" },
            ],
            required: true,
          },
          {
            id: "q3",
            content: "Question 3?",
            responseType: "buttons",
            buttons: [
              { id: "btn-q3-a", text: "Option A" },
              { id: "btn-q3-b", text: "Option B" },
            ],
            required: true,
          },
        ],
        completion: { content: "Done!", delayBeforeTransition: 0 },
        allowBack: true,
        shuffle: false,
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Survey completed!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "questionnaire",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "questionnaire",
      target: "end",
      edgeType: "default",
      label: "Complete",
    },
  ],
};

/**
 * Questionnaire with timeout
 */
export const questionnaireWithTimeoutJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting timed survey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "questionnaire",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "questionnaire",
        schemaVersion: 1,
        label: "Timed Survey",
        questions: [
          {
            id: "q1",
            content: "Question 1?",
            responseType: "buttons",
            buttons: [
              { id: "btn-q1-yes", text: "Yes" },
              { id: "btn-q1-no", text: "No" },
            ],
            required: true,
          },
          {
            id: "q2",
            content: "Question 2?",
            responseType: "buttons",
            buttons: [
              { id: "btn-q2-yes", text: "Yes" },
              { id: "btn-q2-no", text: "No" },
            ],
            required: true,
          },
        ],
        timeout: { seconds: 60, targetNodeId: "timeout-handler" },
        completion: { content: "Survey completed!", delayBeforeTransition: 0 },
        allowBack: false,
        shuffle: false,
      },
      metadata: createMetadata(),
    },
    {
      id: "timeout-handler",
      type: "custom",
      position: { x: 100, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Timeout",
        content: "Sorry, time is up! The survey has expired.",
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "questionnaire",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "questionnaire",
      target: "end",
      edgeType: "default",
      label: "Complete",
    },
    {
      id: "e-timeout",
      source: "questionnaire",
      target: "timeout-handler",
      edgeType: "timer",
      label: "Timeout",
    },
    {
      id: "e3",
      source: "timeout-handler",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
};

/**
 * Questionnaire with skip conditions
 */
export const questionnaireWithSkipJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting conditional survey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "questionnaire",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "questionnaire",
        schemaVersion: 1,
        label: "Conditional Survey",
        questions: [
          {
            id: "q1",
            content: "Do you have a team?",
            responseType: "buttons",
            buttons: [
              { id: "btn-yes", text: "Yes" },
              { id: "btn-no", text: "No" },
            ],
            storeResponseAs: "hasTeam",
            required: true,
          },
          {
            id: "q2",
            content: "How large is your team?",
            responseType: "buttons",
            buttons: [
              { id: "btn-small", text: "1-5" },
              { id: "btn-medium", text: "6-20" },
              { id: "btn-large", text: "20+" },
            ],
            storeResponseAs: "teamSize",
            skipIf: "hasTeam == 'btn-no'", // Compare with button ID, not text
            required: true,
          },
          {
            id: "q3",
            content: "What is your budget?",
            responseType: "buttons",
            buttons: [
              { id: "btn-low", text: "Low" },
              { id: "btn-medium", text: "Medium" },
              { id: "btn-high", text: "High" },
            ],
            storeResponseAs: "budget",
            required: true,
          },
        ],
        storeAllAs: "conditionalResponses",
        completion: { content: "Survey complete!", delayBeforeTransition: 0 },
        allowBack: false,
        shuffle: false,
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Done!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "questionnaire",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "questionnaire",
      target: "end",
      edgeType: "default",
      label: "Complete",
    },
  ],
};

/**
 * Questionnaire with shuffle enabled
 */
export const questionnaireShuffleJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting randomized survey...",
      },
      metadata: createMetadata(),
    },
    {
      id: "questionnaire",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "questionnaire",
        schemaVersion: 1,
        label: "Randomized Survey",
        questions: [
          { id: "q1", content: "Question 1?", responseType: "text", required: true },
          { id: "q2", content: "Question 2?", responseType: "text", required: true },
          { id: "q3", content: "Question 3?", responseType: "text", required: true },
          { id: "q4", content: "Question 4?", responseType: "text", required: true },
          { id: "q5", content: "Question 5?", responseType: "text", required: true },
        ],
        completion: { content: "Done!", delayBeforeTransition: 0 },
        allowBack: false,
        shuffle: true,
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "End",
        content: "Survey completed!",
      },
      metadata: createMetadata(),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start",
      target: "questionnaire",
      edgeType: "default",
      label: "Auto transition",
    },
    {
      id: "e2",
      source: "questionnaire",
      target: "end",
      edgeType: "default",
      label: "Complete",
    },
  ],
};
