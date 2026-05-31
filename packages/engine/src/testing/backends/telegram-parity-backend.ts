import { createLogger, serializeError } from "@journey/logger";
import type {
  AgentNodeData,
  JourneyConfig,
  JourneyEdgeData,
  JourneyNodeData,
  MessageNodeData,
  QuestionnaireNodeData,
} from "@journey/schemas";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { AlternatePathDetector } from "../alternate-path-detector";
import type {
  AlternatePathInfo,
  NodeInput,
  TestVariation,
  VariationResult,
  VariationRunnerOptions,
  VariationStep,
} from "../types";
import type { BackendInitParams, TestExecutionBackend } from "./types";

export interface ApiHarnessInstance {
  start(): Promise<{ url: string; port: number }>;
  stop(): Promise<void>;
}

export interface ApiHarnessOptions {
  host?: string;
  port?: number;
}

export interface TelegramSandboxOptions {
  host?: string;
  port?: number;
  strict?: boolean;
}

export interface TelegramSandbox {
  start(): Promise<{ url: string; port: number }>;
  stop(): Promise<void>;
  getOutboundRequests(): Array<{ method: string; path: string; body: Record<string, unknown> }>;
  sendUpdate(update: unknown, options?: { headers?: Record<string, string> }): Promise<void>;
}

export interface TelegramParityBackendOptions {
  createApiHarness: (options?: ApiHarnessOptions) => ApiHarnessInstance;
  createTelegramSandbox: (options?: TelegramSandboxOptions) => TelegramSandbox;
  apiHarnessOptions?: ApiHarnessOptions;
  sandboxOptions?: TelegramSandboxOptions;
  channelId?: string;
  botToken?: string;
  mockUserId?: string;
  webhookSecret?: string;
}

const PARITY_CHANNEL_ID = "d4e5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f8a";
const PARITY_BOT_TOKEN = "test_token_12345_not_real";
const PARITY_WEBHOOK_SECRET = "blade-runner-secret";
const PARITY_MOCK_USER_ID = "user-demo";
const DEFAULT_PARITY_WAIT_MS = 3000;
const DEFAULT_PARITY_POLL_MS = 50;

type SessionListItem = {
  id: string;
  currentNodeId: string | null;
  status: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName?: string | null;
    username?: string | null;
  };
};

type SessionDetail = {
  id: string;
  currentNodeId: string | null;
  status: string;
  interactions: Array<{
    id: string;
    timestamp: string;
    type: string;
    nodeId: string | null;
    payload?: Record<string, unknown>;
  }>;
};

type ParityTimer = {
  id: string;
  edgeId: string;
  firesAt?: string;
  createdAt?: string;
  bullmqJobId?: string | null;
  channelId?: string | null;
};

type UserProfile = {
  userId: number;
  chatId: number;
  firstName: string;
  lastName?: string;
  username?: string;
};

export class TelegramParityBackend implements TestExecutionBackend {
  name = "telegram-parity";
  supportsWorkers = false;

  private logger = createLogger("telegram-parity-backend");
  private journey?: JourneyConfig;
  private runnerOptions?: VariationRunnerOptions;
  private journeyPath?: string;
  private apiHarness?: ApiHarnessInstance;
  private sandbox?: TelegramSandbox;
  private apiBaseUrl?: string;
  private sandboxBaseUrl?: string;
  private alternatePathDetector?: AlternatePathDetector;
  private edgesBySource = new Map<string, JourneyEdgeData[]>();
  private nodeMap = new Map<string, JourneyNodeData["data"]>();
  private runId = randomUUID();
  private updateCounter = 1;
  private messageCounter = 1;
  private createdJourneyId?: string;
  private previousDefaultJourneyId?: string | null;
  private parityWaitMs = DEFAULT_PARITY_WAIT_MS;
  private parityPollMs = DEFAULT_PARITY_POLL_MS;
  private freezeTimers = true;
  private fastForwardTimers = true;

  private channelId: string;
  private botToken: string;
  private mockUserId: string;
  private webhookSecret?: string;

  constructor(private options: TelegramParityBackendOptions) {
    this.channelId = options.channelId ?? PARITY_CHANNEL_ID;
    this.botToken = options.botToken ?? PARITY_BOT_TOKEN;
    this.mockUserId =
      options.mockUserId ?? process.env.TELEGRAM_PARITY_MOCK_USER_ID ?? PARITY_MOCK_USER_ID;
    this.webhookSecret = options.webhookSecret ?? PARITY_WEBHOOK_SECRET;
  }

  async initialize(params: BackendInitParams): Promise<void> {
    this.journey = params.journey;
    this.runnerOptions = params.runnerOptions;
    this.journeyPath = params.journeyPath;
    this.alternatePathDetector = new AlternatePathDetector(params.journey);
    this.parityWaitMs = this.parseParityMs("TELEGRAM_PARITY_WAIT_MS", DEFAULT_PARITY_WAIT_MS);
    this.parityPollMs = this.parseParityMs("TELEGRAM_PARITY_POLL_MS", DEFAULT_PARITY_POLL_MS);
    this.freezeTimers = this.parseParityBool("TELEGRAM_PARITY_FREEZE_TIMERS", true);
    this.fastForwardTimers = this.parseParityBool("TELEGRAM_PARITY_FAST_FORWARD_TIMERS", true);
    process.env.TELEGRAM_PARITY_CHANNEL_ID = this.channelId;
    process.env.TELEGRAM_PARITY_BOT_TOKEN = this.botToken;
    process.env.TELEGRAM_PARITY_FORCE_EXIT = "true";
    if (this.webhookSecret) {
      process.env.TELEGRAM_PARITY_WEBHOOK_SECRET = this.webhookSecret;
    }
    this.edgesBySource = new Map();
    for (const edge of params.journey.edges) {
      const existing = this.edgesBySource.get(edge.source) ?? [];
      existing.push(edge);
      this.edgesBySource.set(edge.source, existing);
    }
    this.nodeMap = new Map(params.journey.nodes.map((node) => [node.id, node.data]));
    this.resetCounters();

    this.sandbox = this.options.createTelegramSandbox({
      ...this.options.sandboxOptions,
    });
    const { url: sandboxUrl } = await this.sandbox.start();
    this.sandboxBaseUrl = sandboxUrl;
    process.env.TELEGRAM_API_BASE = sandboxUrl;

    this.apiHarness = this.options.createApiHarness(this.options.apiHarnessOptions);
    const { url: apiUrl } = await this.apiHarness.start();
    this.apiBaseUrl = apiUrl;

    await this.initializeJourney();
    await this.ensureAgentWorkflows();
    await this.registerWebhook();
  }

