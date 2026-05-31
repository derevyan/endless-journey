/**
 * ID Generation Utilities
 *
 * Centralized utilities for generating unique identifiers throughout the application.
 * Consolidates the common pattern of `crypto.randomUUID().slice(0, 8)` used in
 * node editors, definitions, and form builders.
 */

/**
 * Generates a short unique ID (8 characters).
 *
 * Uses crypto.randomUUID() and takes the first 8 characters for a balance
 * of uniqueness and brevity. Suitable for UI element IDs, form field keys,
 * and other non-persistent identifiers.
 *
 * @example
 * generateShortId() // "a1b2c3d4"
 * generateShortId("btn") // "btn-a1b2c3d4"
 * generateShortId("step") // "step-a1b2c3d4"
 */
export function generateShortId(prefix?: string): string {
  const id = crypto.randomUUID().slice(0, 8);
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Generates a button ID with standard prefix.
 * @example generateButtonId() // "btn-a1b2c3d4"
 */
export function generateButtonId(): string {
  return generateShortId("btn");
}

/**
 * Generates a question ID with standard prefix.
 * @example generateQuestionId() // "q-a1b2c3d4"
 */
export function generateQuestionId(): string {
  return generateShortId("q");
}

/**
 * Generates a step ID with standard prefix.
 * @example generateStepId() // "step-a1b2c3d4"
 */
export function generateStepId(): string {
  return generateShortId("step");
}
