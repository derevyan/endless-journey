import type { JourneyNodeData, MessageNodeData, QuestionnaireNodeData } from "@journey/schemas";

/**
 * Check if a node requires user input or has async behavior that needs waiting.
 */
export function isInteractiveNode(node: JourneyNodeData): boolean {
  switch (node.data.type) {
    case "message": {
      const msgData = node.data as MessageNodeData;
      const responseType = msgData.responseType || (msgData.buttons?.length ? "buttons" : "auto");
      const hasDelay = typeof msgData.delay === "number" && msgData.delay > 0;
      return responseType !== "auto" || hasDelay;
    }
    case "questionnaire":
      return true;
    case "wait":
      return true; // Wait nodes need timeout input to trigger timer
    default:
      return false;
  }
}

/**
 * Check if a node has a timer that can affect timing variations.
 */
export function hasTimer(node: JourneyNodeData): boolean {
  // Wait nodes always have a timer (their duration becomes a scheduled timer)
  if (node.data.type === "wait") {
    return true;
  }

  if (node.data.type === "message") {
    const msgData = node.data as MessageNodeData;
    return !!(msgData.timer && msgData.timer.seconds > 0);
  }

  if (node.data.type === "questionnaire") {
    const qData = node.data as QuestionnaireNodeData;
    return !!(qData.timeout?.seconds && qData.timeout.seconds > 0);
  }

  return false;
}
