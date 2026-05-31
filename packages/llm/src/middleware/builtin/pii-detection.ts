/**
 * PII Detection Middleware
 *
 * Detects and handles Personally Identifiable Information (PII) in messages.
 * Follows LangChain's PIIMiddleware / piiRedactionMiddleware API.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#pii-detection
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     // Redact emails in user input
 *     createPIIMiddleware("email", { strategy: "redact" }),
 *
 *     // Mask SSNs with custom pattern
 *     createPIIMiddleware("ssn", {
 *       strategy: "mask",
 *       maskChar: "X",
 *       maskKeepLast: 4,
 *     }),
 *
 *     // Custom detector
 *     createPIIMiddleware("custom_id", {
 *       detector: /CUST-\d{6}/g,
 *       strategy: "warn",
 *     }),
 *   ],
 * });
 * ```
 */

import { createMiddleware } from "../create-middleware";
import { createLogger } from "@journey/logger";
import type { ConversationMessage } from "../types";

const log = createLogger("llm:middleware:pii-detection");

// ============================================================================
// Types
// ============================================================================

/**
 * Built-in PII types with predefined detection patterns
 */
export type PIIType =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "ip"
  | "date_of_birth"
  | string; // Allow custom types

/**
 * Strategy for handling detected PII
 */
export type PIIStrategy =
  | "redact"  // Replace with [REDACTED]
  | "mask"    // Partially mask (e.g., XXX-XX-1234)
  | "block"   // Throw error, prevent processing
  | "warn";   // Log warning but allow through

/**
 * Configuration for PII Detection middleware
 */
export interface PIIMiddlewareConfig {
  /**
   * Strategy for handling detected PII
   * @default "redact"
   */
  strategy?: PIIStrategy;

  /**
   * Custom regex detector (overrides built-in pattern)
   */
  detector?: RegExp;

  /**
   * Apply detection to user input messages
   * @default true
   */
  applyToInput?: boolean;

  /**
   * Apply detection to model output responses
   * @default false
   */
  applyToOutput?: boolean;

  /**
   * Character to use for masking
   * @default "*"
   */
  maskChar?: string;

  /**
   * Number of characters to keep visible at the end when masking
   * @default 4
   */
  maskKeepLast?: number;

  /**
   * Custom redaction text
   * @default "[REDACTED]"
   */
  redactionText?: string;

  /**
   * Custom error message when blocking
   */
  blockMessage?: string;
}

// ============================================================================
// Built-in Patterns
// ============================================================================

/**
 * Predefined regex patterns for common PII types
 * Patterns designed to catch most common formats while minimizing false positives
 */
const BUILTIN_PATTERNS: Record<string, RegExp> = {
  // Email: standard email format
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone: various formats (US-centric but catches international too)
  // Matches: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,

  // SSN: XXX-XX-XXXX format
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

  // Credit Card: 13-19 digit numbers with optional separators
  // Matches: 4111111111111111, 4111-1111-1111-1111, 4111 1111 1111 1111
  credit_card: /\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b/g,

  // IPv4 Address
  ip: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // Date of Birth: common formats
  // Matches: 01/15/1990, 1990-01-15, Jan 15 1990
  date_of_birth:
    /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi,
};

// ============================================================================
// Detection & Processing
// ============================================================================

/**
 * Detect PII in text using the specified pattern
 */
function detectPII(text: string, pattern: RegExp): string[] {
  // Reset regex lastIndex for global patterns
  pattern.lastIndex = 0;
  const matches = text.match(pattern);
  return matches || [];
}

/**
 * Redact PII by replacing with redaction text
 */
function redactPII(text: string, pattern: RegExp, redactionText: string): string {
  pattern.lastIndex = 0;
  return text.replace(pattern, redactionText);
}

/**
 * Mask PII by partially hiding the value
 */
function maskPII(
  text: string,
  pattern: RegExp,
  maskChar: string,
  keepLast: number
): string {
  pattern.lastIndex = 0;
  return text.replace(pattern, (match) => {
    if (match.length <= keepLast) {
      return maskChar.repeat(match.length);
    }
    const visible = match.slice(-keepLast);
    const masked = maskChar.repeat(match.length - keepLast);
    return masked + visible;
  });
}

/**
 * Process text with the specified PII strategy
 */
function processPII(
  text: string,
  pattern: RegExp,
  strategy: PIIStrategy,
  config: PIIMiddlewareConfig,
  piiType: string
): { text: string; found: string[]; blocked: boolean } {
  const found = detectPII(text, pattern);

  if (found.length === 0) {
    return { text, found: [], blocked: false };
  }

  log.debug(
    { piiType, count: found.length, strategy },
    "middleware:pii:detected"
  );

  switch (strategy) {
    case "redact":
      return {
        text: redactPII(text, pattern, config.redactionText || "[REDACTED]"),
        found,
        blocked: false,
      };

    case "mask":
      return {
        text: maskPII(text, pattern, config.maskChar || "*", config.maskKeepLast || 4),
        found,
        blocked: false,
      };

    case "block":
      return { text, found, blocked: true };

    case "warn":
      log.warn(
        { piiType, count: found.length },
        "middleware:pii:warning"
      );
      return { text, found, blocked: false };

    default:
      return { text, found, blocked: false };
  }
}

