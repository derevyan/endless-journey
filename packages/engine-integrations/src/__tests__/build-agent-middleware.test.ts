import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypes, llmConfig, type AgentMiddlewareConfig } from "@journey/schemas";
import type { EventLogger } from "@journey/engine";
import { createSummarizationMiddleware } from "@journey/llm";
import { buildAgentMiddleware } from "../build-agent-middleware";

let hitlEventHandler: ((event: { type: string; requestId: string; toolName: string; decision?: string; message?: string }) => void) | null = null;

vi.mock("@journey/llm", () => ({
  createLLMGuardMiddleware: vi.fn(() => ({ name: "llm-guard" })),
  createModelFallbackMiddleware: vi.fn((...models: string[]) => ({ name: "model-fallback", models })),
  createPIIMiddleware: vi.fn((type: string, options: unknown) => ({ name: `pii:${type}`, options })),
  createSummarizationMiddleware: vi.fn((options: unknown) => ({ name: "summarization", options })),
  createModelCallLimitMiddleware: vi.fn((options: unknown) => ({ name: "model-call-limit", options })),
  createTodoListMiddleware: vi.fn((options: unknown) => ({ name: "todo-list", options })),
  createHumanInTheLoopMiddleware: vi.fn((options: { eventHandler: typeof hitlEventHandler }) => {
    hitlEventHandler = options.eventHandler;
    return { name: "human-in-the-loop", options };
  }),
}));

describe("buildAgentMiddleware", () => {
  beforeEach(() => {
    hitlEventHandler = null;
    vi.clearAllMocks();
  });

  it("returns empty array when config is undefined", () => {
    const middleware = buildAgentMiddleware(undefined);
    expect(middleware).toEqual([]);
  });

  it("builds middleware in deterministic order with correct options", () => {
    const config: AgentMiddlewareConfig = {
      llmGuard: { enabled: true },
      modelFallback: { enabled: true, fallbackModels: ["gpt-5-mini"] },
      piiDetection: {
        enabled: true,
        types: ["email", "phone"],
        strategy: "mask",
        scanInput: true,
        scanOutput: false,
      },
      modelCallLimit: { enabled: true, runLimit: 2, threadLimit: 5, exitBehavior: "error" },
      todoList: { enabled: true, maxTodos: 3, systemPrompt: "Track tasks" },
      humanInTheLoop: { enabled: true, requireApprovalFor: ["toolA"], timeout: 120, timeoutBehavior: "approve" },
    };

    const middleware = buildAgentMiddleware(config, {
      conversationHistory: {
        strategy: "summarize",
        summarization: { keep: { messages: 4 } },
      },
    });

    const names = middleware.map((mw) => mw.name);
    expect(names).toEqual([
      "llm-guard",
      "model-fallback",
      "pii:email",
      "pii:phone",
      "summarization",
      "model-call-limit",
      "todo-list",
      "human-in-the-loop",
    ]);

    expect(vi.mocked(createSummarizationMiddleware)).toHaveBeenCalledWith({
      model: llmConfig.summarization.model.id,
      trigger: {
        messages: llmConfig.summarization.triggerMessages,
        tokens: undefined,
      },
      keep: {
        messages: 4,
      },
    });
  });

  it("emits HITL event logger entries on decision events", () => {
    const eventLogger: EventLogger = { logEvent: vi.fn() };
    const config: AgentMiddlewareConfig = {
      humanInTheLoop: { enabled: true, requireApprovalFor: ["toolA"], timeout: 60, timeoutBehavior: "reject" },
    };

    buildAgentMiddleware(config, {
      nodeId: "node-1",
      sessionId: "session-1",
      eventLogger,
    });

    expect(hitlEventHandler).not.toBeNull();

    hitlEventHandler?.({
      type: "decision",
      requestId: "req-1",
      toolName: "toolA",
      decision: "approve",
      message: "Looks good",
    });

    expect(eventLogger.logEvent).toHaveBeenCalledWith({
      type: EventTypes.LLM_HITL,
      nodeId: "node-1",
      payload: {
        requestId: "req-1",
        toolName: "toolA",
        decision: "approve",
        message: "Looks good",
        wasEdited: false,
      },
    });
  });
});
