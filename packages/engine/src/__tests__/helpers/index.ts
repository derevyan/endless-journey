/**
 * Test Helpers Index
 *
 * Centralized exports for all test utilities and mock factories.
 * Import from this module for clean test setup.
 *
 * @example
 * ```ts
 * import {
 *   createMockContext,
 *   createMockServices,
 *   createMockSession,
 *   MockMessagingAdapter,
 * } from "../helpers";
 *
 * describe("MyHandler", () => {
 *   it("should work", async () => {
 *     const context = createMockContext({
 *       node: { data: { type: "message", content: "Hello" } },
 *     });
 *     const result = await myHandler.execute(context);
 *     expect(result.action).toBe("wait");
 *   });
 * });
 * ```
 */

// Mock adapter for integration testing
export { MockMessagingAdapter } from "./mock-adapter";

// Service mocks
export { createMockServices, createMockLogger } from "./mock-services";

// Session mocks
export { createMockSession, createHistoryEvent, type MockSessionOptions } from "./mock-session";

// Context and node mocks
export {
  createMockContext,
  createMockNode,
  createMockEdge,
  type MockContextOptions,
} from "./mock-context";
