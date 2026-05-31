/**
 * UUID-based ID generation utilities
 * Works in both Node.js and browsers
 */

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  // Use native randomUUID if available (Node.js 16+, modern browsers)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback for older environments using crypto.getRandomValues
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (8, 9, A, or B)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort fallback using Math.random (not cryptographically secure)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const generateId = (): string => generateUUID();
export const generateMessageId = (): string => `msg_${generateUUID()}`;
export const generateInsightId = (): string => `insight_${generateUUID()}`;
export const generateAgentId = (): string => `agent_${generateUUID()}`;
export const generateParameterId = (): string => `param_${generateUUID()}`;
