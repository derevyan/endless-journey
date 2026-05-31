/**
 * Database Reset Script
 *
 * Completely resets the database by:
 * 1. Dropping all tables (CASCADE to handle foreign keys)
 * 2. Pushing the schema from scratch
 * 3. Seeding initial data
 *
 * Run with: pnpm db:reset
 *
 * WARNING: This will DELETE ALL DATA in the database!
 */

import { createLogger, serializeError } from "@journey/logger";
import "dotenv/config";
import { closeDatabaseConnection, queryClient } from "./client";

const log = createLogger("db:reset");

/**
 * Drop all tables in the database
 * Uses CASCADE to handle foreign key constraints
 */
async function dropAllTables() {
  log.warn("🗑️  Dropping all tables...");

  try {
    // Get all table names from the public schema
    const tables = await queryClient`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    if (tables.length === 0) {
      log.info("No tables found to drop");
      return;
    }

    log.info({ tableCount: tables.length }, "Found tables to drop");

    // Drop all tables with CASCADE to handle foreign keys
    // Using a single DROP TABLE statement for efficiency
    const tableNames = tables.map((t) => `"${(t as { tablename: string }).tablename}"`).join(", ");
    await queryClient.unsafe(`DROP TABLE IF EXISTS ${tableNames} CASCADE;`);

    log.info({ droppedCount: tables.length }, "All tables dropped successfully");
  } catch (error) {
    log.error({ err: serializeError(error) }, "dropAllTables:error");
    throw error;
  }
}

/**
 * Create required PostgreSQL extensions
 * Must be run before drizzle-kit push so types like 'vector' are available
 */
async function createExtensions() {
  log.info("🔧 Creating required PostgreSQL extensions...");

  try {
    // pgvector extension for vector similarity search (agent memories)
    await queryClient`CREATE EXTENSION IF NOT EXISTS vector;`;
    log.info("pgvector extension created/verified");

    // pgcrypto extension for database-level encryption (future use)
    await queryClient`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
    log.info("pgcrypto extension created/verified");

    // pg_trgm extension for full-text search on JSONB conversation content
    // Enables trigram-based text matching for searching message content
    await queryClient`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
    log.info("pg_trgm extension created/verified");
  } catch (error) {
    log.error({ err: serializeError(error) }, "createExtensions:error");
    throw error;
  }
}

/**
 * Main reset function
 */
async function main() {
  // Safety guard: Block in production
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv === "production") {
    log.error({}, "drop:blocked - Cannot run in production environment");
    console.error("ERROR: Database drop is blocked in production.");
    console.error("This is a safety measure to prevent accidental data loss.");
    process.exit(1);
  }

  // Safety guard: Require explicit confirmation via environment variable
  const confirmReset = process.env.DB_RESET_CONFIRM;
  if (confirmReset !== "true") {
    log.error({}, "drop:blocked - DB_RESET_CONFIRM not set");
    console.error("ERROR: Database drop requires explicit confirmation.");
    console.error("");
    console.error("To proceed, set the environment variable:");
    console.error("  DB_RESET_CONFIRM=true pnpm db:drop");
    console.error("");
    console.error("WARNING: This will DELETE ALL DATA in the database!");
    process.exit(1);
  }

  log.warn({ env: nodeEnv, confirmReset }, "drop:safetyChecksPassed");
  log.warn("⚠️  DATABASE RESET - This will DELETE ALL DATA!");
  log.warn("Starting complete database reset...");

  try {
    // Step 1: Drop all tables
    await dropAllTables();

    // Step 2: Create required extensions (must run before drizzle-kit push)
    await createExtensions();

    log.info("✅ Database reset complete!");
    log.info("📝 Next steps:");
    log.info("   1. Run: pnpm db:push (to recreate schema)");
    log.info("   2. Run: pnpm db:seed (to seed initial data)");
    log.info("   Or run: pnpm db:reset (which does both)");
  } catch (error) {
    log.error({ err: serializeError(error) }, "reset:error");
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

main();
