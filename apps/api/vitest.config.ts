import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      LOG_LEVEL: "silent", // silent = suppress logs during tests
      ALLOW_MOCK_AUTH: "true", // Enable mock auth for tests
      BETTER_AUTH_SECRET: "test-only-secret-not-used-in-production-0000", // Dummy 32+ char secret for tests
    },
    include: [
      "src/__tests__/**/*.test.ts",
      "src/services/**/__tests__/**/*.test.ts",
      "src/modules/**/__tests__/**/*.test.ts",
      "src/adapters/**/__tests__/**/*.test.ts",
    ],
    // Allow running specific test categories with pattern matching
    // e.g., pnpm test -- --grep "health"

    // Global setup and teardown
    globalSetup: ["./src/__tests__/global-setup.ts"],

    // Timeouts for cleanup operations
    teardownTimeout: 30000, // 30s for cleanup
    hookTimeout: 30000, // 30s for beforeAll/afterAll
  },
});