/**
 * Process messages for PII
 */
function processMessages(
  messages: ConversationMessage[],
  pattern: RegExp,
  strategy: PIIStrategy,
  config: PIIMiddlewareConfig,
  piiType: string,
  roleFilter?: "user" | "assistant"
): { messages: ConversationMessage[]; totalFound: number; blocked: boolean } {
  let totalFound = 0;
  let blocked = false;

  const processedMessages = messages.map((msg) => {
    // Skip if role doesn't match filter
    if (roleFilter && msg.role !== roleFilter) {
      return msg;
    }

    // Skip non-text content
    if (typeof msg.content !== "string") {
      return msg;
    }

    const result = processPII(msg.content, pattern, strategy, config, piiType);
    totalFound += result.found.length;

    if (result.blocked) {
      blocked = true;
    }

    if (result.text !== msg.content) {
      return { ...msg, content: result.text };
    }

    return msg;
  });

  return { messages: processedMessages, totalFound, blocked };
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a PII Detection middleware
 *
 * Scans messages for PII and applies the specified strategy (redact, mask, block, warn).
 *
 * @param piiType - Type of PII to detect ("email", "phone", "ssn", etc.) or custom name
 * @param config - Configuration options
 *
 * @example Redact emails in user input
 * ```typescript
 * createPIIMiddleware("email", { strategy: "redact" })
 * ```
 *
 * @example Mask SSNs showing last 4 digits
 * ```typescript
 * createPIIMiddleware("ssn", {
 *   strategy: "mask",
 *   maskKeepLast: 4,
 * })
 * ```
 *
 * @example Block credit cards
 * ```typescript
 * createPIIMiddleware("credit_card", {
 *   strategy: "block",
 *   blockMessage: "Credit card numbers are not allowed",
 * })
 * ```
 *
 * @example Custom pattern
 * ```typescript
 * createPIIMiddleware("employee_id", {
 *   detector: /EMP-\d{8}/g,
 *   strategy: "redact",
 * })
 * ```
 *
 * @example Scan model output
 * ```typescript
 * createPIIMiddleware("phone", {
 *   strategy: "redact",
 *   applyToInput: false,
 *   applyToOutput: true,
 * })
 * ```
 */
export function createPIIMiddleware(
  piiType: PIIType,
  config: PIIMiddlewareConfig = {}
): ReturnType<typeof createMiddleware> {
  const {
    strategy = "redact",
    detector,
    applyToInput = true,
    applyToOutput = false,
    redactionText = "[REDACTED]",
    blockMessage,
  } = config;

  // Get detection pattern
  const pattern = detector || BUILTIN_PATTERNS[piiType];

  if (!pattern) {
    throw new Error(
      `PIIMiddleware: Unknown PII type "${piiType}" and no custom detector provided. ` +
        `Built-in types: ${Object.keys(BUILTIN_PATTERNS).join(", ")}`
    );
  }

  // Create a fresh pattern for each invocation to avoid lastIndex issues
  const getPattern = () => new RegExp(pattern.source, pattern.flags);

  return createMiddleware({
    name: `PIIMiddleware:${piiType}`,
    priority: 10, // Run early to filter input

    // Scan input messages before model call
    beforeModel: applyToInput
      ? (state) => {
          const result = processMessages(
            state.messages,
            getPattern(),
            strategy,
            config,
            piiType,
            "user" // Only scan user messages on input
          );

          if (result.blocked) {
            const message =
              blockMessage ||
              `Message blocked: ${piiType.toUpperCase()} detected`;

            log.warn({ piiType }, "middleware:pii:blocked");
            throw new Error(message);
          }

          if (result.totalFound > 0) {
            log.info(
              { piiType, count: result.totalFound, strategy },
              "middleware:pii:processed:input"
            );
            return { messages: result.messages };
          }

          return undefined;
        }
      : undefined,

    // Wrap model call to scan and modify output responses
    // Using wrapModelCall instead of afterModel so we can actually modify the response
    wrapModelCall: applyToOutput
      ? async (request, handler) => {
          // Call the actual model
          const response = await handler(request);

          // Process the response content for PII
          if (typeof response.content === "string") {
            const contentResult = processPII(
              response.content,
              getPattern(),
              strategy,
              config,
              piiType
            );

            if (contentResult.blocked) {
              const message =
                blockMessage ||
                `Response blocked: ${piiType.toUpperCase()} detected`;

              log.warn({ piiType }, "middleware:pii:blocked:output");
              throw new Error(message);
            }

            if (contentResult.found.length > 0) {
              log.info(
                { piiType, count: contentResult.found.length, strategy },
                "middleware:pii:processed:output"
              );

              // Return modified response with PII processed
              return {
                ...response,
                content: contentResult.text,
              };
            }
          }

          return response;
        }
      : undefined,
  });
}
