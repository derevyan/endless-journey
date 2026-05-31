/**
 * Message Builder
 *
 * Builds message details from interactions.
 *
 * @module @journey/ai-report/builders/message-builder
 */

import type { MessageDetail, MessageButton, ErrorDetail } from "../schemas";
import type { InteractionRecord, NodeInfo } from "./journey-log-builder";

/**
 * Build message details from interaction records.
 */
export function buildMessages(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): MessageDetail[] {
  const messages: MessageDetail[] = [];

  // Track which buttons were clicked
  const clickedButtons = new Set<string>();
  for (const interaction of interactions) {
    if (interaction.eventType === "user.click") {
      const payload = interaction.payload as Record<string, unknown>;
      clickedButtons.add(payload.buttonId as string);
    }
  }

  // Filter for message events
  const messageEvents = interactions.filter(
    (i) => i.eventType === "user.message" || i.eventType === "engine.message" || i.eventType === "user.click"
  );

  for (const interaction of messageEvents) {
    const payload = interaction.payload as Record<string, unknown>;
    const nodeInfo = interaction.nodeId ? nodeMap.get(interaction.nodeId) : undefined;

    if (interaction.eventType === "engine.message") {
      // Bot message
      const rawButtons = (payload.buttons as Array<{ id: string; label: string }>) || [];
      const buttons: MessageButton[] = rawButtons.map((btn) => ({
        id: btn.id,
        label: btn.label,
        wasClicked: clickedButtons.has(btn.id),
      }));

      messages.push({
        timestamp: interaction.timestamp,
        direction: "outbound",
        content: (payload.content as string) || "",
        contentType: "text",
        nodeId: interaction.nodeId || "",
        nodeLabel: nodeInfo?.label,
        buttons: buttons.length > 0 ? buttons : undefined,
      });
    } else if (interaction.eventType === "user.message") {
      // User text message
      messages.push({
        timestamp: interaction.timestamp,
        direction: "inbound",
        content: (payload.text as string) || "",
        contentType: "text",
        nodeId: interaction.nodeId || "",
        nodeLabel: nodeInfo?.label,
        isTextInput: true,
      });
    } else if (interaction.eventType === "user.click") {
      // User button click
      messages.push({
        timestamp: interaction.timestamp,
        direction: "inbound",
        content: "",
        contentType: "text",
        nodeId: interaction.nodeId || "",
        nodeLabel: nodeInfo?.label,
        selectedButtonId: payload.buttonId as string,
        selectedButtonLabel: payload.buttonLabel as string,
        isTextInput: false,
      });
    }
  }

  return messages;
}

/**
 * Extract errors from interaction records.
 *
 * Detects multiple error types:
 * - engine.error: Node execution errors
 * - workflow.error: Workflow/agent execution errors
 * - llm.error or finishReason === "error": LLM errors
 * - webhook failures
 * - llm.guard.blocked: Guard evaluation rejections
 */
export function extractErrors(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): ErrorDetail[] {
  const errors: ErrorDetail[] = [];

  for (const interaction of interactions) {
    const payload = interaction.payload as Record<string, unknown>;
    const nodeInfo = interaction.nodeId ? nodeMap.get(interaction.nodeId) : undefined;

    switch (interaction.eventType) {
      case "engine.error": {
        errors.push({
          timestamp: interaction.timestamp,
          nodeId: interaction.nodeId || "",
          nodeType: nodeInfo?.type || "unknown",
          nodeLabel: nodeInfo?.label,
          errorType: "node_execution",
          message: (payload.message as string) || "Unknown engine error",
          stack: payload.stack as string | undefined,
          wasRecovered: (payload.recovered as boolean) || false,
          recoveryAction: payload.recoveryAction as string | undefined,
        });
        break;
      }

      case "workflow.error": {
        errors.push({
          timestamp: interaction.timestamp,
          nodeId: interaction.nodeId || "",
          nodeType: nodeInfo?.type || "agent",
          nodeLabel: nodeInfo?.label,
          errorType: "workflow_error",
          message: (payload.message as string) || "Workflow execution error",
          stack: payload.stack as string | undefined,
          wasRecovered: false,
          inputData: payload.input,
        });
        break;
      }

      case "llm.error": {
        errors.push({
          timestamp: interaction.timestamp,
          nodeId: interaction.nodeId || "",
          nodeType: nodeInfo?.type || "agent",
          nodeLabel: nodeInfo?.label,
          errorType: "llm_error",
          message: (payload.message as string) || (payload.error as string) || "LLM error",
          wasRecovered: false,
          inputData: payload.input,
        });
        break;
      }

      case "llm.call": {
        // Check if LLM call ended in error
        const finishReason = payload.finishReason as string | undefined;
        if (finishReason === "error" || payload.error) {
          errors.push({
            timestamp: interaction.timestamp,
            nodeId: interaction.nodeId || "",
            nodeType: nodeInfo?.type || "agent",
            nodeLabel: nodeInfo?.label,
            errorType: "llm_error",
            message: (payload.errorMessage as string) || (payload.error as string) || "LLM call failed",
            wasRecovered: false,
          });
        }
        break;
      }

      case "webhook.response":
      case "webhook.executed": {
        // Check for webhook failures
        const status = payload.statusCode as number | undefined;
        const success = payload.success as boolean | undefined;
        if (success === false || (status && status >= 400)) {
          errors.push({
            timestamp: interaction.timestamp,
            nodeId: interaction.nodeId || "",
            nodeType: nodeInfo?.type || "webhook",
            nodeLabel: nodeInfo?.label,
            errorType: "webhook_failure",
            message: `Webhook failed with status ${status || "unknown"}: ${(payload.error as string) || (payload.message as string) || "No error message"}`,
            wasRecovered: false,
            inputData: payload.request,
            outputData: payload.response,
          });
        }
        break;
      }

      case "llm.guard.blocked": {
        errors.push({
          timestamp: interaction.timestamp,
          nodeId: interaction.nodeId || "",
          nodeType: nodeInfo?.type || "guard",
          nodeLabel: nodeInfo?.label,
          errorType: "guard_rejection",
          message: (payload.reason as string) || (payload.message as string) || "Guard blocked transition",
          wasRecovered: false,
          inputData: payload.context,
        });
        break;
      }

      case "tool.error": {
        errors.push({
          timestamp: interaction.timestamp,
          nodeId: interaction.nodeId || "",
          nodeType: nodeInfo?.type || "agent",
          nodeLabel: nodeInfo?.label,
          errorType: "tool_error",
          message: (payload.message as string) || (payload.error as string) || "Tool execution error",
          wasRecovered: false,
          inputData: payload.input,
        });
        break;
      }
    }
  }

  return errors;
}
