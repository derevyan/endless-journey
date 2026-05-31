/**
 * Encryption Utilities for Sensitive Data
 *
 * Uses AES-256-GCM for authenticated encryption of secrets like:
 * - Bot tokens (messaging_channels.bot_token_encrypted)
 * - Webhook secrets (automation_webhooks.secret_key_encrypted)
 *
 * The encryption key should be set via ENCRYPTION_KEY environment variable.
 * Key must be 32 bytes (256 bits) - can be generated with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length

/**
 * Get encryption key from environment
 * @returns 32-byte key buffer
 * @throws Error if key is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("ENCRYPTION_KEY environment variable is not set. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes`);
  }

  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 *
 * Output format: base64(iv + authTag + ciphertext)
 * This ensures the encrypted value can be stored in a text column
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted string
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine: IV (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString("base64");
}

/**
 * Decrypt a base64-encoded encrypted string
 *
 * @param encryptedBase64 - Base64-encoded encrypted string from encrypt()
 * @returns Original plaintext string
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  // Extract: IV (12) + authTag (16) + ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Check if a value appears to be encrypted
 * (starts with base64 and has minimum length for iv + authTag)
 *
 * @param value - String to check
 * @returns true if value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false; // Minimum: base64(12 + 16 + 1) = ~39 chars

  // Must contain ONLY valid base64 characters (A-Z, a-z, 0-9, +, /, =)
  // This prevents false positives for Telegram tokens which contain : and -
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) {
    return false;
  }

  try {
    const decoded = Buffer.from(value, "base64");
    // Encrypted values should be at least IV + authTag + 1 byte
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Safely encrypt a value, returning original if already encrypted
 * Useful for migrations or idempotent operations
 *
 * @param value - String to encrypt
 * @returns Encrypted string
 */
export function safeEncrypt(value: string): string {
  if (isEncrypted(value)) {
    return value; // Already encrypted
  }
  return encrypt(value);
}

/**
 * Hash a secret value for deterministic lookups (e.g., unique token checks)
 *
 * @param value - Secret string to hash
 * @returns SHA-256 hex digest
 */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
