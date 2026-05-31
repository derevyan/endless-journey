import type { AgentWorkflow, WorkflowNode, WorkflowNodeType } from "@journey/schemas";

export const createTestWorkflow = (overrides: Partial<AgentWorkflow> = {}): AgentWorkflow => ({
  id: "00000000-0000-0000-0000-000000000000",
  orgId: "00000000-0000-0000-0000-000000000000",
  key: "test-workflow",
  name: "Test Workflow",
  description: "Test workflow",
  status: "draft",
  configuration: {
    nodes: [],
    edges: [],
  },
  settings: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
  ...overrides,
});

export const createTestWorkflowNode = <T extends WorkflowNodeType>(
  type: T,
  overrides: Partial<WorkflowNode> = {}
): WorkflowNode => ({
  id: `test-${type}-node`,
  type,
  position: { x: 0, y: 0 },
  data: {},
  ...overrides,
});
