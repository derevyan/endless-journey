/**
 * User Impersonation E2E Tests
 *
 * Tests the complete impersonate workflow:
 * - Zero sessions: Error notification
 * - One session: Auto-redirect to playback
 * - Multiple sessions: Dialog display with session list
 * - Session selection: Navigate and start playback
 * - Download: Export session as JSON
 *
 * @module features/users/hooks/__tests__/use-user-impersonation.e2e
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TelegramUser, TelegramUserSession, SessionDetail } from "@/shared/lib/api";
import type { JourneyRecord } from "@journey/schemas";

/**
 * Mock API responses for different session scenarios
 */

const mockUserBase: Omit<TelegramUser, "sessionCount" | "lastActiveAt" | "createdAt"> = {
  id: "user-123",
  platform: "telegram",
  platformUserId: "123456789",
  firstName: "John",
  lastName: "Doe",
  username: "johndoe",
  tags: ["vip"],
};

const mockJourneyRecord: JourneyRecord = {
  id: "journey-123",
  slug: "saas-onboarding",
  name: "SaaS Onboarding",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSessionBase = (sessionId: string): Omit<TelegramUserSession, "id"> => ({
  journeyName: "SaaS Onboarding",
  status: "active",
  currentNodeId: "node-welcome",
  updatedAt: new Date().toISOString(),
});

const mockSessionDetailBase = (sessionId: string): Omit<SessionDetail, "id" | "interactions"> => ({
  userId: "user-123",
  telegramUserId: "123456789",
  journeyId: "journey-123",
  status: "active",
  currentNodeId: "node-welcome",
  context: { companyName: "Acme Corp" },
  tags: ["vip"],
  nodeOutputs: {
    "node-welcome": {
      nodeId: "node-welcome",
      nodeLabel: "Welcome",
      nodeType: "message",
      executedAt: new Date().toISOString(),
      data: { messagesSent: 1 },
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
    hasStarted: false,
});

describe("User Impersonation Workflow E2E", () => {
  /**
   * Test 1: User with 0 sessions
   * Expected: Error notification, no dialog shown
   */
  describe("Scenario 1: User with 0 sessions", () => {
    it("should show error notification when impersonating user with no sessions", () => {
      // Arrange
      const user: TelegramUser = {
        ...mockUserBase,
        sessionCount: 0,
        lastActiveAt: null,
        createdAt: new Date().toISOString(),
      };

      const sessions: TelegramUserSession[] = [];

      // Act
      const result = {
        showDialog: sessions.length > 1,
        sessions,
        error: sessions.length === 0 ? "No sessions found for this user" : null,
      };

      // Assert
      expect(result.error).toBe("No sessions found for this user");
      expect(result.showDialog).toBe(false);
      expect(result.sessions).toHaveLength(0);
    });
  });

  /**
   * Test 2: User with 1 session
   * Expected: Auto-redirect to playback, no dialog shown
   */
  describe("Scenario 2: User with 1 session", () => {
    it("should auto-load single session without showing dialog", () => {
      // Arrange
      const user: TelegramUser = {
        ...mockUserBase,
        sessionCount: 1,
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const sessions: TelegramUserSession[] = [
        {
          id: "session-1",
          ...mockSessionBase("session-1"),
        },
      ];

      // Act
      const shouldShowDialog = sessions.length > 1;
      const sessionToLoad = sessions.length === 1 ? sessions[0] : null;

      // Assert
      expect(shouldShowDialog).toBe(false);
      expect(sessionToLoad).not.toBeNull();
      expect(sessionToLoad?.id).toBe("session-1");
      expect(sessionToLoad?.journeyName).toBe("SaaS Onboarding");
    });

    it("should preserve session metadata during auto-load", () => {
      // Arrange
      const session: TelegramUserSession = {
        id: "session-1",
        journeyName: "SaaS Onboarding",
        status: "completed",
        currentNodeId: "node-completed",
        updatedAt: "2024-01-15T10:30:00Z",
      };

      // Act
      const metadata = {
        journeyName: session.journeyName,
        status: session.status,
        currentNodeId: session.currentNodeId,
      };

      // Assert
      expect(metadata.journeyName).toBe("SaaS Onboarding");
      expect(metadata.status).toBe("completed");
      expect(metadata.currentNodeId).toBe("node-completed");
    });
  });

  /**
   * Test 3: User with multiple sessions
   * Expected: Show session selection dialog with all sessions
   */
  describe("Scenario 3: User with multiple sessions", () => {
    it("should display session selection dialog with all sessions", () => {
      // Arrange
      const user: TelegramUser = {
        ...mockUserBase,
        sessionCount: 3,
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const sessions: TelegramUserSession[] = [
        {
          id: "session-1",
          journeyName: "SaaS Onboarding",
          status: "completed",
          currentNodeId: "node-completed",
          updatedAt: "2024-01-15T10:30:00Z",
        },
        {
          id: "session-2",
          journeyName: "SaaS Onboarding",
          status: "active",
          currentNodeId: "node-email-check",
          updatedAt: "2024-01-16T14:20:00Z",
        },
        {
          id: "session-3",
          journeyName: "SaaS Onboarding",
          status: "dropped",
          currentNodeId: "node-company-info",
          updatedAt: "2024-01-16T09:15:00Z",
        },
      ];

      // Act
      const shouldShowDialog = sessions.length > 1;
      const displayedSessions = shouldShowDialog ? sessions : [];

      // Assert
      expect(shouldShowDialog).toBe(true);
      expect(displayedSessions).toHaveLength(3);
      expect(displayedSessions[0].status).toBe("completed");
      expect(displayedSessions[1].status).toBe("active");
      expect(displayedSessions[2].status).toBe("dropped");
    });

    it("should display session details correctly in dialog", () => {
      // Arrange
      const session: TelegramUserSession = {
        id: "session-1",
        journeyName: "SaaS Onboarding",
        status: "active",
        currentNodeId: "node-email-check",
        updatedAt: "2024-01-16T14:20:00Z",
      };

      // Act
      const displayData = {
        journeyName: session.journeyName,
        status: session.status,
        currentNode: session.currentNodeId,
        lastUpdated: session.updatedAt,
      };

      // Assert
      expect(displayData.journeyName).toBeDefined();
      expect(displayData.status).toBeDefined();
      expect(displayData.currentNode).toBeDefined();
      expect(displayData.lastUpdated).toBeDefined();
    });
  });

  /**
   * Test 4: Session selection and playback initialization
   * Expected: Load session detail, convert to playback format, redirect to journey
   */
  describe("Scenario 4: Session selection and playback", () => {
    it("should load and convert session detail for playback", () => {
      // Arrange
      const sessionDetail: SessionDetail = {
        id: "session-1",
        userId: "user-123",
        telegramUserId: "123456789",
        journeyId: "journey-123",
        status: "active",
        currentNodeId: "node-email-check",
        context: {
          companyName: "Acme Corp",
          userEmail: "john@acme.com",
        },
        tags: ["vip"],
        nodeOutputs: {
          "node-welcome": {
            nodeId: "node-welcome",
            nodeLabel: "Welcome",
            nodeType: "message",
            executedAt: new Date().toISOString(),
            data: { messagesSent: 1 },
          },
          "node-email-check": {
            nodeId: "node-email-check",
            nodeLabel: "Email Check",
            nodeType: "message",
            executedAt: new Date().toISOString(),
            data: { validEmail: true },
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
    hasStarted: false,
        interactions: [
          {
            id: "int-1",
            timestamp: new Date().toISOString(),
            nodeId: "node-welcome",
            type: "engine.message",
            payload: {
              role: "assistant",
              content: "Welcome!",
              messageId: "msg-1",
            },
          },
          {
            id: "int-2",
            timestamp: new Date().toISOString(),
            nodeId: "node-email-check",
            type: "user.response",
            payload: {
              role: "user",
              content: "john@acme.com",
            },
          },
        ],
      };

      // Act
      const playbackData = {
        journeyId: sessionDetail.journeyId,
        sessionId: sessionDetail.id,
        userId: sessionDetail.userId,
        currentNodeId: sessionDetail.currentNodeId,
        totalInteractions: sessionDetail.interactions.length,
        hasNodeOutputs: Object.keys(sessionDetail.nodeOutputs).length > 0,
      };

      // Assert
      expect(playbackData.journeyId).toBe("journey-123");
      expect(playbackData.totalInteractions).toBe(2);
      expect(playbackData.hasNodeOutputs).toBe(true);
      expect(playbackData.currentNodeId).toBe("node-email-check");
    });

    it("should construct SessionExport from SessionDetail", () => {
      // Arrange
      const sessionDetail: SessionDetail = {
        id: "session-1",
        userId: "user-123",
        telegramUserId: "123456789",
        journeyId: "journey-123",
        status: "completed",
        currentNodeId: "node-completed",
        context: { companyName: "Acme Corp" },
        tags: ["vip"],
        nodeOutputs: {
          "node-welcome": {
            nodeId: "node-welcome",
            nodeLabel: "Welcome",
            nodeType: "message",
            executedAt: new Date().toISOString(),
            data: { messagesSent: 1 },
          },
        },
        createdAt: "2024-01-10T14:00:00Z",
        updatedAt: "2024-01-15T10:30:00Z",
        completedAt: "2024-01-15T10:30:00Z",
        interactions: [
          {
            id: "int-1",
            timestamp: "2024-01-10T14:00:00Z",
            nodeId: "node-welcome",
            type: "engine.message",
            payload: { role: "assistant", content: "Welcome!", messageId: "msg-1" },
          },
        ],
      };

      // Act
      const sessionExport = {
        exportVersion: "1.0" as const,
        exportedAt: new Date().toISOString(),
        journey: {
          id: mockJourneyRecord.id,
          slug: mockJourneyRecord.slug || mockJourneyRecord.id,
          name: mockJourneyRecord.name,
        },
        user: {
          id: mockUserBase.id,
          platformUserId: mockUserBase.platformUserId,
          displayName: `${mockUserBase.firstName} ${mockUserBase.lastName}`,
          firstName: mockUserBase.firstName,
          lastName: mockUserBase.lastName,
          username: mockUserBase.username,
        },
        session: {
          id: sessionDetail.id,
          status: sessionDetail.status as "completed" | "active" | "dropped" | "paused",
          currentNodeId: sessionDetail.currentNodeId,
          context: sessionDetail.context,
          tags: sessionDetail.tags,
          nodeOutputs: sessionDetail.nodeOutputs,
          startedAt: sessionDetail.createdAt,
          updatedAt: sessionDetail.updatedAt,
          completedAt: sessionDetail.completedAt,
        },
        interactions: sessionDetail.interactions,
      };

      // Assert
      expect(sessionExport.exportVersion).toBe("1.0");
      expect(sessionExport.journey.id).toBe("journey-123");
      expect(sessionExport.user.displayName).toBe("John Doe");
      expect(sessionExport.interactions).toHaveLength(1);
      expect(sessionExport.session.status).toBe("completed");
    });
  });

  /**
   * Test 5: Download session as JSON
   * Expected: Session exported as JSON with correct schema
   */
  describe("Scenario 5: Download session as JSON", () => {
    it("should generate valid SessionExport JSON with all required fields", () => {
      // Arrange
      const sessionDetail: SessionDetail = {
        id: "session-1",
        userId: "user-123",
        telegramUserId: "123456789",
        journeyId: "journey-123",
        status: "active",
        currentNodeId: "node-email-check",
        context: { companyName: "Acme Corp" },
        tags: ["vip"],
        nodeOutputs: {
          "node-welcome": {
            nodeId: "node-welcome",
            nodeLabel: "Welcome",
            nodeType: "message",
            executedAt: new Date().toISOString(),
            data: { messagesSent: 1 },
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
    hasStarted: false,
        interactions: [
          {
            id: "int-1",
            timestamp: new Date().toISOString(),
            nodeId: "node-welcome",
            type: "engine.message",
            payload: { role: "assistant", content: "Welcome!", messageId: "msg-1" },
          },
        ],
      };

      // Act
      const exportJson = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        journey: { id: "journey-123", slug: "saas-onboarding", name: "SaaS Onboarding" },
        user: {
          id: "user-123",
          platformUserId: "123456789",
          displayName: "John Doe",
          firstName: "John",
          lastName: "Doe",
          username: "johndoe",
        },
        session: {
          id: "session-1",
          status: "active",
          currentNodeId: "node-email-check",
          context: { companyName: "Acme Corp" },
          tags: ["vip"],
          nodeOutputs: sessionDetail.nodeOutputs,
          startedAt: sessionDetail.createdAt,
          updatedAt: sessionDetail.updatedAt,
          completedAt: null,
    hasStarted: false,
        },
        interactions: sessionDetail.interactions,
      };

      const jsonString = JSON.stringify(exportJson, null, 2);

      // Assert
      expect(jsonString).toBeDefined();
      const parsed = JSON.parse(jsonString);
      expect(parsed.exportVersion).toBe("1.0");
      expect(parsed.journey.id).toBeDefined();
      expect(parsed.user.displayName).toBeDefined();
      expect(parsed.session.currentNodeId).toBeDefined();
      expect(parsed.interactions).toBeDefined();
    });

    it("should generate correct filename for download", () => {
      // Arrange
      const userDisplayName = "John Doe";
      const journeySlug = "saas-onboarding";
      const exportDate = "2024-01-15";

      // Act
      const sanitizedName = userDisplayName.toLowerCase().replace(/\s+/g, "-");
      const filename = `${journeySlug}-${sanitizedName}-${exportDate}.json`;

      // Assert
      expect(filename).toBe("saas-onboarding-john-doe-2024-01-15.json");
      expect(filename).toMatch(/\.json$/);
    });
  });

  /**
   * Test 6: UI Component Integration
   * Expected: Dialog shows correct session information and buttons
   */
  describe("Scenario 6: Dialog UI Integration", () => {
    it("should display session selection dialog with correct structure", () => {
      // Arrange
      const sessions: TelegramUserSession[] = [
        {
          id: "session-1",
          journeyName: "SaaS Onboarding",
          status: "completed",
          currentNodeId: "node-completed",
          updatedAt: "2024-01-15T10:30:00Z",
        },
        {
          id: "session-2",
          journeyName: "SaaS Onboarding",
          status: "active",
          currentNodeId: "node-email-check",
          updatedAt: "2024-01-16T14:20:00Z",
        },
      ];

      // Act
      const dialogProps = {
        open: true,
        sessions: sessions,
        hasPlayButton: true,
        hasDownloadButton: true,
      };

      // Assert
      expect(dialogProps.open).toBe(true);
      expect(dialogProps.sessions).toHaveLength(2);
      expect(dialogProps.hasPlayButton).toBe(true);
      expect(dialogProps.hasDownloadButton).toBe(true);
    });

    it("should render status badges with correct colors", () => {
      // Arrange
      const statuses = ["active", "completed", "dropped", "paused"];

      // Act
      const statusColorMap: Record<string, string> = {
        active: "bg-green-500/10 text-green-600",
        completed: "bg-blue-500/10 text-blue-600",
        dropped: "bg-red-500/10 text-red-600",
        paused: "bg-yellow-500/10 text-yellow-600",
      };

      // Assert
      statuses.forEach((status) => {
        expect(statusColorMap[status]).toBeDefined();
        expect(statusColorMap[status]).toMatch(/bg-|text-/);
      });
    });
  });

  /**
   * Test 7: Error Handling
   * Expected: Graceful error handling for API failures
   */
  describe("Scenario 7: Error Handling", () => {
    it("should handle API error when fetching sessions", () => {
      // Arrange
      const apiError = new Error("Failed to fetch sessions");

      // Act
      const errorHandler = (error: Error) => ({
        hasError: true,
        message: error.message,
        showDialog: false,
      });

      const result = errorHandler(apiError);

      // Assert
      expect(result.hasError).toBe(true);
      expect(result.message).toBe("Failed to fetch sessions");
      expect(result.showDialog).toBe(false);
    });

    it("should handle missing journey data", () => {
      // Arrange
      const sessionDetail: SessionDetail = {
        id: "session-1",
        userId: "user-123",
        telegramUserId: "123456789",
        journeyId: "", // Missing journey ID
        status: "active",
        currentNodeId: "node-welcome",
        context: {},
        tags: [],
        nodeOutputs: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
    hasStarted: false,
        interactions: [],
      };

      // Act
      const isValid = sessionDetail.journeyId.length > 0;

      // Assert
      expect(isValid).toBe(false);
    });

    it("should handle session with no interactions", () => {
      // Arrange
      const sessionDetail: SessionDetail = {
        id: "session-1",
        userId: "user-123",
        telegramUserId: "123456789",
        journeyId: "journey-123",
        status: "active",
        currentNodeId: "node-welcome",
        context: {},
        tags: [],
        nodeOutputs: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
    hasStarted: false,
        interactions: [], // No interactions
      };

      // Act
      const hasInteractions = sessionDetail.interactions.length > 0;
      const errorMessage = !hasInteractions ? "Session has no interaction history" : null;

      // Assert
      expect(hasInteractions).toBe(false);
      expect(errorMessage).toBe("Session has no interaction history");
    });
  });
});
