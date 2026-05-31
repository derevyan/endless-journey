/**
 * Crypto Utilities
 *
 * Shared utilities for encryption/decryption operations across the API.
 *
 * @module lib/crypto-utils
 */

import { decrypt, isEncrypted } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import { appConfig } from "../config";

const log = createLogger("crypto-utils");

/**
 * Resolve an encrypted bot token, with fallback behavior for test environments.
 *
 * @param encryptedToken - The potentially encrypted token
 * @returns The decrypted token, or the original if not encrypted
 * @throws If decryption fails in non-test environments
 */
export function resolveBotToken(encryptedToken: string): string {
  if (!isEncrypted(encryptedToken)) {
    return encryptedToken;
  }

  try {
    return decrypt(encryptedToken);
  } catch (error) {
    log.warn({ err: serializeError(error) }, "crypto:resolveBotToken:decryptFailed");
    if (appConfig.env.isTest) {
      // In test environments, allow fallback to original token
      return encryptedToken;
    }
    throw error;
  }
}

/**
 * Resolve an encrypted webhook secret, with null safety.
 *
 * @param encryptedSecret - The potentially encrypted secret (may be null)
 * @returns The decrypted secret, or null if input is null or decryption fails in test
 * @throws If decryption fails in non-test environments
 */
export function resolveWebhookSecret(encryptedSecret: string | null): string | null {
  if (!encryptedSecret) return null;

  if (!isEncrypted(encryptedSecret)) {
    return encryptedSecret;
  }

  try {
    return decrypt(encryptedSecret);
  } catch (error) {
    log.warn({ err: serializeError(error) }, "crypto:resolveWebhookSecret:decryptFailed");
    if (appConfig.env.isTest) {
      return null;
    }
    throw error;
  }
}

/**
 * Resolve an encrypted token for display purposes, returning masked version on failure.
 *
 * @param encryptedToken - The potentially encrypted token
 * @param tokenHash - Optional hash for fallback display
 * @returns The decrypted token, or a masked version on failure
 */
export function resolveBotTokenForDisplay(encryptedToken: string, tokenHash?: string | null): string {
  if (!isEncrypted(encryptedToken)) {
    return encryptedToken;
  }

  try {
    return decrypt(encryptedToken);
  } catch (error) {
    // Catch all decryption errors and fallback gracefully
    log.warn({ err: serializeError(error) }, "crypto:resolveBotTokenForDisplay:decryptFailed");
    return tokenHash && tokenHash.length >= 4 ? `...${tokenHash.slice(-4)}` : "...XXXX";
  }
}
