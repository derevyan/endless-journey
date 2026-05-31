/**
 * User Seeding Module
 *
 * Creates test users directly in the database with properly hashed passwords.
 * Uses the same scrypt algorithm and library as Better Auth for compatibility.
 *
 * @module seed/seed-users
 */

import { randomBytes } from "crypto";

import { createLogger, serializeError } from "@journey/logger";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { account, user } from "../schema";
import { TEST_USERS } from "./data";

const log = createLogger("db:seed:users");

/**
 * Better Auth scrypt configuration
 * Must match exactly for password verification to work
 */
const SCRYPT_CONFIG = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
};

/**
 * Hash a password using scrypt (same algorithm and params as Better Auth)
 * Uses @noble/hashes/scrypt - the same library Better Auth uses
 * Format: salt:hashedKey (both in hex)
 */
async function hashPassword(password: string): Promise<string> {
  const saltBytes = randomBytes(16);
  const salt = bytesToHex(saltBytes);
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: SCRYPT_CONFIG.N,
    r: SCRYPT_CONFIG.r,
    p: SCRYPT_CONFIG.p,
    dkLen: SCRYPT_CONFIG.dkLen,
    maxmem: 128 * SCRYPT_CONFIG.N * SCRYPT_CONFIG.r * 2,
  });
  return `${salt}:${bytesToHex(key)}`;
}

/**
 * Generate a unique ID for database records
 */
function generateId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Seed test users by inserting directly into the database
 * Creates both user and account records (required by Better Auth)
 */
export async function seedUsers() {
  log.info("Seeding test users...");

  for (const userData of TEST_USERS) {
    try {
      // Check if user already exists in database
      const existing = await db.select().from(user).where(eq(user.email, userData.email));

      if (existing.length > 0) {
        log.info({ email: userData.email }, "seed:userExists");
        continue;
      }

      // Generate IDs for user and account
      const userId = generateId();
      const accountId = generateId();

      // Hash the password using scrypt (same as Better Auth)
      const hashedPassword = await hashPassword(userData.password);

      // Create user record
      await db.insert(user).values({
        id: userId,
        name: userData.name,
        email: userData.email,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create account record (required for email/password auth in Better Auth)
      await db.insert(account).values({
        id: accountId,
        accountId: userData.email, // Better Auth uses email as accountId for credential provider
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      log.info({ email: userData.email, name: userData.name }, "seed:userCreated");
    } catch (error) {
      log.error({ email: userData.email, err: serializeError(error) }, "seed:userCreationError");
      // Continue with other users even if one fails
    }
  }
}
