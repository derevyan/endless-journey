import { describe, expect, it, vi } from "vitest";
import { createEngineIntegrations } from "../engine-integrations";
import { createAgentWorkflowService } from "../agent-workflow-service";
import { createMemoryService } from "../memory-service";

const mockWorkflowService = {
  initialize: vi.fn(),
  loadWorkflow: vi.fn(),
  runWorkflow: vi.fn(),
};

const mockMemoryService = {
  save: vi.fn(),
  search: vi.fn(),
  getRecent: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../agent-workflow-service", () => ({
  createAgentWorkflowService: vi.fn(() => mockWorkflowService),
}));

vi.mock("../memory-service", () => ({
  createMemoryService: vi.fn(() => mockMemoryService),
}));

describe("createEngineIntegrations", () => {
  it("wires services and scopes memory to client/org", () => {
    const integrations = createEngineIntegrations({
      clientId: "client-1",
      organizationId: "org-1",
    });

    expect(vi.mocked(createAgentWorkflowService)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createMemoryService)).toHaveBeenCalledWith({
      clientId: "client-1",
      organizationId: "org-1",
    });

    expect(integrations.agentWorkflowService).toBe(mockWorkflowService);
    expect(integrations.memoryService).toBe(mockMemoryService);
  });
});
