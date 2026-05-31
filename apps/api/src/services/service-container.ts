import type { DbClient } from "@journey/db";
import type {
  IApiChannelService,
  IApiCrmService,
  IApiEventService,
  IApiJourneyService,
  IApiMindstateService,
  IApiPromptService,
  IApiSimulatorService,
  IApiTagService,
  IApiUploadService,
  IApiUserService,
  IApiVariableService,
  IApiWorkflowService,
} from "@journey/schemas";
import {
  createNoOpApiCrmService,
  createNoOpApiEventService,
  createNoOpApiJourneyService,
  createNoOpApiMindstateService,
  createNoOpApiPromptService,
  createNoOpApiSimulatorService,
  createNoOpApiTagService,
  createNoOpApiUploadService,
  createNoOpApiUserService,
  createNoOpApiVariableService,
  createNoOpApiWorkflowService,
} from "@journey/schemas";

import { CachedVariableService } from "../modules/variables/services";
import { ApiChannelService } from "../modules/channels/services";
import { ApiCrmService } from "../modules/crm/services";
import { ApiEventService } from "../modules/event-api/services";
import { ApiJourneyService } from "../modules/journeys/services";
import { ApiMindstateService } from "../modules/mindstates/services";
import { ApiPromptService } from "../modules/prompts/services";
import { ApiSimulatorService } from "../modules/simulator/services";
import { ApiTagService } from "../modules/tags/services";
import { ApiUploadService } from "../modules/uploads/services";
import { ApiUserService } from "../modules/users/services";
import { ApiWorkflowService } from "../modules/workflows/services";
import type { IEventPublisher } from "./interfaces";

export interface ServiceContainer {
  variable: IApiVariableService;
  tag: IApiTagService;
  crm: IApiCrmService;
  channel: IApiChannelService;
  journey: IApiJourneyService;
  user: IApiUserService;
  prompt: IApiPromptService;
  event: IApiEventService;
  upload: IApiUploadService;
  workflow: IApiWorkflowService;
  mindstate: IApiMindstateService;
  simulator: IApiSimulatorService;
}

export interface ServiceContext {
  db: DbClient;
  organizationId: string;
  userId?: string;
  publisher: IEventPublisher;
}

export type ServiceContainerFactory = (ctx: ServiceContext) => ServiceContainer;

export function createProductionServices(ctx: ServiceContext): ServiceContainer {
  const tagService = new ApiTagService(ctx.db, ctx.organizationId, ctx.publisher);
  const journeyService = new ApiJourneyService(ctx.db, ctx.publisher);
  const variableService = new CachedVariableService(ctx.db, ctx.organizationId, ctx.publisher);
  const channelService = new ApiChannelService(
    ctx.db,
    ctx.organizationId,
    ctx.publisher,
    variableService,
    tagService,
    journeyService
  );
  const userService = new ApiUserService(ctx.db, ctx.organizationId, tagService, journeyService);
  const crmService = new ApiCrmService(ctx.db, ctx.organizationId, ctx.publisher, tagService);
  const promptService = new ApiPromptService(ctx.db, ctx.organizationId);
  const eventService = new ApiEventService(ctx.db);
  const uploadService = new ApiUploadService(ctx.db, ctx.organizationId);
  const workflowService = new ApiWorkflowService(ctx.db, ctx.organizationId, ctx.publisher);
  const mindstateService = new ApiMindstateService(ctx.db, ctx.organizationId, ctx.publisher);

  const baseServices: Omit<ServiceContainer, "simulator"> = {
    variable: variableService,
    tag: tagService,
    crm: crmService,
    channel: channelService,
    journey: journeyService,
    user: userService,
    prompt: promptService,
    event: eventService,
    upload: uploadService,
    workflow: workflowService,
    mindstate: mindstateService,
  };

  const systemServices = createSystemServices({ db: ctx.db, publisher: ctx.publisher });
  const simulatorService = new ApiSimulatorService(ctx.db, ctx.organizationId, ctx.publisher, baseServices, systemServices);

  return { ...baseServices, simulator: simulatorService };
}

export function createSystemServices(ctx: { db: DbClient; publisher: IEventPublisher }): ServiceContainer {
  const variable = createNoOpApiVariableService();
  const tag = createNoOpApiTagService();
  const journey = createNoOpApiJourneyService();
  const channel = new ApiChannelService(ctx.db, null, ctx.publisher, variable, tag, journey);
  const user = createNoOpApiUserService();
  const crm = createNoOpApiCrmService();
  const prompt = createNoOpApiPromptService();
  const event = createNoOpApiEventService();
  const upload = createNoOpApiUploadService();
  const workflow = createNoOpApiWorkflowService();
  const mindstate = createNoOpApiMindstateService();
  const simulator = createNoOpApiSimulatorService();

  return {
    variable,
    tag,
    crm,
    channel,
    journey,
    user,
    prompt,
    event,
    upload,
    workflow,
    mindstate,
    simulator,
  };
}
