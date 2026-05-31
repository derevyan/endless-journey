/**
 * If/Else Node Executor - Conditional branching
 *
 * Supports two condition types:
 * 1. Expression: SAFE structured evaluation (no eval!) for field/operator/value conditions
 * 2. Intent: LLM-based classification using Groq gpt-oss-120b (fast & cheap)
 *
 * Output handles:
 * - 'yes': Condition is true / intent matched with sufficient confidence
 * - 'no': Condition is false / no intent match or low confidence
 */

import type { IfElseNodeConfig } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { evaluateCondition } from "../../expression-evaluator";
import { classifyIntent } from "../../intent-classifier";
import { BaseNodeExecutor } from "../base-executor";

/**
 * If/Else node executor.
 *
 * Evaluates a condition and routes to 'yes' or 'no' edge.
 *
 * Supports two condition types:
 * - expression: Structured condition (SAFE - no eval)
 * - intent: LLM-based intent detection
 */
export class IfElseNodeExecutor extends BaseNodeExecutor<IfElseNodeConfig> {
  readonly nodeType = "if_else";

  protected async executeNode(
    input: NodeInput,
    config: IfElseNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    let conditionResult: boolean;
    let metadata: Record<string, unknown> = {};

    if (config.conditionType === "expression") {
      // SAFE expression evaluation (no eval!)
      conditionResult = evaluateCondition(config.condition, input.variables);

      metadata = {
        type: "expression",
        left: config.condition.left,
        operator: config.condition.operator,
        result: conditionResult,
      };

      context.log.info({ condition: config.condition, result: conditionResult }, "workflow:if-else:expression");
    } else {
      // Intent-based classification using LLM
      // Get message from input - check common locations (prefer input.message, fallback to variables)
      const inputMessage = input.message?.trim();
      const variablesMessage = (input.variables?.message as string | undefined)?.trim();
      const message = inputMessage || variablesMessage || "";

      if (!message) {
        context.log.warn({ intents: config.intent.intents }, "workflow:if-else:intent:noMessage");
        conditionResult = false;
        metadata = {
          type: "intent",
          intents: config.intent.intents,
          minConfidence: config.intent.minConfidence,
          error: "No message found in input for intent classification",
          result: false,
        };
      } else {
        // Classify the intent using LLM
        const classification = await classifyIntent(
          String(message),
          config.intent.intents,
          config.intent.minConfidence
        );

        conditionResult = classification.matched;
        metadata = {
          type: "intent",
          intents: config.intent.intents,
          matchedIntent: classification.intent,
          confidence: classification.confidence,
          minConfidence: config.intent.minConfidence,
          reasoning: classification.reasoning,
          result: conditionResult,
        };

        context.log.info(
          {
            intents: config.intent.intents,
            matchedIntent: classification.intent,
            confidence: classification.confidence,
            result: conditionResult,
          },
          "workflow:if-else:intent"
        );
      }
    }

    return {
      outHandle: conditionResult ? "yes" : "no",
      executionTimeMs: 0,
      metadata,
    };
  }
}
