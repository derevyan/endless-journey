import type { NodeInput, WorkflowContext, WorkflowLogger } from "../../types";

const createTestWorkflowLogger = (): WorkflowLogger => ({
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  child: () => createTestWorkflowLogger(),
});

export const createTestWorkflowContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  orgId: "org-test",
  sessionId: "session-test",
  user: { id: "user-test" },
  log: createTestWorkflowLogger(),
  settings: {
    maxExecutionTimeMs: 10_000,
    nodeTimeoutMs: 10_000,
    mockLlm: true,
  },
  ...overrides,
});

export const createTestExecutorContext = createTestWorkflowContext;

export const createTestNodeInput = (overrides: Partial<NodeInput> = {}): NodeInput => ({
  message: "",
  conversationHistory: [],
  variables: {},
  previousNodeOutputs: new Map(),
  ...overrides,
});
