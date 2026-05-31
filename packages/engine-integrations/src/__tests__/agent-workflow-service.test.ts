import { beforeEach, describe, expect, it, vi } from "vitest";

let mockRows: Array<Record<string, unknown>> = [];

const runWorkflowMock = vi.fn();
const registerBuiltinExecutorsMock = vi.fn();

vi.mock("@journey/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => mockRows),
        })),
      })),
    })),
  },
  agentWorkflows: {},
}));

vi.mock("@journey/llm/workflow", () => ({
  runWorkflow: runWorkflowMock,
  registerBuiltinExecutors: registerBuiltinExecutorsMock,
}));

async function importService() {
  vi.resetModules();
  return import("../agent-workflow-service");
}

describe("AgentWorkflowService", () => {
  beforeEach(() => {
    mockRows = [];
    runWorkflowMock.mockReset();
    registerBuiltinExecutorsMock.mockReset();
  });

  it("registers executors once across initialize and runWorkflow", async () => {
    const { createAgentWorkflowService } = await importService();

    const service = createAgentWorkflowService();
    service.initialize?.();
    service.initialize?.();

    const workflow = {
      id: "wf-1",
      orgId: "org-1",
      key: "support",
      name: "Support",
      status: "active" as const,
      configuration: { nodes: [], edges: [] },
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const input = { message: "hello", conversationHistory: [] };
    const context = {
      orgId: "org-1",
      sessionId: "session-1",
      user: { id: "user-1" },
      log: {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(),
      },
      settings: {},
    };

    runWorkflowMock.mockResolvedValueOnce({ ok: true });
    // Use type assertion to bypass strict type checking for test mocks
    await service.runWorkflow({ workflow, input, context } as unknown as Parameters<typeof service.runWorkflow>[0]);

    expect(registerBuiltinExecutorsMock).toHaveBeenCalledTimes(1);
    expect(runWorkflowMock).toHaveBeenCalledWith(workflow, input, context);
  });

  it("returns null when workflow is not found", async () => {
    const { createAgentWorkflowService } = await importService();
    const service = createAgentWorkflowService();

    mockRows = [];

    const workflow = await service.loadWorkflow({
      organizationId: "org-1",
      workflowKey: "missing",
    });

    expect(workflow).toBeNull();
  });

  it("maps database rows to AgentWorkflow shape", async () => {
    const { createAgentWorkflowService } = await importService();
    const service = createAgentWorkflowService();

    const now = new Date().toISOString();
    mockRows = [
      {
        id: "wf-1",
        organizationId: "org-1",
        key: "support",
        name: "Support",
        description: null,
        status: "active",
        configuration: { nodes: [], edges: [] },
        settings: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const workflow = await service.loadWorkflow({
      organizationId: "org-1",
      workflowKey: "support",
    });

    expect(workflow).toEqual({
      id: "wf-1",
      orgId: "org-1",
      key: "support",
      name: "Support",
      description: undefined,
      status: "active",
      configuration: { nodes: [], edges: [] },
      settings: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  describe("workflow status filtering", () => {
    it("returns null when workflow is draft and allowDrafts is not set", async () => {
      const { createAgentWorkflowService } = await importService();
      const service = createAgentWorkflowService();

      // Simulate database returning empty (no matching active workflows)
      mockRows = [];

      const workflow = await service.loadWorkflow({
        organizationId: "org-1",
        workflowKey: "draft-workflow",
      });

      expect(workflow).toBeNull();
    });

    it("loads draft workflow when allowDrafts is true", async () => {
      const { createAgentWorkflowService } = await importService();
      const service = createAgentWorkflowService();

      const now = new Date().toISOString();
      mockRows = [
        {
          id: "wf-draft",
          organizationId: "org-1",
          key: "draft-workflow",
          name: "Draft Workflow",
          description: null,
          status: "draft",
          configuration: { nodes: [], edges: [] },
          settings: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const workflow = await service.loadWorkflow({
        organizationId: "org-1",
        workflowKey: "draft-workflow",
        options: { allowDrafts: true },
      });

      expect(workflow).not.toBeNull();
      expect(workflow?.status).toBe("draft");
    });

    it("loads archived workflow when allowArchived is true", async () => {
      const { createAgentWorkflowService } = await importService();
      const service = createAgentWorkflowService();

      const now = new Date().toISOString();
      mockRows = [
        {
          id: "wf-archived",
          organizationId: "org-1",
          key: "archived-workflow",
          name: "Archived Workflow",
          description: null,
          status: "archived",
          configuration: { nodes: [], edges: [] },
          settings: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const workflow = await service.loadWorkflow({
        organizationId: "org-1",
        workflowKey: "archived-workflow",
        options: { allowArchived: true },
      });

      expect(workflow).not.toBeNull();
      expect(workflow?.status).toBe("archived");
    });

    it("active workflows are always loadable", async () => {
      const { createAgentWorkflowService } = await importService();
      const service = createAgentWorkflowService();

      const now = new Date().toISOString();
      mockRows = [
        {
          id: "wf-active",
          organizationId: "org-1",
          key: "active-workflow",
          name: "Active Workflow",
          description: null,
          status: "active",
          configuration: { nodes: [], edges: [] },
          settings: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      // Without any options
      const workflow = await service.loadWorkflow({
        organizationId: "org-1",
        workflowKey: "active-workflow",
      });

      expect(workflow).not.toBeNull();
      expect(workflow?.status).toBe("active");
    });
  });
});
