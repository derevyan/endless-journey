import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";

// Extend Vitest's expect with jest-dom matchers
// @ts-expect-error - matchers type mismatch
expect.extend(matchers);

// Mock @journey/logger to silence log output during tests
vi.mock("@journey/logger", () => {
  const noopLog = () => {};
  const createLogger = () => ({
    trace: noopLog,
    debug: noopLog,
    info: noopLog,
    warn: noopLog,
    error: noopLog,
    fatal: noopLog,
    child: () => createLogger(),
  });
  return {
    createLogger,
    logger: {
      trace: noopLog,
      debug: noopLog,
      info: noopLog,
      warn: noopLog,
      error: noopLog,
      fatal: noopLog,
    },
    serializeError: (err: unknown) => (err instanceof Error ? { message: err.message } : { message: String(err) }),
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
