/**
 * Event Consumers
 *
 * Handle events for different purposes:
 * - SSE: Real-time streaming to frontend via Redis pub/sub
 * - Log: Database persistence for event history
 * - Automation: Trigger automation rules via BullMQ
 *
 * @module events/consumers
 */

export * from "./sse-consumer";
export * from "./log-consumer";
export * from "./automation-consumer";
