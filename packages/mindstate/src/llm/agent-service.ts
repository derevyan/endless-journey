import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { generateStructuredOutput, generateChatResponse, buildModelSamplingConfig, type TokenUsage } from "@journey/llm";
import type { SystemAgent, MainAgent, StateParameter } from "@journey/schemas";
import type { Message, ParameterUpdate } from "../types";
import { coerceValue } from "../utils/type-coercion";
import {
  buildParameterDefinitions,
  buildAgentBatchSystemPrompt,
  buildAgentBatchUserContent,
  buildStateDescription,
  buildMainAgentSystemPrompt,
} from "./prompts";

const log = createLogger("mindstate:agent-service");

/**
 * Agent batch response schema
 */
const AgentBatchResponseSchema = z.object({
  analysis: z.array(z.string()).describe("List of distinct observations or thoughts"),
  updates: z.array(
    z.object({
      id: z.string().describe("The ID of the parameter"),
      newValue: z
        .union([z.string(), z.number(), z.boolean()])
        .describe("The new value as string/number/boolean - will be parsed based on type"),
      reasoning: z.string().describe("Brief reason for the value"),
    })
  ),
});

type AgentBatchResponse = z.infer<typeof AgentBatchResponseSchema>;

/**
 * Response from agent batch processing including token usage
 */
export interface AgentBatchServiceResult {
  analysis: string[];
  updates: ParameterUpdate[];
  tokenUsage?: TokenUsage;
}

/**
 * Response from main agent including token usage
 */
export interface MainAgentServiceResult {
  response: string;
  tokenUsage?: TokenUsage;
  error?: Error;
}

/**
 * Check if model is mock mode
 */
function isMockMode(model?: string): boolean {
  return model === "mock" || process.env.FORCE_MOCK_LLM === "true";
}

/**
 * Mock response generator for batch processing
 */
function mockAgentStateBatch(
  agent: SystemAgent,
  params: StateParameter[],
  userMessage: string
): AgentBatchServiceResult {
  const analysis = [
    `${agent.name} noticed: "${userMessage.slice(0, 80) || "No message"}"`,
    `Monitoring ${params.length} signals for anomalies.`,
  ];

  const updates: ParameterUpdate[] = params.map((p, idx) => {
    if (p.scaleType === "NUMERIC") {
      const delta = idx % 2 === 0 ? 1 : -1;
      const min = p.min ?? 0;
      const max = p.max ?? 10;
      const next = Math.max(min, Math.min(max, Number(p.currentValue) + delta));
      return {
        id: p.id,
        newValue: isNaN(next) ? p.currentValue : next,
        reasoning: "Simulated numeric adjustment",
        agentId: agent.id,
      };
    }

    if (p.scaleType === "CATEGORICAL") {
      const fallback = p.options?.[0] ?? p.currentValue;
      return { id: p.id, newValue: fallback, reasoning: "Simulated categorical selection", agentId: agent.id };
    }

    if (p.scaleType === "BOOLEAN") {
      return { id: p.id, newValue: !(p.currentValue as boolean), reasoning: "Simulated boolean toggle", agentId: agent.id };
    }

    return { id: p.id, newValue: p.currentValue, reasoning: "No change", agentId: agent.id };
  });

  return {
    analysis,
    updates,
    tokenUsage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
  };
}

/**
 * The "ECS System Agent" Batch Function.
 * Runs ONE LLM call for a specific Agent to update ALL parameters they are responsible for.
 */
