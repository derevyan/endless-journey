import type { EnhancedUserJourney } from "@journey/schemas";
import { describe, expect, it } from "vitest";
import type { ClientData } from "../types";
import { buildFullContext } from "../utils/context";

describe("Bindings Context", () => {
  const createSession = (overrides?: Partial<EnhancedUserJourney>): EnhancedUserJourney => ({
    sessionId: "session-123",
    userId: "telegram_456",
    platformUserId: "telegram_456",
    journeyId: "journey-789",
    currentNodeId: "node-1",
    status: "active",
    context: { existingVar: "value" },
    tags: ["vip", "beta"],
    pendingTimers: [],
            pendingPluginFollowUps: [],
    nodeOutputs: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    hasStarted: false,
    history: [],
    ...overrides,
  });

  const createClientData = (overrides?: Partial<ClientData>): ClientData => ({
    id: "client-uuid-456",
    platform: "telegram",
    firstName: "John",
    lastName: "Doe",
    username: "johndoe",
    ...overrides,
  });

  describe("buildFullContext", () => {
    it("should include user namespace", () => {
      const session = createSession();
      const client = createClientData();
      const userVars = { points: 150, tier: "gold" };

      const context = buildFullContext({ session, client, userVars });

      expect(context.user).toEqual({
        id: "client-uuid-456",
        platform: "telegram",
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        vars: { points: 150, tier: "gold" },
      });
    });

    it("should include session namespace", () => {
      const session = createSession();

      const context = buildFullContext({ session });

      expect(context.session).toEqual({
        id: "session-123",
        journeyId: "journey-789",
        status: "active",
        currentNodeId: "node-1",
        tags: ["vip", "beta"],
      });
    });

    it("should include vars namespace with all scopes", () => {
      const session = createSession();
      const journeyVars = { welcomeMessage: "Hello!" };
      const globalVars = { supportEmail: "support@example.com" };

      const context = buildFullContext({ session, journeyVars, globalVars });

      expect(context.vars).toEqual({
        journey: { welcomeMessage: "Hello!" },
        global: { supportEmail: "support@example.com" },
        user: {}, // User vars are also included in the namespace
      });
    });

    it("should include nodes namespace with node outputs", () => {
      const session = createSession({
        nodeOutputs: {
          Get_Customer: {
            nodeId: "node-1",
            nodeLabel: "Get Customer",
            nodeType: "webhook",
            executedAt: new Date().toISOString(),
            data: { email: "john@example.com", id: "cust-123" },
          },
          Validate_User: {
            nodeId: "node-2",
            nodeLabel: "Validate User",
            nodeType: "condition",
            executedAt: new Date().toISOString(),
            data: { isValid: true },
          },
        },
      });

      const context = buildFullContext({ session });

      expect(context.nodes).toEqual({
        Get_Customer: { email: "john@example.com", id: "cust-123" },
        Validate_User: { isValid: true },
      });
    });

    it("should spread existing session context at top level", () => {
      const session = createSession({
        context: { existingVar: "value", userResponse: "hello" },
      });

      const context = buildFullContext({ session });

      // Variables from session.context are accessible at the root level
      expect(context.existingVar).toBe("value");
      expect(context.userResponse).toBe("hello");
    });

    it("should use session userId when client is not provided", () => {
      const session = createSession();

      const context = buildFullContext({ session });

      expect((context.user as Record<string, unknown>).id).toBe("telegram_456");
      expect((context.user as Record<string, unknown>).platform).toBe("unknown");
    });

    it("should handle empty nodeOutputs", () => {
      const session = createSession({ nodeOutputs: {} });

      const context = buildFullContext({ session });

      expect(context.nodes).toEqual({});
    });

    it("should handle undefined nodeOutputs", () => {
      const session = createSession();
      // @ts-expect-error - testing undefined case
      session.nodeOutputs = undefined;

      const context = buildFullContext({ session });

      expect(context.nodes).toEqual({});
    });

    it("should provide complete context for template substitution", () => {
      const session = createSession({
        nodeOutputs: {
          Get_Customer: {
            nodeId: "node-1",
            nodeLabel: "Get Customer",
            nodeType: "webhook",
            executedAt: new Date().toISOString(),
            data: { email: "john@example.com" },
          },
        },
      });
      const client = createClientData();
      const journeyVars = { greeting: "Welcome" };

      const context = buildFullContext({ session, client, journeyVars });

      // All namespaces should be accessible
      expect((context.user as Record<string, unknown>).firstName).toBe("John");
      expect((context.session as Record<string, unknown>).id).toBe("session-123");
      expect((context.vars as Record<string, unknown>).journey).toEqual({ greeting: "Welcome" });
      expect((context.nodes as Record<string, unknown>).Get_Customer).toEqual({ email: "john@example.com" });
    });
  });
});
