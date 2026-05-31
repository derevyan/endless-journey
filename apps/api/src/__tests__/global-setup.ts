/**
 * Vitest Global Setup for API Tests
 *
 * Runs before all tests to verify API server is running.
 * Includes retry logic to handle server restarts during test runs.
 */

import { createLogger } from "@journey/logger";
import teardown from "./global-teardown";

const log = createLogger("vitest:api:global-setup");

const API_BASE_URL = process.env.API_URL || "http://localhost:3001";
const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 500;

async function checkHealth(retryCount = 0): Promise<{ databaseMode?: string; environment?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    return (await response.json()) as { databaseMode?: string; environment?: string };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY_MS * Math.pow(2, retryCount);
      log.warn({ attempt: retryCount + 1, maxRetries: MAX_RETRIES, nextRetryMs: delay }, "⏳ API server not ready, retrying...");
      await new Promise((resolve) => setTimeout(resolve, delay));
      return checkHealth(retryCount + 1);
    }
    throw new Error(`\n\n❌ API server is not running at ${API_BASE_URL}\n\nStart the server with: pnpm dev:api\n`);
  }
}

export default async function setup() {
  log.info("🚀 Running API test global setup...");

  const health = await checkHealth();
  log.info({ databaseMode: health.databaseMode, environment: health.environment }, "✅ API server is running");

  log.info("✅ API test global setup complete");

  return teardown;
}