export async function updateAgentStateBatch(
  agent: SystemAgent,
  params: StateParameter[],
  userMessage: string,
  context: string
): Promise<AgentBatchServiceResult> {
  const model = agent.llmConfig?.model;

  // Use mock for testing/development
  if (!model || isMockMode(model)) {
    return mockAgentStateBatch(agent, params, userMessage);
  }

  log.info(
    {
      agent: agent.name,
      model,
      paramCount: params.length,
    },
    "mindstate:agentBatch:start"
  );

  try {
    // Build prompts (systemPrompt may be undefined if promptRef resolution failed)
    const paramDefinitions = buildParameterDefinitions(params);
    const agentPrompt = agent.systemPrompt ?? "";
    const systemPrompt = buildAgentBatchSystemPrompt(agent.name, agent.role, agentPrompt, paramDefinitions);
    const userContent = buildAgentBatchUserContent(userMessage, context);

    // Build sampling config based on model capabilities (reasoning vs temperature)
    const samplingConfig = buildModelSamplingConfig({
      model,
      temperature: agent.llmConfig?.temperature,
      reasoningEffort: agent.llmConfig?.reasoningEffort,
      defaultTemperature: 0.3,
      defaultReasoningEffort: "high",
    });

    // Call LLM with structured output
    const response = await generateStructuredOutput<AgentBatchResponse>(
      systemPrompt,
      userContent,
      AgentBatchResponseSchema,
      {
        model,
        ...samplingConfig,
        maxTokens: agent.llmConfig?.maxTokens,
        timeout: agent.llmConfig?.timeout,
        maxRetries: agent.llmConfig?.maxRetries,
      }
    );

    // Post-process: Type coercion
    const processedUpdates: ParameterUpdate[] = response.result.updates.map((res) => {
      const param = params.find((p) => p.id === res.id);
      if (!param) return { ...res, newValue: res.newValue, agentId: agent.id };

      const coercedValue = coerceValue(res.newValue, param);

      if (coercedValue !== param.currentValue) {
        log.debug(
          {
            param: param.name,
            old: param.currentValue,
            new: coercedValue,
          },
          "mindstate:agentBatch:update"
        );
      }

      return { id: res.id, newValue: coercedValue, reasoning: res.reasoning, agentId: agent.id };
    });

    // Ensure analysis is always an array
    let finalAnalysis = response.result.analysis;
    if (typeof finalAnalysis === "string") {
      finalAnalysis = [finalAnalysis];
    }

    log.info(
      {
        agent: agent.name,
        analysisCount: finalAnalysis.length,
        updatesCount: processedUpdates.length,
        tokens: response.tokenUsage?.totalTokens,
      },
      "mindstate:agentBatch:complete"
    );

    return {
      analysis: finalAnalysis,
      updates: processedUpdates,
      tokenUsage: response.tokenUsage,
    };
  } catch (error) {
    log.error(
      {
        agent: agent.name,
        err: serializeError(error),
      },
      "mindstate:agentBatch:error"
    );

    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * The "Main Agent" function.
 * Generates the reply taking the full Theory of Mind snapshot into account.
 */
export async function generateMainAgentResponse(
  messages: Message[],
  stateSnapshot: StateParameter[],
  mainAgent: MainAgent
): Promise<MainAgentServiceResult> {
  const model = mainAgent.llmConfig?.model;

  // Mock mode
  if (!model || isMockMode(model)) {
    const lastUser = messages.filter((m) => m.role === "user").pop();
    const summary = stateSnapshot
      .slice(0, 3)
      .map((p) => `${p.name}: ${p.currentValue}`)
      .join(" | ");
    return {
      response: `Simulated response to "${lastUser?.content ?? "your message"}" while tracking ${summary}.`,
      tokenUsage: {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
      },
    };
  }

  log.info(
    {
      model,
      messageCount: messages.length,
    },
    "mindstate:mainAgent:start"
  );

  // Build state description (systemPrompt may be undefined if promptRef resolution failed)
  const stateDescription = buildStateDescription(stateSnapshot);
  const mainPrompt = mainAgent.systemPrompt ?? "";
  const systemPrompt = buildMainAgentSystemPrompt(mainAgent.name, mainAgent.role, mainPrompt, stateDescription);

  // Convert messages to chat format
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  // Build sampling config based on model capabilities (reasoning vs temperature)
  const samplingConfig = buildModelSamplingConfig({
    model,
    temperature: mainAgent.llmConfig?.temperature,
    reasoningEffort: mainAgent.llmConfig?.reasoningEffort,
    defaultTemperature: 0.7,
    defaultReasoningEffort: "high",
  });

  try {
    const response = await generateChatResponse(systemPrompt, chatMessages, {
      model,
      ...samplingConfig,
      maxTokens: mainAgent.llmConfig?.maxTokens,
      timeout: mainAgent.llmConfig?.timeout,
      maxRetries: mainAgent.llmConfig?.maxRetries,
    });

    log.info(
      {
        tokens: response.tokenUsage?.totalTokens,
      },
      "mindstate:mainAgent:complete"
    );

    return {
      response: response.result || "...",
      tokenUsage: response.tokenUsage,
    };
  } catch (error) {
    log.error(
      {
        err: serializeError(error),
      },
      "mindstate:mainAgent:error"
    );
    return {
      response: "I'm having trouble connecting to my thought engine right now.",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
