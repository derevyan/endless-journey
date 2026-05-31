import type { VariableAction } from "@journey/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNoOpVariableService,
  createVariableService,
  type GetUserVariablesCallback,
  type GetVariablesCallback,
  type UserVariableOperationCallback,
  type VariableOperationCallback,
} from "../services";

describe("VariableService", () => {
  let mockLog: ReturnType<typeof import("@journey/logger").createLogger>;

  beforeEach(() => {
    mockLog = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof import("@journey/logger").createLogger>;
  });

  describe("executeAction", () => {
    it("should execute journey operations with callback", async () => {
      const onExecute: VariableOperationCallback = vi.fn().mockResolvedValue(undefined);

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onExecute }
      );

      const action: VariableAction = {
        journeyOperations: [
          { op: "set", key: "counter", value: 10 },
          { op: "increment", key: "visits", amount: 1 },
        ],
      };

      await service.executeAction(action);

      expect(onExecute).toHaveBeenCalledWith("journey", "journey-123", [
        { op: "set", key: "counter", value: 10 },
        { op: "increment", key: "visits", amount: 1 },
      ]);
    });

    it("should execute global operations with callback", async () => {
      const onExecute: VariableOperationCallback = vi.fn().mockResolvedValue(undefined);

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onExecute }
      );

      const action: VariableAction = {
        globalOperations: [
          { op: "set", key: "globalCounter", value: 100 },
          { op: "delete", key: "oldVariable" },
        ],
      };

      await service.executeAction(action);

      expect(onExecute).toHaveBeenCalledWith("global", "org-456", [
        { op: "set", key: "globalCounter", value: 100 },
        { op: "delete", key: "oldVariable" },
      ]);
    });

    it("should execute user operations with callback", async () => {
      const onUserExecute: UserVariableOperationCallback = vi.fn().mockResolvedValue(undefined);

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onUserExecute }
      );

      const action: VariableAction = {
        userOperations: [
          { op: "set", key: "userPref", value: "dark" },
          { op: "increment", key: "loginCount", amount: 1 },
        ],
      };

      await service.executeAction(action);

      expect(onUserExecute).toHaveBeenCalledWith("user-789", [
        { op: "set", key: "userPref", value: "dark" },
        { op: "increment", key: "loginCount", amount: 1 },
      ]);
    });

    it("should execute all operation types in a single action", async () => {
      const onExecute: VariableOperationCallback = vi.fn().mockResolvedValue(undefined);
      const onUserExecute: UserVariableOperationCallback = vi.fn().mockResolvedValue(undefined);

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onExecute, onUserExecute }
      );

      const action: VariableAction = {
        journeyOperations: [{ op: "set", key: "journeyVar", value: 1 }],
        globalOperations: [{ op: "set", key: "globalVar", value: 2 }],
        userOperations: [{ op: "set", key: "userVar", value: 3 }],
      };

      await service.executeAction(action);

      expect(onUserExecute).toHaveBeenCalledWith("user-789", [{ op: "set", key: "userVar", value: 3 }]);
      expect(onExecute).toHaveBeenCalledWith("journey", "journey-123", [{ op: "set", key: "journeyVar", value: 1 }]);
      expect(onExecute).toHaveBeenCalledWith("global", "org-456", [{ op: "set", key: "globalVar", value: 2 }]);
    });

    it("should log warning when no execute callback for journey/global operations", async () => {
      const onUserExecute: UserVariableOperationCallback = vi.fn().mockResolvedValue(undefined);
      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onUserExecute }
      );

      const action: VariableAction = {
        journeyOperations: [{ op: "set", key: "test", value: 1 }],
      };

      await service.executeAction(action);

      expect(mockLog.warn).toHaveBeenCalledWith({ journeyOpsCount: 1, globalOpsCount: 0 }, "engine:variableService:noExecuteCallback");
    });

    it("should log warning when no user execute callback", async () => {
      const onExecute: VariableOperationCallback = vi.fn().mockResolvedValue(undefined);
      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onExecute }
      );

      const action: VariableAction = {
        userOperations: [{ op: "set", key: "test", value: 1 }],
      };

      await service.executeAction(action);

      expect(mockLog.warn).toHaveBeenCalledWith({ userOpsCount: 1 }, "engine:variableService:noUserVariableCallback");
    });

    it("should not call callbacks when no operations", async () => {
      const onExecute: VariableOperationCallback = vi.fn().mockResolvedValue(undefined);
      const onUserExecute: UserVariableOperationCallback = vi.fn().mockResolvedValue(undefined);

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onExecute, onUserExecute }
      );

      const action: VariableAction = {
        journeyOperations: [],
        globalOperations: [],
        userOperations: [],
      };

      await service.executeAction(action);

      expect(onExecute).not.toHaveBeenCalled();
      expect(onUserExecute).not.toHaveBeenCalled();
    });
  });

  describe("getAll", () => {
    it("should get journey variables via callback", async () => {
      const onGetVariables: GetVariablesCallback = vi.fn().mockResolvedValue({
        counter: 10,
        name: "test",
      });

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onGetVariables }
      );

      const result = await service.getAll("journey");

      expect(onGetVariables).toHaveBeenCalledWith("journey", "journey-123");
      expect(result).toEqual({ counter: 10, name: "test" });
    });

    it("should get global variables via callback", async () => {
      const onGetVariables: GetVariablesCallback = vi.fn().mockResolvedValue({
        globalSetting: "enabled",
      });

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onGetVariables }
      );

      const result = await service.getAll("global");

      expect(onGetVariables).toHaveBeenCalledWith("global", "org-456");
      expect(result).toEqual({ globalSetting: "enabled" });
    });

    it("should get user variables via callback", async () => {
      const onGetUserVariables: GetUserVariablesCallback = vi.fn().mockResolvedValue({
        userPref: "dark",
      });

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onGetUserVariables }
      );

      const result = await service.getAll("user");

      expect(onGetUserVariables).toHaveBeenCalledWith("user-789");
      expect(result).toEqual({ userPref: "dark" });
    });

    it("should return empty object when no callback", async () => {
      const service = createVariableService({
        journeyId: "journey-123",
        organizationId: "org-456",
        userId: "user-789",
        log: mockLog,
      });

      const result = await service.getAll("journey");

      expect(result).toEqual({});
    });

    it("should log variable count on successful fetch", async () => {
      const onGetVariables: GetVariablesCallback = vi.fn().mockResolvedValue({
        var1: 1,
        var2: 2,
        var3: 3,
      });

      const service = createVariableService(
        {
          journeyId: "journey-123",
          organizationId: "org-456",
          userId: "user-789",
          log: mockLog,
        },
        { onGetVariables }
      );

      await service.getAll("journey");

      expect(mockLog.debug).toHaveBeenCalledWith({ scope: "journey", scopeId: "journey-123", variableCount: 3 }, "engine:variableService:getAll");
    });
  });

  describe("createNoOpVariableService", () => {
    it("should return empty results from no-op service", async () => {
      const service = createNoOpVariableService();

      // executeAction should not throw
      await service.executeAction({
        journeyOperations: [{ op: "set", key: "test", value: 1 }],
      });

      // getAll should return empty object
      const result = await service.getAll("journey");
      expect(result).toEqual({});
    });

    it("should handle all scope types", async () => {
      const service = createNoOpVariableService();

      const journeyResult = await service.getAll("journey");
      const globalResult = await service.getAll("global");
      const userResult = await service.getAll("user");

      expect(journeyResult).toEqual({});
      expect(globalResult).toEqual({});
      expect(userResult).toEqual({});
    });
  });
});
