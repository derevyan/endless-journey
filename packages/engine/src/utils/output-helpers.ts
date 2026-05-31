/**
 * Output Helper Functions
 *
 * Standardized utilities for serializing and formatting node execution outputs.
 * These helpers eliminate code duplication across handlers and ensure consistent
 * formatting for observability, templates, and analytics.
 *
 * Used by: message-handler, start-handler, end-handler, questionnaire-handler, agent-handler
 */

/**
 * Create standardized message delivery metadata
 *
 * Combines message content, delivery status, media, and timestamp into
 * a consistent structure used across multiple handlers.
 *
 * @param content - The message content (string or undefined)
 * @param sendResult - Result object from messenger.sendMessage()
 * @param validMedia - Validated media object with type and url
 * @param timestampField - Name of the timestamp field (default: "sentAt")
 * @returns Object with standardized message metadata
 *
 * @example
 * const metadata = createMessageMetadata(
 *   nodeData.content,
 *   sendResult,
 *   validMedia,
 *   "sentAt"
 * );
 * // Returns: { message: string | null, messageDelivered: boolean, mediaAttached: {...}, sentAt: timestamp }
 */
export function createMessageMetadata(
  content: string | undefined,
  sendResult: { success: boolean },
  validMedia?: { type: string; url: string } | null,
  timestampField: string = "sentAt"
): Record<string, string | boolean | null | object> {
  return {
    message: content || null,
    messageDelivered: sendResult.success,
    mediaAttached: serializeMedia(validMedia),
    [timestampField]: new Date().toISOString(),
  };
}

/**
 * Serialize media for storage
 *
 * Normalizes media objects to a consistent format with only type and url fields.
 * Handles undefined and null values safely.
 *
 * @param validMedia - Media object with at least type and url properties
 * @returns Serialized media object or null
 *
 * @example
 * const serialized = serializeMedia({ type: "image", url: "..." });
 * // Returns: { type: "image", url: "..." }
 */
export function serializeMedia(
  validMedia?: { type: string; url: string } | null
): { type: string; url: string } | null {
  return validMedia ? { type: validMedia.type, url: validMedia.url } : null;
}

/**
 * Serialize buttons for storage
 *
 * Extracts only id and text fields from button objects, filtering out
 * internal implementation details for clean storage.
 *
 * @param buttons - Array of button objects with at least id and text
 * @returns Array of serialized buttons or null if empty/undefined
 *
 * @example
 * const serialized = serializeButtons([
 *   { id: "btn1", text: "Click me", targetNodeId: "..." }
 * ]);
 * // Returns: [{ id: "btn1", text: "Click me" }]
 */
export function serializeButtons(
  buttons?: Array<{ id: string; text: string; [key: string]: unknown }>
): Array<{ id: string; text: string }> | null {
  return buttons && buttons.length > 0
    ? buttons.map((b) => ({ id: b.id, text: b.text }))
    : null;
}

/**
 * Create timestamp field with current time
 *
 * Generates a single timestamp field with ISO format. Useful for
 * handlers that only need a timestamp without other metadata.
 *
 * @param fieldName - Name of the timestamp field
 * @returns Object with single timestamp property
 *
 * @example
 * const timestamp = createTimestamp("executedAt");
 * // Returns: { executedAt: "2024-01-15T10:30:45.123Z" }
 */
export function createTimestamp(fieldName: string): Record<string, string> {
  return { [fieldName]: new Date().toISOString() };
}
