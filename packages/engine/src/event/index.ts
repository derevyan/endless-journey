/**
 * Event Module
 *
 * Exports event routing and queue components for the engine.
 *
 * The EventRouter has been modularized into focused sub-modules:
 * - event-validation.ts: Session/stale validation
 * - user-response.ts: Response storage and logging
 * - handler-delegation.ts: Handler event delegation
 * - guard-context-builder.ts: Guard context construction
 * - target-resolver.ts: Target node resolution
 */

// Main exports
export { EventRouter, type EventRouterConfig, type EventRouterCallbacks, type EventRouterClientData, type PluginTimeoutCallbackResult } from "./event-router";
export { EventQueue, type EventQueueConfig, type EventQueueFactory, type EventQueueLike, type OverflowPolicy, type DlqContext } from "./event-queue";

// Extracted module exports (for direct usage if needed)
export { validateEvent, isStaleTimeout, handlePluginFollowUpTimeout, type EventValidationResult, type ValidationFailureReason, type PluginTimeoutCallbacks } from "./event-validation";
export { buildBasicGuardContext, buildFullGuardContext, type GuardContextBuilderConfig, type GuardContextBuilderCallbacks, type GuardContextClientData } from "./guard-context-builder";
export { delegateToHandler, type HandlerDelegationConfig, type HandlerDelegationCallbacks } from "./handler-delegation";
export { findTargetNode, type TargetResolverConfig, type TargetResolverCallbacks } from "./target-resolver";
export { storeUserResponse, logUserAction, isResponseAccepted, type UserResponseConfig } from "./user-response";
