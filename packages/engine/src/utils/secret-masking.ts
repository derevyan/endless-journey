/**
 * Secret Masking Utilities
 *
 * Provides functions to mask sensitive data before logging.
 * Prevents auth tokens, API keys, and passwords from appearing in logs.
 */

/**
 * Sensitive query parameter patterns to mask
 * Matches: token, key, secret, auth, password, apikey, api_key, access_token, etc.
 */
const SENSITIVE_PARAM_PATTERN = /([?&](token|key|secret|auth|password|apikey|api_key|access_token|bearer|credential)=)[^&]+/gi;

/**
 * Masks sensitive query parameters in a URL
 *
 * @example
 * maskUrl("https://api.example.com?token=abc123&user=john")
 * // Returns: "https://api.example.com?token=***&user=john"
 *
 * @param url - The URL to mask
 * @returns URL with sensitive query parameters masked
 */
export function maskUrl(url: string): string {
  return url.replace(SENSITIVE_PARAM_PATTERN, "$1***");
}

/**
 * Masks the value portion of an Authorization header
 *
 * @example
 * maskAuthHeader("Bearer abc123xyz")
 * // Returns: "Bearer ***"
 *
 * maskAuthHeader("Basic dXNlcjpwYXNz")
 * // Returns: "Basic ***"
 *
 * @param value - The Authorization header value
 * @returns Masked header showing only the auth type
 */
export function maskAuthHeader(value: string): string {
  const spaceIndex = value.indexOf(" ");
  if (spaceIndex === -1) {
    // No space found, entire value is the token
    return "***";
  }
  const type = value.substring(0, spaceIndex);
  return `${type} ***`;
}

/**
 * Masks sensitive values in a headers object
 *
 * @example
 * maskHeaders({ "Authorization": "Bearer token123", "Content-Type": "application/json" })
 * // Returns: { "Authorization": "Bearer ***", "Content-Type": "application/json" }
 *
 * @param headers - Headers object to mask
 * @returns New object with sensitive headers masked
 */
export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "authorization") {
      masked[key] = maskAuthHeader(value);
    } else if (
      lowerKey.includes("token") ||
      lowerKey.includes("key") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("password") ||
      lowerKey.includes("credential")
    ) {
      masked[key] = "***";
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Creates a masked version of webhook request data for logging
 *
 * @param url - The webhook URL
 * @param method - HTTP method
 * @param headers - Request headers
 * @returns Object safe for logging
 */
export function createMaskedWebhookLogData(
  url: string,
  method: string,
  headers?: Record<string, string>
): {
  url: string;
  method: string;
  headers?: Record<string, string>;
} {
  return {
    url: maskUrl(url),
    method,
    ...(headers && { headers: maskHeaders(headers) }),
  };
}
