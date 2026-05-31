/**
 * Centralized Error Types
 *
 * Unified error hierarchy for the Journey Builder platform.
 * All packages should use these error types for consistency.
 *
 * Error classes include HTTP status codes for API error handling.
 *
 * @module errors
 */

// =============================================================================
// BASE ERROR
// =============================================================================

/**
 * Base error class for all Journey errors.
 * Provides a consistent error structure with error codes and HTTP status codes.
 */
export class JourneyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "JourneyError";
  }
}

// =============================================================================
// VALIDATION ERRORS
// =============================================================================

/**
 * Validation error for schema/input validation failures.
 * HTTP 400 Bad Request
 */
export class ValidationError extends JourneyError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>,
    cause?: unknown
  ) {
    super(message, "VALIDATION_ERROR", 400, cause);
    this.name = "ValidationError";
  }
}

// =============================================================================
// API ERRORS
// =============================================================================

/**
 * Bad request error for invalid API requests.
 * HTTP 400 Bad Request
 */
export class BadRequestError extends JourneyError {
  constructor(
    message: string,
    public readonly details?: unknown,
    cause?: unknown
  ) {
    super(message, "BAD_REQUEST", 400, cause);
    this.name = "BadRequestError";
  }
}

/**
 * Unauthorized error for API access.
 * HTTP 401 Unauthorized
 */
export class UnauthorizedError extends JourneyError {
  constructor(message = "Unauthorized", cause?: unknown) {
    super(message, "UNAUTHORIZED", 401, cause);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden error for API access.
 * HTTP 403 Forbidden
 */
export class ForbiddenError extends JourneyError {
  constructor(message = "Access denied", cause?: unknown) {
    super(message, "FORBIDDEN", 403, cause);
    this.name = "ForbiddenError";
  }
}

/**
 * Not found error for API resources.
 * HTTP 404 Not Found
 */
export class NotFoundError extends JourneyError {
  constructor(
    public readonly resource: string,
    public readonly resourceId: string,
    cause?: unknown
  ) {
    super(`${resource} not found: ${resourceId}`, "NOT_FOUND", 404, cause);
    this.name = "NotFoundError";
  }
}

/**
 * Conflict error for duplicate resources or unique constraint violations.
 * HTTP 409 Conflict
 */
export class ConflictError extends JourneyError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONFLICT", 409, cause);
    this.name = "ConflictError";
  }
}

/**
 * Rate limit error for API requests.
 * HTTP 429 Too Many Requests
 */
export class RateLimitError extends JourneyError {
  constructor(
    message = "Too many requests",
    public readonly retryAfterMs?: number,
    cause?: unknown
  ) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, cause);
    this.name = "RateLimitError";
  }
}

/**
 * Service unavailable error for temporary failures.
 * HTTP 503 Service Unavailable
 */
export class ServiceUnavailableError extends JourneyError {
  constructor(message: string, cause?: unknown) {
    super(message, "SERVICE_UNAVAILABLE", 503, cause);
    this.name = "ServiceUnavailableError";
  }
}

// =============================================================================
// LLM ERRORS
// =============================================================================

/**
 * Base error for LLM-related failures.
 * HTTP 500 by default.
 *
 * Note: Constructor signature preserved for backward compatibility.
 * Subclasses set their own statusCode via the protected setter.
 */
export class LLMError extends JourneyError {
  constructor(
    message: string,
    public readonly model: string,
    code = "LLM_ERROR",
    cause?: unknown
  ) {
    super(message, code, 500, cause);
    this.name = "LLMError";
  }
}

/**
 * Rate limit error from LLM provider.
 * HTTP 429 Too Many Requests
 */
export class LLMRateLimitError extends LLMError {
  override readonly statusCode = 429;

  constructor(
    model: string,
    public readonly retryAfterMs?: number,
    cause?: unknown
  ) {
    super("Rate limit exceeded", model, "LLM_RATE_LIMIT", cause);
    this.name = "LLMRateLimitError";
  }
}

/**
 * Authentication error from LLM provider.
 * HTTP 401 Unauthorized
 */
export class LLMAuthError extends LLMError {
  override readonly statusCode = 401;

  constructor(model: string, cause?: unknown) {
    super("Authentication failed", model, "LLM_AUTH_ERROR", cause);
    this.name = "LLMAuthError";
  }
}

/**
 * Timeout error from LLM provider.
 * HTTP 504 Gateway Timeout
 */
export class LLMTimeoutError extends LLMError {
  override readonly statusCode = 504;

