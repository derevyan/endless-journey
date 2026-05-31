import type {
  AgentWorkflow,
  CreateAgentWorkflow,
  UpdateAgentWorkflow,
  WorkflowConfiguration,
  WorkflowEdge,
  WorkflowNode,
  WorkflowStatus,
  WorkflowVersion,
  SaveWorkflowVersionInput,
  VersionedWorkflowData,
  AtomicWorkflowSaveInput,
  AtomicWorkflowSaveResult,
} from "../../agents/workflow";

export interface WorkflowListParams {
  status?: WorkflowStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface WorkflowSummary {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  nodeCount: number;
  agentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowListResult {
  workflows: WorkflowSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string; code: string }>;
  warnings: Array<{ path: string; message: string; code: string }>;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "timed_out";

export interface ApprovalRecord {
  id: string;
  workflowId: string;
  workflowRunId: string;
  orgId: string;
  nodeId: string;
  message: string;
  status: ApprovalStatus;
  executionState: Record<string, unknown> | null;
  timeoutSeconds: number | null;
  timeoutAction: "approve" | "reject" | "skip" | null;
  expiresAt: Date | null;
  timeoutJobId: string | null;
  allowedRoles: string[] | null;
  respondedBy: string | null;
  respondedAt: Date | null;
  responseNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalResponse {
  approved: boolean;
  note?: string;
}

export interface ApprovalListParams {
  status?: ApprovalStatus;
  limit?: number;
  offset?: number;
}

export interface ApprovalListResult {
  approvals: ApprovalRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkflowEventPayload {
  type: string;
  payload: Record<string, unknown>;
}

export type WorkflowEventEmitterFn = (event: WorkflowEventPayload) => void;

export interface WorkflowEmitterContext {
  organizationId: string;
  sessionId: string | null;
  journeyId: string;
  clientId: string | null;
  performedBy: string;
  triggeredBy: "journey" | "manual" | "automation";
  workflowKey?: string;
}

export interface IApiWorkflowService {
  listWorkflows(params?: WorkflowListParams): Promise<WorkflowListResult>;
  getWorkflowByKey(key: string): Promise<AgentWorkflow | null>;
  createWorkflow(userId: string, data: CreateAgentWorkflow): Promise<AgentWorkflow>;
  updateWorkflow(userId: string, key: string, data: UpdateAgentWorkflow): Promise<AgentWorkflow>;
  deleteWorkflow(key: string, force?: boolean): Promise<void>;
  validateWorkflowConfig(nodes: WorkflowNode[], edges: WorkflowEdge[]): Promise<WorkflowValidationResult>;

  listWorkflowVersions(workflowKey: string): Promise<WorkflowVersion[]>;
  saveWorkflowVersion(workflowKey: string, userId: string, data: SaveWorkflowVersionInput): Promise<WorkflowVersion>;
  getWorkflowVersion(workflowKey: string, versionId: string): Promise<VersionedWorkflowData | null>;
  deleteWorkflowVersion(workflowKey: string, versionId: string): Promise<boolean>;
  saveVersionAtomic(workflowKey: string, userId: string, data: AtomicWorkflowSaveInput): Promise<AtomicWorkflowSaveResult>;

  listApprovals(params: ApprovalListParams): Promise<ApprovalListResult>;
  getApproval(id: string): Promise<ApprovalRecord | null>;
  respondToApproval(
    id: string,
    userId: string,
    userRoles: string[],
    response: ApprovalResponse
  ): Promise<ApprovalRecord>;

  createWorkflowEmitter(ctx: WorkflowEmitterContext): WorkflowEventEmitterFn;
}
