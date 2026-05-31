import type { DbClient } from "@journey/db";
import type {
  AgentWorkflow,
  ApprovalListParams,
  ApprovalListResult,
  ApprovalRecord,
  ApprovalResponse,
  AtomicWorkflowSaveInput,
  AtomicWorkflowSaveResult,
  CreateAgentWorkflow,
  IApiWorkflowService,
  SaveWorkflowVersionInput,
  UpdateAgentWorkflow,
  VersionedWorkflowData,
  WorkflowEdge,
  WorkflowEmitterContext,
  WorkflowEventEmitterFn,
  WorkflowListParams,
  WorkflowListResult,
  WorkflowNode,
  WorkflowValidationResult,
  WorkflowVersion,
} from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";
import * as approvalService from "./approval-service";
import * as crudService from "./crud-service";
import { createWorkflowEmitter } from "./event-emitter";
import type { WorkflowServiceContext } from "./service-context";
import * as versionService from "./version-service";

export class ApiWorkflowService implements IApiWorkflowService {
  private readonly ctx: WorkflowServiceContext;

  constructor(db: DbClient, organizationId: string, publisher: IEventPublisher) {
    this.ctx = { db, organizationId, publisher };
  }

  listWorkflows(params?: WorkflowListParams): Promise<WorkflowListResult> {
    return crudService.listWorkflows(this.ctx, params);
  }

  getWorkflowByKey(key: string): Promise<AgentWorkflow | null> {
    return crudService.getWorkflowByKey(this.ctx, key);
  }

  createWorkflow(userId: string, data: CreateAgentWorkflow): Promise<AgentWorkflow> {
    return crudService.createWorkflow(this.ctx, userId, data);
  }

  updateWorkflow(userId: string, key: string, data: UpdateAgentWorkflow): Promise<AgentWorkflow> {
    return crudService.updateWorkflow(this.ctx, userId, key, data);
  }

  deleteWorkflow(key: string, force?: boolean): Promise<void> {
    return crudService.deleteWorkflow(this.ctx, key, force);
  }

  validateWorkflowConfig(nodes: WorkflowNode[], edges: WorkflowEdge[]): Promise<WorkflowValidationResult> {
    return crudService.validateWorkflowConfig(nodes, edges);
  }

  listWorkflowVersions(workflowKey: string): Promise<WorkflowVersion[]> {
    return versionService.listWorkflowVersions(this.ctx, workflowKey);
  }

  saveWorkflowVersion(
    workflowKey: string,
    userId: string,
    data: SaveWorkflowVersionInput
  ): Promise<WorkflowVersion> {
    return versionService.saveWorkflowVersion(this.ctx, workflowKey, userId, data);
  }

  getWorkflowVersion(workflowKey: string, versionId: string): Promise<VersionedWorkflowData | null> {
    return versionService.getWorkflowVersion(this.ctx, workflowKey, versionId);
  }

  deleteWorkflowVersion(workflowKey: string, versionId: string): Promise<boolean> {
    return versionService.deleteWorkflowVersion(this.ctx, workflowKey, versionId);
  }

  saveVersionAtomic(
    workflowKey: string,
    userId: string,
    data: AtomicWorkflowSaveInput
  ): Promise<AtomicWorkflowSaveResult> {
    return versionService.saveVersionAtomic(this.ctx, workflowKey, userId, data);
  }

  listApprovals(params: ApprovalListParams): Promise<ApprovalListResult> {
    return approvalService.listApprovals(this.ctx, params);
  }

  getApproval(id: string): Promise<ApprovalRecord | null> {
    return approvalService.getApproval(this.ctx, id);
  }

  respondToApproval(
    id: string,
    userId: string,
    userRoles: string[],
    response: ApprovalResponse
  ): Promise<ApprovalRecord> {
    return approvalService.respondToApproval(this.ctx, id, userId, userRoles, response);
  }

  createWorkflowEmitter(ctx: WorkflowEmitterContext): WorkflowEventEmitterFn {
    return createWorkflowEmitter(ctx, this.ctx.publisher);
  }
}
