/**
 * Workflow Context Builder
 *
 * Centralized builder for creating workflow variable context.
 * Replaces ad-hoc variable merging in agent-handler.ts with a clean,
 * extensible builder pattern.
 *
 * Benefits:
 * - Single place to manage variable merging logic
 * - Easy to extend when new settings are added
 * - Testable in isolation
 * - Self-documenting code
 *
 * @module utils/workflow-context-builder
 */

import type { AgentNodeData } from "@journey/schemas";
import { createLogger, serializeError } from "@journey/logger";
import type { TemplateService } from "../types";

const log = createLogger("workflow-context-builder");

/**
 * Evaluation context structure from buildEvaluationContext()
 * Contains namespaced variables for template resolution
 */
export interface EvalContextWithVars {
  vars?: {
    journey?: Record<string, unknown>;
    global?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

/**
 * Builder for creating workflow variable context.
 *
 * Provides a fluent API for merging different variable sources:
 * - Session context (user responses, previous outputs)
 * - Journey variables (from variableAction nodes)
 * - Node settings (voice mode, profile, etc.)
 * - Initial context (node-defined template variables)
 *
 * @example
 * ```ts
 * const workflowVariables = new WorkflowContextBuilder(evalContext)
 *   .withSessionContext(session.context || {})
 *   .withJourneyVariables()
 *   .withNodeSettings(nodeData)
 *   .withInitialContext(nodeData.initialContext, templateService)
 *   .build();
 * ```
 */
export class WorkflowContextBuilder {
  private variables: Record<string, unknown> = {};

  constructor(private evalContext: EvalContextWithVars) {}

  /**
   * Add session context (user responses, previous outputs).
   * This is the foundation layer - typically session.context.
   */
  withSessionContext(sessionContext: Record<string, unknown>): this {
    this.variables = { ...this.variables, ...sessionContext };
    return this;
  }

  /**
   * Add journey-scoped variables from variableAction nodes.
   * This allows variables set in the journey to be used in workflow conditions.
   */
  withJourneyVariables(): this {
    const journeyVars = this.evalContext.vars?.journey;
    if (journeyVars) {
      this.variables = { ...this.variables, ...journeyVars };
    }
    return this;
  }

  /**
   * Add node-specific settings (voice mode, profile, provider, model).
   * These are needed because variableAction on the current node runs AFTER the handler.
   */
  withNodeSettings(nodeData: AgentNodeData): this {
    const settings = ["voiceMode", "voiceProfile", "voiceProvider", "elevenLabsModel"] as const;
    for (const key of settings) {
      const value = nodeData[key];
      if (value !== undefined && value !== null) {
        this.variables[key] = value;
      }
    }
    return this;
  }

  /**
   * Add resolved initial context from node configuration.
   * Templates in initialContext.variables are resolved using evalContext.
   */
  withInitialContext(
    initialContext: AgentNodeData["initialContext"],
    templateService: TemplateService
  ): this {
    if (!initialContext?.variables) return this;

    const resolvedInitialContext: Record<string, unknown> = {};
    for (const [key, template] of Object.entries(initialContext.variables)) {
      if (template.includes("{{")) {
        try {
          resolvedInitialContext[key] = templateService.substitute(template, this.evalContext);
        } catch (error) {
          log.error(
            { err: serializeError(error), key, template },
            "contextBuilder:templateSubstituteError"
          );
          // Use raw template as fallback to avoid breaking the entire build
          resolvedInitialContext[key] = template;
        }
      } else {
        resolvedInitialContext[key] = template;
      }
    }

    this.variables = { ...this.variables, ...resolvedInitialContext };
    return this;
  }

  /**
   * Add mindstate parameters to workflow variables.
   * This allows workflow conditions to access mindstate analysis results.
   */
  withMindstate(mindstate: Record<string, Record<string, unknown>> | undefined): this {
    if (mindstate) {
      this.variables.mindstate = mindstate;
    }
    return this;
  }

  /**
   * Add arbitrary key-value pairs to the context.
   * Useful for extending the builder without modifying the class.
   */
  with(key: string, value: unknown): this {
    if (value !== undefined && value !== null) {
      this.variables[key] = value;
    }
    return this;
  }

  /**
   * Add multiple key-value pairs at once.
   */
  withMany(values: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== null) {
        this.variables[key] = value;
      }
    }
    return this;
  }

  /**
   * Build and return the final workflow variables object.
   */
  build(): Record<string, unknown> {
    log.debug({ keys: this.getKeys() }, "contextBuilder:built");
    return { ...this.variables };
  }

  /**
   * Get current variable keys (for debugging/logging).
   */
  getKeys(): string[] {
    return Object.keys(this.variables);
  }
}
