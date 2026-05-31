import { describe, expect, it, vi } from "vitest";
import { createVariableService } from "../services/variable-service";
import type { VariableAction } from "@journey/schemas";

const createLoggerStub = () =>
  ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  }) as unknown as ReturnType<typeof import("@journey/logger").createLogger>;

const testDeps = {
  journeyId: "journey-1",
  organizationId: "org-1",
  userId: "user-1",
  log: createLoggerStub(),
};

const actionWithJourneyOp: VariableAction = {
  journeyOperations: [{ op: "set", key: "score", value: 100 }],
};

const actionWithUserOp: VariableAction = {
  userOperations: [{ op: "set", key: "tier", value: "premium" }],
};

describe("Variable service strict mode", () => {
  it("throws error and calls onStrictError when strict: true and operation fails", async () => {
    const onStrictError = vi.fn();
    const operationError = new Error("Database connection failed");

    const service = createVariableService(testDeps, {
      onExecute: vi.fn().mockRejectedValue(operationError),
      strict: true,
      onStrictError,
    });

    await expect(service.executeAction(actionWithJourneyOp)).rejects.toThrow("Database connection failed");

    expect(onStrictError).toHaveBeenCalledTimes(1);
    expect(onStrictError).toHaveBeenCalledWith(operationError);
  });

  it("does not throw when strict: false (default) and operation fails", async () => {
    const logger = createLoggerStub();
    const operationError = new Error("Database connection failed");

    const service = createVariableService(
      { ...testDeps, log: logger },
      {
        onExecute: vi.fn().mockRejectedValue(operationError),
        strict: false,
      }
    );

    // Should not throw
    await expect(service.executeAction(actionWithJourneyOp)).resolves.toBeUndefined();

    // Should log the error
    expect(logger.error).toHaveBeenCalled();
  });

  it("calls onStrictError for user variable operation failures in strict mode", async () => {
    const onStrictError = vi.fn();
    const operationError = new Error("User variable update failed");

    const service = createVariableService(testDeps, {
      onUserExecute: vi.fn().mockRejectedValue(operationError),
      strict: true,
      onStrictError,
    });

    await expect(service.executeAction(actionWithUserOp)).rejects.toThrow("User variable update failed");

    expect(onStrictError).toHaveBeenCalledTimes(1);
    expect(onStrictError).toHaveBeenCalledWith(operationError);
  });

  it("continues processing in non-strict mode after user variable failure", async () => {
    const logger = createLoggerStub();
    const onExecute = vi.fn().mockResolvedValue(undefined);

    const service = createVariableService(
      { ...testDeps, log: logger },
      {
        onUserExecute: vi.fn().mockRejectedValue(new Error("User op failed")),
        onExecute,
        strict: false,
      }
    );

    const action: VariableAction = {
      userOperations: [{ op: "set", key: "tier", value: "premium" }],
      journeyOperations: [{ op: "set", key: "score", value: 100 }],
    };

    // Should not throw, and should continue to execute journey ops
    await expect(service.executeAction(action)).resolves.toBeUndefined();

    // Journey ops should still be called despite user op failure
    expect(onExecute).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