  async runSingle(variation: TestVariation): Promise<VariationResult> {
    const startTime = Date.now();
    let sessionId: string | undefined;

    if (!this.journey || !this.runnerOptions || !this.apiBaseUrl || !this.sandbox) {
      return this.createFailureResult(variation, "Telegram parity backend not initialized");
    }

    if (variation.timing !== "none") {
      this.logger.warn(
        { timing: variation.timing, variationId: variation.id },
        "telegramParity:timingUnsupported:runningWithoutTimingSimulation"
      );
    }

    const steps: VariationStep[] = [];
    const userProfile = this.buildUserProfile(variation.id);

    try {
      await this.sendStartUpdate(userProfile);
      sessionId = await this.waitForSession(userProfile, startTime);

      steps.push({
        nodeId: variation.path[0],
        action: "start",
        details: "Session started",
        timestamp: Date.now(),
      });

      await this.freezeSessionTimers(sessionId, "session_start");

      const runInputs = this.addAgentInputs(variation);
      const orderedInputs = this.orderInputs({ ...variation, inputs: runInputs });
      const pathIndex = new Map(variation.path.map((nodeId, index) => [nodeId, index]));

      for (const input of orderedInputs) {
        const expectedIndex = pathIndex.get(input.nodeId);
        const expectedNextNode =
          expectedIndex !== undefined ? variation.path[expectedIndex + 1] : undefined;
        const nodeData = this.nodeMap.get(input.nodeId);
        const waitMs = this.getNodeWaitMs(nodeData);
        const autoPrefixWaitMs =
          expectedIndex !== undefined
            ? this.getAutoPrefixWaitMs(variation.path, expectedIndex - 1)
            : 0;
        const waitForNodeMs = waitMs + autoPrefixWaitMs;
        const nextNodeData = expectedNextNode ? this.nodeMap.get(expectedNextNode) : undefined;
        const nextWaitMs = expectedNextNode ? this.getNodeWaitMs(nextNodeData) : undefined;
        const transitionWaitMs = expectedNextNode ? Math.max(waitMs, nextWaitMs ?? waitMs) : waitMs;

        if (input.inputType === "auto") {
          if (nodeData?.type === "agent") {
            await this.applyAgentAuto(sessionId, userProfile, input.nodeId, steps, startTime);
          } else if (nodeData?.type === "message") {
            await this.applyMessageAuto(
              sessionId,
              userProfile,
              input.nodeId,
              nodeData as MessageNodeData,
              steps,
              startTime
            );
          } else if (nodeData?.type === "questionnaire") {
            await this.applyQuestionnaireAuto(
              sessionId,
              userProfile,
              input.nodeId,
              nodeData as QuestionnaireNodeData,
              steps,
              startTime
            );
          } else {
            steps.push({
              nodeId: input.nodeId,
              action: "auto",
              details: "Auto-transition",
              timestamp: Date.now(),
            });
          }
          if (expectedNextNode) {
            await this.waitForNodeChange(
              sessionId,
              input.nodeId,
              startTime,
              transitionWaitMs,
              expectedNextNode,
              true
            );
          }
          await this.freezeSessionTimers(sessionId, "post_auto");
          continue;
        }

        await this.waitForNode(sessionId, input.nodeId, startTime, waitForNodeMs);
        await this.freezeSessionTimers(sessionId, "node_entered");

        if (input.inputType === "text") {
          steps.push({
            nodeId: input.nodeId,
            action: "text",
            details: `Text: "${input.value?.slice(0, 20) || ""}..."`,
            timestamp: Date.now(),
          });
          await this.sendTextUpdate(userProfile, input.value || "");
        } else if (input.inputType === "button") {
          steps.push({
            nodeId: input.nodeId,
            action: "click",
            details: `Button ${input.value}`,
            timestamp: Date.now(),
          });
          await this.sendButtonUpdate(userProfile, input.value || "");
        } else if (input.inputType === "timeout") {
          const edgeId = this.resolveTimeoutEdgeId(input.nodeId, expectedNextNode);
          if (!edgeId) {
            throw new Error(`No timeout edge resolved for node ${input.nodeId}`);
          }

          steps.push({
            nodeId: input.nodeId,
            action: "timeout",
            details: `Timer ${edgeId}`,
            timestamp: Date.now(),
          });

          const timerWaitMs = this.getTimerStepWaitMs();
          await this.fastForwardTimer(sessionId, edgeId, startTime, timerWaitMs, {
            nodeId: input.nodeId,
            expectedNextNode,
          });
        } else if (input.inputType === "plugin_timeout") {
          await this.applyPluginTimeout(sessionId, input, steps, startTime);
        } else if (input.inputType === "plugin_button") {
          await this.applyPluginButton(sessionId, userProfile, input, steps, startTime);
        }

        if (expectedNextNode) {
          await this.waitForNodeChange(
            sessionId,
            input.nodeId,
            startTime,
            transitionWaitMs,
            expectedNextNode
          );
        }
        await this.freezeSessionTimers(sessionId, "post_step");
      }

      const session = await this.waitForInteractionFlush(sessionId, startTime);
      const visitedNodes = this.buildVisitedNodes(session);
      const messagesSent = this.extractMessages(session);

      if (visitedNodes.length === 0) {
        return this.createFailureResult(
          variation,
          "No engine transitions recorded",
          undefined,
          startTime
        );
      }

      const evaluation = this.evaluatePath(variation, visitedNodes);
      return this.createResult(
        variation,
        evaluation.success,
        evaluation.error,
        evaluation.alternatePath,
        visitedNodes,
        messagesSent,
        steps,
        Date.now() - startTime,
        session.status
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.warn(
        { err: serializeError(error), variationId: variation.id },
        "telegramParity:runSingleFailed"
      );
      if (sessionId) {
        const snapshot = await this.captureFailureSnapshot(
          variation,
          sessionId,
          steps,
          startTime,
          message,
          stack
        );
        if (snapshot) {
          return snapshot;
        }
      }

      return this.createResult(
        variation,
        false,
        message,
        undefined,
        [],
        [],
        steps,
        Date.now() - startTime,
        "failed",
        stack
      );
    }
  }

  setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }
    if (this.runnerOptions) {
      this.runnerOptions.timeScale = scale;
    }
  }

  async teardown(): Promise<void> {
    if (this.apiBaseUrl && this.createdJourneyId) {
      try {
        if (this.previousDefaultJourneyId !== undefined) {
          await this.apiRequest("PUT", `/api/channels/${this.channelId}`, {
            defaultJourneyId: this.previousDefaultJourneyId,
          });
        }

        await this.apiRequest("DELETE", `/api/journeys/${this.createdJourneyId}/sessions`);
        await this.apiRequest("DELETE", `/api/journeys/${this.createdJourneyId}`);
      } catch (error) {
        this.logger.warn({ err: serializeError(error) }, "telegramParity:teardownCleanupFailed");
      }
    }

    try {
      await this.apiHarness?.stop();
    } catch (error) {
      this.logger.warn({ err: serializeError(error) }, "telegramParity:apiHarnessStopFailed");
    }

    try {
      await this.sandbox?.stop();
    } catch (error) {
      this.logger.warn({ err: serializeError(error) }, "telegramParity:sandboxStopFailed");
    }
  }

  private async initializeJourney(): Promise<void> {
    if (!this.journey || !this.apiBaseUrl) {
      throw new Error("Telegram parity backend missing journey or API base URL");
    }

    const channel = await this.apiRequest<{ bot: { defaultJourneyId?: string | null } }>(
      "GET",
      `/api/channels/${this.channelId}`
    );
    this.previousDefaultJourneyId = channel.bot.defaultJourneyId ?? null;

    const journeyName = this.buildJourneyName();
    const response = await this.apiRequest<{ journey: { id: string } }>("POST", "/api/journeys", {
      name: journeyName,
      description: `Blade Runner parity run ${this.runId}`,
      status: "active",
      configuration: this.journey,
    });
    this.createdJourneyId = response.journey.id;
    process.env.TELEGRAM_PARITY_JOURNEY_ID = this.createdJourneyId;

    await this.apiRequest("PUT", `/api/channels/${this.channelId}`, {
      defaultJourneyId: this.createdJourneyId,
    });
  }

  private async ensureAgentWorkflows(): Promise<void> {
    if (!this.journey) {
      return;
    }

    const workflowKeys = new Set<string>();
    for (const node of this.journey.nodes) {
      if (node.data.type !== "agent") {
        continue;
      }
      const workflowKey = (node.data as AgentNodeData).workflowKey;
      if (workflowKey) {
        workflowKeys.add(workflowKey);
      }
    }

    if (workflowKeys.size === 0) {
      return;
    }

    for (const workflowKey of workflowKeys) {
      const existing = await this.apiRequestMaybe<{ workflow: { key: string } }>(
        "GET",
        `/api/workflows/${encodeURIComponent(workflowKey)}`
      );

      if (existing) {
        this.logger.debug({ workflowKey }, "telegramParity:workflow:exists");
        continue;
      }

      const workflowPayload = this.loadWorkflowFromDisk(workflowKey);
      if (!workflowPayload) {
        this.logger.warn({ workflowKey }, "telegramParity:workflow:missing");
        continue;
      }

      await this.apiRequest("POST", "/api/workflows", workflowPayload);
      this.logger.info({ workflowKey }, "telegramParity:workflow:seeded");
    }
  }

  private loadWorkflowFromDisk(workflowKey: string): Record<string, unknown> | null {
    const workflowPath = path.resolve(
      process.cwd(),
      "apps/web/src/data/workflows",
      workflowKey,
      "workflow.json"
    );
    if (!fs.existsSync(workflowPath)) {
      return null;
    }

    const raw = fs.readFileSync(workflowPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const { $schema: _schema, id: _id, ...payload } = parsed;
    return payload;
  }

  private async registerWebhook(): Promise<void> {
    if (!this.sandboxBaseUrl || !this.apiBaseUrl) {
      throw new Error("Telegram parity backend missing sandbox or API base URL");
    }

    const webhookUrl = `${this.apiBaseUrl}/webhook/telegram/${this.channelId}`;
    const requestUrl = new URL(`/bot${this.botToken}/setWebhook`, this.sandboxBaseUrl).toString();

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sandbox setWebhook failed (${response.status}): ${text}`);
    }
  }

  private async sendStartUpdate(profile: UserProfile): Promise<void> {
    await this.sendUpdate(this.buildTextUpdate(profile, "/start"));
  }

  private async sendTextUpdate(profile: UserProfile, text: string): Promise<void> {
    await this.sendUpdate(this.buildTextUpdate(profile, text));
  }

  private async sendButtonUpdate(profile: UserProfile, data: string): Promise<void> {
    await this.sendUpdate(this.buildButtonUpdate(profile, data));
  }

  private async sendUpdate(update: unknown): Promise<void> {
    if (!this.sandbox) {
      throw new Error("Telegram parity sandbox not initialized");
    }

    const headers = this.webhookSecret
      ? { "X-Telegram-Bot-Api-Secret-Token": this.webhookSecret }
      : undefined;
    const maxAttempts = 3;
    let attempt = 0;
    let delayMs = 50;

    while (true) {
      try {
        await this.sandbox.sendUpdate(update, { headers });
        return;
      } catch (error) {
        attempt += 1;
        const message = error instanceof Error ? error.message : String(error);
        const retryable = message.includes("Webhook responded with 503");

        if (!retryable || attempt >= maxAttempts) {
          throw error;
        }

        this.logger.warn(
          { attempt, maxAttempts, delayMs, message },
          "telegramParity:sendUpdate:retrying"
        );
        await this.sleep(delayMs);
        delayMs *= 2;
      }
    }
  }

  private buildTextUpdate(profile: UserProfile, text: string): Record<string, unknown> {
    const timestamp = Math.floor(Date.now() / 1000);
    const messageId = this.messageCounter++;
    return {
      update_id: this.updateCounter++,
      message: {
        message_id: messageId,
        date: timestamp,
        text,
        from: {
          id: profile.userId,
          first_name: profile.firstName,
          last_name: profile.lastName,
          username: profile.username,
        },
        chat: {
          id: profile.chatId,
          type: "private",
          first_name: profile.firstName,
          last_name: profile.lastName,
          username: profile.username,
        },
      },
    };
  }

  private resetCounters(): void {
    const base = Date.now();
    this.updateCounter = base;
    this.messageCounter = base;
  }

  private buildButtonUpdate(profile: UserProfile, data: string): Record<string, unknown> {
    const timestamp = Math.floor(Date.now() / 1000);
    const messageId = this.messageCounter++;
    return {
      update_id: this.updateCounter++,
      callback_query: {
        id: `${this.runId}-${this.updateCounter}`,
        data,
        from: {
          id: profile.userId,
          first_name: profile.firstName,
          last_name: profile.lastName,
          username: profile.username,
        },
        message: {
          message_id: messageId,
          date: timestamp,
          chat: {
            id: profile.chatId,
            type: "private",
            first_name: profile.firstName,
            last_name: profile.lastName,
            username: profile.username,
          },
        },
      },
    };
  }

  private orderInputs(variation: TestVariation): NodeInput[] {
    const pathIndex = new Map(variation.path.map((nodeId, index) => [nodeId, index]));
    return variation.inputs
      .map((input, index) => ({
        input,
        order: pathIndex.get(input.nodeId) ?? Number.MAX_SAFE_INTEGER,
        index,
      }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map((entry) => entry.input);
  }

  private addAgentInputs(variation: TestVariation): NodeInput[] {
    const inputs = [...variation.inputs];
    const seenNodes = new Set(inputs.map((input) => input.nodeId));

    for (const nodeId of variation.path) {
      if (seenNodes.has(nodeId)) continue;
      const nodeData = this.nodeMap.get(nodeId);
      if (!nodeData || nodeData.type !== "agent") continue;

      const agentData = nodeData as AgentNodeData;
      const executionMode = agentData.executionMode ?? "immediate";
      if (executionMode === "immediate") continue;

      inputs.push({
        nodeId,
        inputType: "auto",
      });
      seenNodes.add(nodeId);
    }

    return inputs;
  }

  private async waitForSession(profile: UserProfile, startTime: number): Promise<string> {
    const journeyId = process.env.TELEGRAM_PARITY_JOURNEY_ID ?? this.createdJourneyId;
    if (!journeyId) {
      throw new Error("Journey not initialized for telegram parity");
    }
    const timeoutMs = Math.min(this.getRemainingTimeout(startTime), this.getParityWaitMs());
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const latest = await this.tryFetchLatestChannelSession(startTime);
      if (latest && this.matchesProfile(latest, profile)) return latest.id;

      const response = await this.apiRequest<{ sessions: SessionListItem[] }>(
        "GET",
        `/api/journeys/${journeyId}/sessions?limit=100`
      );

      const match = response.sessions.find((session) => this.matchesProfile(session, profile));
      if (match) return match.id;

      const recent = this.findRecentSession(response.sessions, startTime, profile);
      if (recent) return recent.id;

      await this.sleep(this.parityPollMs);
    }

    throw new Error(`Timed out waiting for session creation for ${profile.firstName}`);
  }

  private getNodeWaitMs(nodeData?: JourneyNodeData["data"]): number {
    let waitMs = this.getParityWaitMs();

    if (!nodeData) {
      return waitMs;
    }

    if (nodeData.type === "agent" || nodeData.type === "questionnaire") {
      waitMs = Math.max(waitMs, this.getAgentWaitMs());
    }

    if (nodeData.type === "message") {
      const msgData = nodeData as MessageNodeData;
      const delaySeconds = typeof msgData.delay === "number" ? msgData.delay : 0;
      if (delaySeconds > 0) {
        const scaledDelayMs = Math.round(delaySeconds * 1000 * this.getTimeScale());
        waitMs = Math.max(waitMs, scaledDelayMs + this.getDelayBufferMs());
      }
    }

    return waitMs;
  }

  private async waitForNode(
    sessionId: string,
    nodeId: string,
    startTime: number,
    maxWaitMs?: number
  ): Promise<void> {
    const remaining = this.getRemainingTimeout(startTime);
    const timeoutMs = Math.min(remaining, maxWaitMs ?? this.getParityWaitMs());
    const start = Date.now();
    let lastNode: string | null = null;

    while (Date.now() - start < timeoutMs) {
      const session = await this.fetchSession(sessionId);
      if (session.currentNodeId === nodeId) {
        return;
      }
      if (this.hasInteractionForNode(session, nodeId)) {
        return;
      }
      if (session.status === "completed" || session.status === "dropped") {
        throw new Error(`Session ended before reaching node ${nodeId} (status: ${session.status})`);
      }
      lastNode = session.currentNodeId;
      await this.sleep(this.parityPollMs);
    }

    throw new Error(`Timed out waiting for node ${nodeId} (last: ${lastNode ?? "unknown"})`);
  }

  private async waitForNodeOrVisited(
    sessionId: string,
    nodeId: string,
    startTime: number,
    maxWaitMs?: number
  ): Promise<{ session: SessionDetail; state: "active" | "visited" }> {
    const remaining = this.getRemainingTimeout(startTime);
    const timeoutMs = Math.min(remaining, maxWaitMs ?? this.getParityWaitMs());
    const start = Date.now();
    let lastNode: string | null = null;

    while (Date.now() - start < timeoutMs) {
      const session = await this.fetchSession(sessionId);
      if (session.currentNodeId === nodeId) {
        return { session, state: "active" };
      }

      const visitedNodes = this.buildVisitedNodes(session);
      if (visitedNodes.includes(nodeId)) {
        return { session, state: "visited" };
      }

      if (session.status === "completed" || session.status === "dropped") {
        throw new Error(`Session ended before reaching node ${nodeId} (status: ${session.status})`);
      }

      lastNode = session.currentNodeId;
      await this.sleep(this.parityPollMs);
    }

    throw new Error(`Timed out waiting for node ${nodeId} (last: ${lastNode ?? "unknown"})`);
  }

  private async waitForNodeChange(
    sessionId: string,
    nodeId: string,
    startTime: number,
    maxWaitMs?: number,
    expectedNextNode?: string,
    allowTimerFastForward = false
  ): Promise<void> {
    const remaining = this.getRemainingTimeout(startTime);
    const timeoutMs = Math.min(remaining, maxWaitMs ?? this.getParityWaitMs());
    const start = Date.now();
    const firedEdges = new Set<string>();

    while (Date.now() - start < timeoutMs) {
      const session = await this.fetchSession(sessionId);
      if (session.currentNodeId !== nodeId) {
        return;
      }
      if (this.hasTransitionFromNode(session, nodeId, expectedNextNode)) {
        return;
      }
      if (expectedNextNode && this.hasInteractionForNode(session, expectedNextNode)) {
        return;
      }
      if (session.status === "completed" || session.status === "dropped") {
        return;
      }
      if (allowTimerFastForward && this.fastForwardTimers) {
        const fired = await this.tryFastForwardNodeTimer(
          sessionId,
          nodeId,
          expectedNextNode,
          firedEdges
        );
        if (fired) {
          await this.sleep(this.parityPollMs);
          continue;
        }
      }
      await this.sleep(this.parityPollMs);
    }

    this.logger.debug({ nodeId, expectedNextNode }, "telegramParity:waitForNodeChange:timeout");
  }

  private hasTransitionFromNode(
    session: SessionDetail,
    nodeId: string,
    expectedNextNode?: string
  ): boolean {
    return session.interactions.some((event) => {
      if (event.type !== "engine.transition") return false;
      const payload = event.payload as { from?: string; to?: string } | undefined;
      const fromNode = payload?.from ?? event.nodeId;
      if (fromNode !== nodeId) return false;
      if (!expectedNextNode) return true;
      return payload?.to === expectedNextNode;
    });
  }

  private hasInteractionForNode(session: SessionDetail, nodeId: string): boolean {
    return session.interactions.some((event) => {
      if (event.nodeId === nodeId) return true;
      const payload = event.payload as { to?: string; nodeId?: string } | undefined;
      if (payload?.to === nodeId) return true;
      if (payload?.nodeId === nodeId) return true;
      return false;
    });
  }

  private getAutoPrefixWaitMs(path: string[], startIndex: number): number {
    if (startIndex < 0) return 0;
    let total = 0;

    for (let i = startIndex; i >= 0; i--) {
      const nodeData = this.nodeMap.get(path[i]);
      if (!this.isAutoNode(nodeData)) {
        break;
      }
      total += this.getNodeWaitMs(nodeData);
    }

    return total;
  }

  private isAutoNode(nodeData?: JourneyNodeData["data"]): boolean {
    if (!nodeData) return false;
    if (nodeData.type === "wait") return true;
    if (nodeData.type !== "message") return false;

    const msgData = nodeData as MessageNodeData;
    const inferredResponseType = msgData.buttons?.length ? "buttons" : "auto";
    const responseType = msgData.responseType ?? inferredResponseType;
    return responseType === "auto";
  }

  private async tryFetchLatestChannelSession(startTime: number): Promise<SessionListItem | null> {
    try {
      const response = await this.apiRequest<{ session: SessionListItem | null }>(
        "GET",
        `/api/testing/parity/channels/${encodeURIComponent(this.channelId)}/sessions/latest?since=${encodeURIComponent(
          String(startTime)
        )}`
      );
      return response.session ?? null;
    } catch {
      return null;
    }
  }

  private parseSessionTimestamp(value?: string | null): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private findRecentSession(
    sessions: SessionListItem[],
    startTime: number,
    profile?: UserProfile
  ): SessionListItem | undefined {
    const threshold = startTime - 1000;
    let best: { session: SessionListItem; time: number } | undefined;

    for (const session of sessions) {
      if (session.status === "dropped") continue;
      if (profile && !this.matchesProfile(session, profile)) continue;
      const createdAt = this.parseSessionTimestamp(session.createdAt);
      const updatedAt = this.parseSessionTimestamp(session.updatedAt);
      const candidateTime = Math.max(createdAt ?? 0, updatedAt ?? 0);
      if (!candidateTime || candidateTime < threshold) continue;
      if (!best || candidateTime > best.time) {
        best = { session, time: candidateTime };
      }
    }

    return best?.session;
  }

  private async waitForInteractionFlush(
    sessionId: string,
    startTime: number
  ): Promise<SessionDetail> {
    const timeoutMs = Math.min(this.getRemainingTimeout(startTime), this.getParityWaitMs());
    const start = Date.now();
    let lastCount = -1;
    let stableSince = Date.now();
    const stableMs = Math.max(this.getParityPollMs() * 2, 100);

    while (Date.now() - start < timeoutMs) {
      const session = await this.fetchSession(sessionId);
      const currentCount = session.interactions.length;

      if (currentCount === lastCount) {
        if (Date.now() - stableSince >= stableMs) {
          return session;
        }
      } else {
        stableSince = Date.now();
        lastCount = currentCount;
      }

      await this.sleep(this.parityPollMs);
    }

    return this.fetchSession(sessionId);
  }

  private buildVisitedNodes(session: SessionDetail): string[] {
    const transitions = session.interactions.filter((event) => event.type === "engine.transition");
    const seen = new Set<string>();
    const visited: string[] = [];

    for (const event of transitions) {
      const payload = event.payload as { to?: string } | undefined;
      const nodeId = typeof payload?.to === "string" ? payload.to : event.nodeId || undefined;
      if (nodeId && !seen.has(nodeId)) {
        seen.add(nodeId);
        visited.push(nodeId);
      }
    }

    if (visited.length === 0 && session.currentNodeId) {
      visited.push(session.currentNodeId);
    }

    return visited;
  }

  private buildFailureSnapshotDetails(session: SessionDetail): string {
    const currentNode = session.currentNodeId ?? "unknown";
    const status = session.status ?? "unknown";
    const recent = session.interactions
      .slice(-3)
      .map((event) => `${event.type}:${event.nodeId ?? "unknown"}`)
      .join(", ");
    return `Snapshot currentNode=${currentNode} status=${status} lastInteractions=[${recent}]`;
  }

  private parseFailureTargetNode(error: string): string | null {
    const match = /Session ended before reaching node ([^\s]+) \(status:/.exec(error);
    return match?.[1] ?? null;
  }

  private async captureFailureSnapshot(
    variation: TestVariation,
    sessionId: string,
    steps: VariationStep[],
    startTime: number,
    error: string,
    stack?: string
  ): Promise<VariationResult | null> {
    try {
      const session = await this.fetchSession(sessionId);
      const visitedNodes = this.buildVisitedNodes(session);
      const messagesSent = this.extractMessages(session);
      const evaluation =
        visitedNodes.length > 0 ? this.evaluatePath(variation, visitedNodes) : { success: false };

      let derivedError = error;
      let alternatePath: AlternatePathInfo | undefined;

      if (!evaluation.success && evaluation.error) {
        derivedError = evaluation.error;
        alternatePath = evaluation.alternatePath;
      } else if (error.includes("Session ended before reaching node")) {
        const targetNode = this.parseFailureTargetNode(error) ?? "unknown";
        const lastNode =
          visitedNodes[visitedNodes.length - 1] ?? session.currentNodeId ?? "unknown";
        derivedError = `Path diverged: session ended before reaching "${targetNode}", last at "${lastNode}", expected path [${variation.path.join(
          " -> "
        )}]`;
      }

      steps.push({
        nodeId: session.currentNodeId ?? variation.path[0],
        action: "finish",
        details: this.buildFailureSnapshotDetails(session),
        timestamp: Date.now(),
      });

      return this.createResult(
        variation,
        false,
        derivedError,
        alternatePath,
        visitedNodes,
        messagesSent,
        steps,
        Date.now() - startTime,
        session.status ?? "failed",
        stack
      );
    } catch (snapshotError) {
      this.logger.warn(
        { err: serializeError(snapshotError), sessionId, variationId: variation.id },
        "telegramParity:failureSnapshotFailed"
      );
      return null;
    }
  }

  private extractMessages(session: SessionDetail): string[] {
    const messages: string[] = [];

    for (const event of session.interactions) {
      if (event.type !== "engine.message") continue;
      const payload = event.payload as { content?: string; text?: string } | undefined;
      const content = payload?.content || payload?.text;
      messages.push(content || "[media/buttons]");
    }

    return messages;
  }

  private resolveTimeoutEdgeId(nodeId: string, expectedNextNode?: string): string | undefined {
    const outgoingEdges = this.edgesBySource.get(nodeId) ?? [];
    const timerEdge = outgoingEdges.find(
      (edge) => edge.edgeType === "timer" || edge.sourceHandle === "timer"
    );
    if (timerEdge) return timerEdge.id;

    const nodeData = this.nodeMap.get(nodeId);
    const questionnaireTimeout = this.getQuestionnaireTimeoutEdgeId(nodeId);
    if (questionnaireTimeout) {
      return questionnaireTimeout;
    }
    if (nodeData?.type !== "wait") {
      return undefined;
    }

    if (expectedNextNode) {
      const match = outgoingEdges.find((edge) => edge.target === expectedNextNode);
      if (match) return match.id;
    }

    return outgoingEdges[0]?.id;
  }

  private getQuestionnaireTimeoutEdgeId(nodeId: string): string | null {
    const nodeData = this.nodeMap.get(nodeId);
    if (nodeData?.type !== "questionnaire") {
      return null;
    }
    const qData = nodeData as QuestionnaireNodeData;
    if (qData.timeout?.targetNodeId) {
      return `questionnaire-timeout:${nodeId}`;
    }
    return null;
  }

  private getCandidateTimerEdgeIds(nodeId: string, expectedNextNode?: string): string[] {
    const edgeIds = new Set<string>();
    const resolved = this.resolveTimeoutEdgeId(nodeId, expectedNextNode);
    if (resolved) {
      edgeIds.add(resolved);
    }

    const questionnaireTimeout = this.getQuestionnaireTimeoutEdgeId(nodeId);
    if (questionnaireTimeout) {
      edgeIds.add(questionnaireTimeout);
    }

    const outgoingEdges = this.edgesBySource.get(nodeId) ?? [];
    for (const edge of outgoingEdges) {
      if (edge.edgeType === "timer" || edge.sourceHandle === "timer") {
        edgeIds.add(edge.id);
      }
      if (expectedNextNode && edge.target === expectedNextNode) {
        edgeIds.add(edge.id);
      }
    }

    return Array.from(edgeIds);
  }

  private async fetchTimers(sessionId: string): Promise<ParityTimer[]> {
    const response = await this.apiRequest<{ timers: ParityTimer[] }>(
      "GET",
      `/api/testing/parity/sessions/${encodeURIComponent(sessionId)}/timers`
    );
    return response.timers ?? [];
  }

  private selectTimerCandidate(
    timers: ParityTimer[],
    candidateEdgeIds: Set<string>
  ): ParityTimer | null {
    const candidates = timers.filter((candidate) => candidateEdgeIds.has(candidate.edgeId));
    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, current) => {
      const bestTime = this.getTimerTimestamp(best);
      const currentTime = this.getTimerTimestamp(current);
      return currentTime < bestTime ? current : best;
    });
  }

  private getTimerTimestamp(timer: ParityTimer): number {
    const raw = timer.firesAt ?? timer.createdAt;
    if (!raw) {
      return Number.POSITIVE_INFINITY;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }

  private async tryFastForwardNodeTimer(
    sessionId: string,
    nodeId: string,
    expectedNextNode: string | undefined,
    firedEdgeIds: Set<string>
  ): Promise<boolean> {
    const candidateEdges = this.getCandidateTimerEdgeIds(nodeId, expectedNextNode).filter(
      (edgeId) => !firedEdgeIds.has(edgeId)
    );
    if (candidateEdges.length === 0) {
      return false;
    }

    const timers = await this.fetchTimers(sessionId);
    const candidate = this.selectTimerCandidate(timers, new Set(candidateEdges));
    if (!candidate) {
      return false;
    }

    const fired = await this.tryFireTimer(sessionId, candidate.edgeId);
    firedEdgeIds.add(candidate.edgeId);
    if (!fired) {
      this.logger.debug(
        { edgeId: candidate.edgeId },
        "telegramParity:timerFastForward:alreadyFired"
      );
    }
    return true;
  }

  private async pauseSessionTimers(sessionId: string): Promise<number> {
    const response = await this.apiRequest<{ pausedCount?: number }>(
      "POST",
      `/api/testing/parity/sessions/${encodeURIComponent(sessionId)}/timers/pause`,
      {}
    );
    return response.pausedCount ?? 0;
  }

  private async resumeSessionTimers(sessionId: string): Promise<number> {
    const response = await this.apiRequest<{ resumedCount?: number }>(
      "POST",
      `/api/testing/parity/sessions/${encodeURIComponent(sessionId)}/timers/resume`,
      {}
    );
    return response.resumedCount ?? 0;
  }

  private async freezeSessionTimers(sessionId: string, reason: string): Promise<void> {
    if (!this.freezeTimers) return;
    try {
      await this.pauseSessionTimers(sessionId);
    } catch (error) {
      this.logger.warn(
        { err: serializeError(error), sessionId, reason },
        "telegramParity:timers:pauseFailed"
      );
    }
  }

  private async unfreezeSessionTimers(sessionId: string, reason: string): Promise<void> {
    if (!this.freezeTimers) return;
    try {
      await this.resumeSessionTimers(sessionId);
    } catch (error) {
      this.logger.warn(
        { err: serializeError(error), sessionId, reason },
        "telegramParity:timers:resumeFailed"
      );
    }
  }

  private async fastForwardTimer(
    sessionId: string,
    edgeId: string,
    startTime: number,
    maxWaitMs?: number,
    context?: { nodeId?: string; expectedNextNode?: string }
  ): Promise<ParityTimer | null> {
    const remaining = this.getRemainingTimeout(startTime);
    const timeoutMs = Math.min(remaining, maxWaitMs ?? this.getParityWaitMs());
    const start = Date.now();
    const candidateEdgeIds = context?.nodeId
      ? this.getCandidateTimerEdgeIds(context.nodeId, context.expectedNextNode)
      : [];
    const candidateSet = new Set(candidateEdgeIds);
    candidateSet.add(edgeId);

    while (Date.now() - start < timeoutMs) {
      const timers = await this.fetchTimers(sessionId);
      const timer =
        timers.find((candidate) => candidate.edgeId === edgeId) ||
        this.selectTimerCandidate(timers, candidateSet);
      if (timer) {
        const fired = await this.tryFireTimer(sessionId, timer.edgeId);
        if (!fired) {
          this.logger.debug(
            { edgeId: timer.edgeId },
            "telegramParity:timerFastForward:alreadyFired"
          );
        }
        return timer;
      }
      if (context?.nodeId) {
        const session = await this.fetchSession(sessionId);
        if (session.currentNodeId !== context.nodeId) {
          return null;
        }
      }
      await this.sleep(this.parityPollMs);
    }

    throw new Error(`Timed out waiting for timer ${edgeId}`);
  }

  private async fastForwardPluginTimer(
    sessionId: string,
    pluginId: string,
    startTime: number,
    maxWaitMs = 1000
  ): Promise<ParityTimer | null> {
    const remaining = this.getRemainingTimeout(startTime);
    const timeoutMs = Math.min(remaining, maxWaitMs ?? this.getParityWaitMs());
    const start = Date.now();
    const prefix = `followup-plugin:${pluginId}:`;

    while (Date.now() - start < timeoutMs) {
      const timers = await this.fetchTimers(sessionId);
      const timer = timers.find((candidate) => candidate.edgeId.startsWith(prefix));
      if (timer) {
        const fired = await this.tryFireTimer(sessionId, timer.edgeId);
        if (!fired) {
          this.logger.debug(
            { edgeId: timer.edgeId },
            "telegramParity:timerFastForward:alreadyFired"
          );
        }
        return timer;
      }
      await this.sleep(this.parityPollMs);
    }

    return null;
  }

  private async tryFireTimer(sessionId: string, edgeId: string): Promise<boolean> {
    if (!this.apiBaseUrl) {
      throw new Error("API base URL not initialized");
    }

    const url = new URL(
      `/api/testing/parity/timers/${encodeURIComponent(edgeId)}/fire`,
      this.apiBaseUrl
    ).toString();
    const maxAttempts = 3;
    let attempt = 0;
    let delayMs = 50;

    while (true) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Mock-User-Id": this.mockUserId,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        return true;
      }

      if (response.status === 404) {
        return false;
      }

      const text = await response.text();
      if (response.status === 409 && attempt < maxAttempts) {
        attempt += 1;
        this.logger.warn(
          { edgeId, sessionId, attempt, maxAttempts, delayMs, error: text },
          "telegramParity:timerFire:retrying"
        );
        await this.sleep(delayMs);
        delayMs *= 2;
        continue;
      }

      throw new Error(
        `API POST /api/testing/parity/timers/${edgeId}/fire failed (${response.status}): ${text}`
      );
    }
  }

  private async applyPluginTimeout(
    sessionId: string,
    input: NodeInput,
    steps: VariationStep[],
    startTime: number
  ): Promise<void> {
    const pluginId = input.pluginId;
    if (!pluginId) {
      throw new Error(`plugin_timeout missing pluginId at node ${input.nodeId}`);
    }

    const seenEdges = new Set<string>();
    const maxSteps = 20;
    let stepIndex = 0;

    while (stepIndex < maxSteps) {
      const timerWaitMs = this.getTimerStepWaitMs();
      const timer = await this.fastForwardPluginTimer(sessionId, pluginId, startTime, timerWaitMs);
      if (!timer || seenEdges.has(timer.edgeId)) {
        break;
      }
      seenEdges.add(timer.edgeId);

      steps.push({
        nodeId: input.nodeId,
        action: "timeout",
        details: `Plugin ${pluginId} ${timer.edgeId}`,
        timestamp: Date.now(),
      });

      stepIndex += 1;
    }
  }

  private async applyPluginButton(
    sessionId: string,
    profile: UserProfile,
    input: NodeInput,
    steps: VariationStep[],
    startTime: number
  ): Promise<void> {
    const pluginId = input.pluginId;
    const targetStepIndex = input.stepIndex;
    const buttonId = input.value;

    if (!pluginId || targetStepIndex === undefined || !buttonId) {
      throw new Error(`plugin_button missing data at node ${input.nodeId}`);
    }

    const seenEdges = new Set<string>();
    const maxAttempts = Math.max(targetStepIndex + 2, 5);
    const timerWaitMs = this.getTimerStepWaitMs();
    const outboundWaitMs = timerWaitMs;
    let lastStepIndex: number | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const outbound = this.sandbox?.getOutboundRequests() ?? [];
      const startCount = this.filterOutboundByChat(outbound, profile.chatId).length;

      const timer = await this.fastForwardPluginTimer(sessionId, pluginId, startTime, timerWaitMs);
      if (!timer) {
        throw new Error(
          `Timed out waiting for plugin follow-up timer ${pluginId} step ${targetStepIndex}`
        );
      }
      if (seenEdges.has(timer.edgeId)) {
        throw new Error(`Plugin follow-up timer repeated for ${pluginId} (${timer.edgeId})`);
      }
      seenEdges.add(timer.edgeId);

      const currentStepIndex = this.parsePluginStepIndex(timer.edgeId);
      if (currentStepIndex !== null) {
        lastStepIndex = currentStepIndex;
      }

      if (currentStepIndex === targetStepIndex) {
        const updatedOutbound = this.sandbox?.getOutboundRequests() ?? [];
        const chatOutbound = this.filterOutboundByChat(updatedOutbound, profile.chatId);
        if (!this.outboundHasButton(chatOutbound, buttonId)) {
          const matched = await this.waitForOutboundButton(
            profile.chatId,
            startCount,
            startTime,
            outboundWaitMs,
            buttonId
          );
          if (!matched) {
            throw new Error(
              `Plugin button ${buttonId} missing for ${pluginId} step ${targetStepIndex}`
            );
          }
        }

        steps.push({
          nodeId: input.nodeId,
          action: "click",
          details: `Plugin button ${buttonId} step ${targetStepIndex}`,
          timestamp: Date.now(),
        });
        await this.sendButtonUpdate(profile, buttonId);
        return;
      }

      if (currentStepIndex !== null && currentStepIndex > targetStepIndex) {
        break;
      }
    }

    throw new Error(
      `Plugin follow-up step ${targetStepIndex} not reached for ${pluginId} (last: ${lastStepIndex ?? "unknown"})`
    );
  }

  private async fetchSession(sessionId: string): Promise<SessionDetail> {
    const response = await this.apiRequest<{ session: SessionDetail }>(
      "GET",
      `/api/sessions/${sessionId}`
    );
    return response.session;
  }

  private async waitForInteractionGrowth(
    sessionId: string,
    startTime: number,
    previousCount: number,
    maxWaitMs?: number
  ): Promise<number> {
    const remaining = this.getRemainingTimeout(startTime);
    const timeoutMs = Math.min(remaining, maxWaitMs ?? this.getParityWaitMs());
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const session = await this.fetchSession(sessionId);
      const count = session.interactions.length;
      if (count > previousCount) {
        return count;
      }
      await this.sleep(this.parityPollMs);
    }

    return previousCount;
  }

  private async applyMessageAuto(
    sessionId: string,
    profile: UserProfile,
    nodeId: string,
    nodeData: MessageNodeData,
    steps: VariationStep[],
    startTime: number
  ): Promise<void> {
    const inferredResponseType = nodeData.buttons?.length ? "buttons" : "auto";
    const responseType = nodeData.responseType ?? inferredResponseType;
    const firstButton = nodeData.buttons?.[0];
    const waitMs = this.getNodeWaitMs(nodeData);

    if (responseType === "auto") {
      try {
        const { session, state } = await this.waitForNodeOrVisited(
          sessionId,
          nodeId,
          startTime,
          waitMs
        );
        if (state === "visited" && session.currentNodeId !== nodeId) {
          steps.push({
            nodeId,
            action: "auto",
            details: "Auto-transition (node already passed)",
            timestamp: Date.now(),
          });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("Timed out waiting for node")) {
          steps.push({
            nodeId,
            action: "auto",
            details: `Auto wait timed out: ${message}`,
            timestamp: Date.now(),
          });
          return;
        }
        throw error;
      }
    } else {
      await this.waitForNode(sessionId, nodeId, startTime, waitMs);
    }

    await this.freezeSessionTimers(sessionId, "message_auto");

    if ((responseType === "buttons" || responseType === "any") && firstButton) {
      steps.push({
        nodeId,
        action: "click",
        details: `Message button ${firstButton.id}`,
        timestamp: Date.now(),
      });
      await this.sendButtonUpdate(profile, firstButton.id);
      return;
    }

    if (responseType === "text" || responseType === "any") {
      const text = "test";
      steps.push({
        nodeId,
        action: "text",
        details: `Message input "${text}"`,
        timestamp: Date.now(),
      });
      await this.sendTextUpdate(profile, text);
      return;
    }

    steps.push({
      nodeId,
      action: "auto",
      details: "Auto-transition",
      timestamp: Date.now(),
    });
  }

  private async applyAgentAuto(
    sessionId: string,
    profile: UserProfile,
    nodeId: string,
    steps: VariationStep[],
    startTime: number
  ): Promise<void> {
    await this.waitForNode(
      sessionId,
      nodeId,
      startTime,
      this.getNodeWaitMs(this.nodeMap.get(nodeId))
    );
    await this.freezeSessionTimers(sessionId, "agent_auto");

    const outbound = this.sandbox?.getOutboundRequests() ?? [];
    const startCount = this.filterOutboundByChat(outbound, profile.chatId).length;
    const buttonId = await this.waitForOutboundButton(profile.chatId, startCount, startTime);
    if (buttonId) {
      steps.push({
        nodeId,
        action: "click",
        details: `Agent button ${buttonId}`,
        timestamp: Date.now(),
      });
      await this.sendButtonUpdate(profile, buttonId);
      return;
    }

    const fallbackText = "continue";
    steps.push({
      nodeId,
      action: "text",
      details: `Agent input "${fallbackText}"`,
      timestamp: Date.now(),
    });
    await this.sendTextUpdate(profile, fallbackText);
  }

  private async waitForOutboundButton(
    chatId: number,
    startCount: number,
    startTime: number,
    maxWaitMs?: number,
    expectedButtonId?: string
  ): Promise<string | null> {
    const remaining = this.getRemainingTimeout(startTime);
    const timeoutMs = Math.min(remaining, maxWaitMs ?? this.getParityWaitMs());
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const outbound = this.sandbox?.getOutboundRequests() ?? [];
      const chatOutbound = this.filterOutboundByChat(outbound, chatId);
      if (chatOutbound.length > startCount) {
        const newOutbound = chatOutbound.slice(startCount);
        if (expectedButtonId) {
          if (this.outboundHasButton(newOutbound, expectedButtonId)) {
            return expectedButtonId;
          }
        } else {
          const buttonId = this.extractFirstButtonId(newOutbound);
          if (buttonId) {
            return buttonId;
          }
        }
      }
      await this.sleep(this.parityPollMs);
    }

    return null;
  }

  private outboundHasButton(
    outbound: Array<{ body: Record<string, unknown> }>,
    buttonId: string
  ): boolean {
    return this.extractButtonIds(outbound).includes(buttonId);
  }

  private extractButtonIds(outbound: Array<{ body: Record<string, unknown> }>): string[] {
    const ids: string[] = [];

    for (let i = outbound.length - 1; i >= 0; i -= 1) {
      const replyMarkupRaw = outbound[i]?.body?.reply_markup;
      let replyMarkup: unknown = replyMarkupRaw;
      if (typeof replyMarkupRaw === "string") {
        try {
          replyMarkup = JSON.parse(replyMarkupRaw) as Record<string, unknown>;
        } catch {
          replyMarkup = null;
        }
      }
      if (!replyMarkup || typeof replyMarkup !== "object") continue;
      const keyboard = (replyMarkup as { inline_keyboard?: unknown }).inline_keyboard;
      if (!Array.isArray(keyboard)) continue;
      for (const row of keyboard) {
        if (!Array.isArray(row)) continue;
        for (const button of row) {
          const callbackData = (button as { callback_data?: unknown } | undefined)?.callback_data;
          if (typeof callbackData === "string" && callbackData.length > 0) {
            ids.push(callbackData);
          }
        }
      }
    }

    return ids;
  }

  private extractFirstButtonId(outbound: Array<{ body: Record<string, unknown> }>): string | null {
    for (let i = outbound.length - 1; i >= 0; i -= 1) {
      const replyMarkupRaw = outbound[i]?.body?.reply_markup;
      let replyMarkup: unknown = replyMarkupRaw;
      if (typeof replyMarkupRaw === "string") {
        try {
          replyMarkup = JSON.parse(replyMarkupRaw) as Record<string, unknown>;
        } catch {
          replyMarkup = null;
        }
      }
      if (!replyMarkup || typeof replyMarkup !== "object") continue;
      const keyboard = (replyMarkup as { inline_keyboard?: unknown }).inline_keyboard;
      if (!Array.isArray(keyboard) || keyboard.length === 0) continue;
      const firstRow = keyboard[0];
      if (!Array.isArray(firstRow) || firstRow.length === 0) continue;
      const button = firstRow[0] as { callback_data?: unknown } | undefined;
      const callbackData = button?.callback_data;
      if (typeof callbackData === "string" && callbackData.length > 0) {
        return callbackData;
      }
    }
    return null;
  }

  private filterOutboundByChat(
    outbound: Array<{ body: Record<string, unknown> }>,
    chatId: number
  ): Array<{ body: Record<string, unknown> }> {
    const chatIdString = String(chatId);
    return outbound.filter((entry) => {
      const candidate = entry?.body?.chat_id;
      if (candidate === undefined || candidate === null) return false;
      return String(candidate) === chatIdString;
    });
  }

  private matchesProfile(session: SessionListItem, profile: UserProfile): boolean {
    return (
      session.user.firstName === profile.firstName || session.user.username === profile.username
    );
  }

  private async applyQuestionnaireAuto(
    sessionId: string,
    profile: UserProfile,
    nodeId: string,
    nodeData: QuestionnaireNodeData,
    steps: VariationStep[],
    startTime: number
  ): Promise<void> {
    await this.waitForNode(sessionId, nodeId, startTime, this.getNodeWaitMs(nodeData));
    await this.freezeSessionTimers(sessionId, "questionnaire_entered");

    const shouldPauseTimers = Boolean(nodeData.timeout) && !this.freezeTimers;
    let pausedCount = 0;

    if (shouldPauseTimers) {
      try {
        pausedCount = await this.pauseSessionTimers(sessionId);
      } catch (error) {
        this.logger.warn(
          { err: serializeError(error), sessionId, nodeId },
          "telegramParity:questionnaire:pauseTimersFailed"
        );
      }
    }

    try {
      for (const question of nodeData.questions) {
        const session = await this.fetchSession(sessionId);
        if (session.currentNodeId !== nodeId) {
          return;
        }

        const hasButtons = Array.isArray(question.buttons) && question.buttons.length > 0;
        const useButtons = question.responseType !== "text" && hasButtons;
        const priorCount = session.interactions.length;

        if (useButtons) {
          const buttonId = question.buttons![0].id;
          steps.push({
            nodeId,
            action: "click",
            details: `Question ${question.id} -> ${buttonId}`,
            timestamp: Date.now(),
          });
          await this.sendButtonUpdate(profile, buttonId);
        } else {
          const text = "test";
          steps.push({
            nodeId,
            action: "text",
            details: `Question ${question.id} -> "${text}"`,
            timestamp: Date.now(),
          });
          await this.sendTextUpdate(profile, text);
        }

        await this.waitForInteractionGrowth(sessionId, startTime, priorCount);
      }
    } finally {
      if (pausedCount > 0) {
        try {
          await this.resumeSessionTimers(sessionId);
        } catch (error) {
          this.logger.warn(
            { err: serializeError(error), sessionId, nodeId },
            "telegramParity:questionnaire:resumeTimersFailed"
          );
        }
      }
    }
  }

  private evaluatePath(
    variation: TestVariation,
    visitedNodes: string[]
  ): { success: boolean; error?: string; alternatePath?: AlternatePathInfo } {
    const unexpectedNode = visitedNodes.find((nodeId) => !variation.path.includes(nodeId));
    if (!unexpectedNode) {
      return { success: true };
    }

    if (!this.alternatePathDetector) {
      return {
        success: false,
        error: `Path diverged at "${unexpectedNode}" (alternate path detector not initialized)`,
      };
    }

    const divergenceIndex = visitedNodes.indexOf(unexpectedNode);
    const divergenceNodeId =
      divergenceIndex > 0 ? visitedNodes[divergenceIndex - 1] : variation.path[0];
    const expectedIndex = variation.path.indexOf(divergenceNodeId);
    const expectedNextNode = expectedIndex >= 0 ? variation.path[expectedIndex + 1] : undefined;

    const input = variation.inputs.find((candidate) => candidate.nodeId === divergenceNodeId) ||
      variation.inputs[0] || {
        nodeId: divergenceNodeId,
        inputType: "auto",
      };

    if (expectedNextNode) {
      const result = this.alternatePathDetector.checkDivergence(
        divergenceNodeId,
        expectedNextNode,
        unexpectedNode,
        input
      );
      if (result.isValid) {
        return { success: true, alternatePath: result.info };
      }
    }

    return {
      success: false,
      error: `Path diverged: visited "${unexpectedNode}" after "${divergenceNodeId}", expected path [${variation.path.join(" -> ")}]`,
    };
  }

  private buildJourneyName(): string {
    if (this.journey && (this.journey as { name?: string }).name) {
      return (this.journey as { name?: string }).name as string;
    }
    if (this.journeyPath) {
      return path.basename(this.journeyPath, path.extname(this.journeyPath));
    }
    return "Blade Runner Parity Journey";
  }

  private buildUserProfile(variationId: string): UserProfile {
    const hash = this.hashString(`${this.runId}:${variationId}`);
    const suffix = hash.toString(36).slice(0, 6);
    const prefix = this.runId.slice(0, 8);
    const userId = 100000 + (hash % 900000000);

    return {
      userId,
      chatId: userId,
      firstName: `BR-${prefix}-${suffix}`,
      username: `br_${prefix}_${suffix}`,
    };
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private parseParityMs(envKey: string, fallback: number): number {
    const raw = process.env[envKey];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  private parseParityBool(envKey: string, fallback: boolean): boolean {
    const raw = process.env[envKey];
    if (!raw) return fallback;
    return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
  }

  private getRemainingTimeout(startTime: number): number {
    const total = this.runnerOptions?.timeout ?? 120000;
    const elapsed = Date.now() - startTime;
    return Math.max(0, total - elapsed);
  }

  private scaleParityDuration(ms: number, minMs: number): number {
    if (!Number.isFinite(ms) || ms <= 0) {
      return minMs;
    }
    const scaled = Math.round(ms * this.getTimeScale());
    return Math.max(minMs, scaled);
  }

  private getParityWaitMs(): number {
    return this.scaleParityDuration(this.parityWaitMs, 100);
  }

  private getParityPollMs(): number {
    return this.scaleParityDuration(this.parityPollMs, 10);
  }

  private getAgentWaitMs(): number {
    return this.scaleParityDuration(2000, 200);
  }

  private getDelayBufferMs(): number {
    return this.scaleParityDuration(250, 50);
  }

  private getTimerStepWaitMs(): number {
    const base = Math.max(this.parityWaitMs * 8, 15000);
    const minMs = this.scaleParityDuration(1000, 100);
    return this.scaleParityDuration(base, minMs);
  }

  private getTimeScale(): number {
    const scale = this.runnerOptions?.timeScale ?? 1;
    if (!Number.isFinite(scale) || scale <= 0) {
      return 1;
    }
    return scale;
  }

  private parsePluginStepIndex(edgeId: string): number | null {
    const parts = edgeId.split(":");
    const stepRaw = parts[parts.length - 1];
    const parsed = Number(stepRaw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async apiRequest<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    if (!this.apiBaseUrl) {
      throw new Error("API base URL not initialized");
    }

    const url = new URL(path, this.apiBaseUrl).toString();
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Mock-User-Id": this.mockUserId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : ({} as T);

    if (!response.ok) {
      throw new Error(`API ${method} ${path} failed (${response.status}): ${text}`);
    }

    return data;
  }

  private async apiRequestMaybe<T>(method: string, path: string): Promise<T | null> {
    if (!this.apiBaseUrl) {
      throw new Error("API base URL not initialized");
    }

    const url = new URL(path, this.apiBaseUrl).toString();
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Mock-User-Id": this.mockUserId,
      },
    });

    if (response.status === 404) {
      return null;
    }

    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : ({} as T);

    if (!response.ok) {
      throw new Error(`API ${method} ${path} failed (${response.status}): ${text}`);
    }

    return data;
  }

  private async sleep(ms: number): Promise<void> {
    const delayMs = this.scaleParityDuration(ms, 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private createResult(
    variation: TestVariation,
    success: boolean,
    error: string | undefined,
    alternatePath: AlternatePathInfo | undefined,
    visitedNodes: string[],
    messagesSent: string[],
    steps: VariationStep[],
    durationMs: number,
    finalStatus: string,
    stack?: string
  ): VariationResult {
    return {
      variation,
      success,
      status: alternatePath ? "alternate_path" : success ? "passed" : "failed",
      alternatePath,
      error,
      stack,
      visitedNodes,
      messagesSent,
      steps,
      durationMs,
      finalStatus,
    };
  }

  private createFailureResult(
    variation: TestVariation,
    error: string,
    stack?: string,
    startTime?: number
  ): VariationResult {
    return this.createResult(
      variation,
      false,
      error,
      undefined,
      [],
      [],
      [],
      startTime ? Date.now() - startTime : 0,
      "failed",
      stack
    );
  }

  private createSkippedResult(variation: TestVariation, reason: string): VariationResult {
    return {
      variation,
      success: false,
      status: "skipped",
      error: reason,
      visitedNodes: [],
      messagesSent: [],
      steps: [],
      durationMs: 0,
      finalStatus: "skipped",
    };
  }
}