  constructor(
    model: string,
    public readonly timeoutMs?: number,
    cause?: unknown
  ) {
    super("Request timed out", model, "LLM_TIMEOUT", cause);
    this.name = "LLMTimeoutError";
  }
}

// =============================================================================
// ENGINE ERRORS
// =============================================================================

/**
 * Base error for journey engine failures.
 * HTTP 500 by default.
 *
 * Note: Constructor signature preserved for backward compatibility.
 * Subclasses override statusCode via the property override.
 */
export class EngineError extends JourneyError {
  constructor(
    message: string,
    public readonly journeyId?: string,
    public readonly nodeId?: string,
    code = "ENGINE_ERROR",
    cause?: unknown
  ) {
    super(message, code, 500, cause);
    this.name = "EngineError";
  }
}

/**
 * Node not found error.
 * HTTP 404 Not Found
 */
export class NodeNotFoundError extends EngineError {
  override readonly statusCode = 404;

  constructor(nodeId: string, journeyId?: string, cause?: unknown) {
    super(`Node ${nodeId} not found`, journeyId, nodeId, "NODE_NOT_FOUND", cause);
    this.name = "NodeNotFoundError";
  }
}

/**
 * No start node found in journey.
 * HTTP 400 Bad Request (configuration error)
 */
export class NoStartNodeError extends EngineError {
  override readonly statusCode = 400;

  constructor(journeyId?: string, cause?: unknown) {
    super("No start node found in journey", journeyId, undefined, "NO_START_NODE", cause);
    this.name = "NoStartNodeError";
  }
}

/**
 * Session not found error.
 * HTTP 404 Not Found
 */
export class SessionNotFoundError extends EngineError {
  override readonly statusCode = 404;

  constructor(sessionId: string, cause?: unknown) {
    super(`Session ${sessionId} not found`, undefined, undefined, "SESSION_NOT_FOUND", cause);
    this.name = "SessionNotFoundError";
  }
}

/**
 * Agent workflow execution error.
 * HTTP 500 by default.
 *
 * Provides domain context for debugging agent workflow failures.
 */
export class AgentWorkflowError extends EngineError {
  constructor(
    message: string,
    journeyId: string | undefined,
    nodeId: string | undefined,
    public readonly workflowKey?: string,
    public readonly isRetryable: boolean = false,
    cause?: unknown
  ) {
    super(message, journeyId, nodeId, "AGENT_WORKFLOW_ERROR", cause);
    this.name = "AgentWorkflowError";
  }
}

// =============================================================================
// PIPELINE ERRORS (MindState)
// =============================================================================

/**
 * Pipeline execution error.
 * Used by MindState orchestrator.
 */
export interface PipelineError {
  step: string;
  error: Error;
  partial?: Record<string, unknown>;
}

/**
 * Type guard for PipelineError.
 */
export function isPipelineError(error: unknown): error is PipelineError {
  return typeof error === "object" && error !== null && "step" in error && "error" in error;
}

// =============================================================================
// FEATURE ERRORS
// =============================================================================

/**
 * Not implemented error for features that are not yet available.
 * HTTP 501 Not Implemented
 */
export class NotImplementedError extends JourneyError {
  constructor(
    public readonly feature: string,
    message?: string,
    cause?: unknown
  ) {
    super(message ?? `Feature not implemented: ${feature}`, "NOT_IMPLEMENTED", 501, cause);
    this.name = "NotImplementedError";
  }
}

// =============================================================================
// CIRCUIT BREAKER ERRORS
// =============================================================================

/**
 * Circuit breaker open error.
 * Thrown when a service's circuit breaker is open and requests are being rejected.
 * HTTP 503 Service Unavailable
 */
export class CircuitOpenError extends JourneyError {
  constructor(
    public readonly serviceName: string,
    public readonly serviceType: string,
    cause?: unknown
  ) {
    super(`Circuit breaker is open for ${serviceName}`, "CIRCUIT_OPEN", 503, cause);
    this.name = "CircuitOpenError";
  }
}

// =============================================================================
// AI GENERATION ERRORS
// =============================================================================

/**
 * AI generation error for follow-up plugin and other AI-powered features.
 * HTTP 500 Internal Server Error
 *
 * Used when AI model invocation fails and fallback content is used.
 */
export class AiGenerationError extends JourneyError {
  constructor(
    public readonly model: string,
    cause?: unknown
  ) {
    super(`AI generation failed for model: ${model}`, "AI_GENERATION_ERROR", 500, cause);
    this.name = "AiGenerationError";
  }
}
