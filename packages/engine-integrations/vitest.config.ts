import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load API .env for API keys (OPENAI_API_KEY, DATABASE_URL, etc.)
config({ path: resolve(__dirname, "../../apps/api/.env") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      LOG_LEVEL: "error",
      NODE_ENV: "test",
    },
    // Integration tests may need more time for API calls
    testTimeout: 30000,
  },
});
