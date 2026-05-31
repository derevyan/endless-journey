/**
 * Node Generators for Fuzzy Testing
 *
 * Generates random nodes of each type for journey fuzzy testing.
 *
 * @module engine/tests/generators/node-generators
 */

import type {
  ButtonConfig,
  ConditionBranch,
  ConditionNodeData,
  CrmNodeData,
  EndNodeData,
  JourneyEdgeData,
  JourneyNodeData,
  Media,
  MessageNodeData,
  NodeMetadata,
  NodeType,
  ResponseType,
  StartNodeData,
  TagAction,
  TeleportNodeData,
  VariableAction,
  WaitNodeData,
  WebhookNodeData,
} from "@journey/schemas";

// =============================================================================
// RANDOM UTILITIES
// =============================================================================

/** Seeded random number generator for reproducibility */
export class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  /** Get current seed */
  getSeed(): number {
    return this.seed;
  }

  /** Generate random number between 0 and 1 */
  random(): number {
    // LCG parameters from Numerical Recipes
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** Random integer between min and max (inclusive) */
  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Random float between min and max */
  float(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /** Random boolean with given probability of true */
  bool(probability = 0.5): boolean {
    return this.random() < probability;
  }

  /** Pick random element from array */
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  /** Pick N random elements from array */
  pickN<T>(array: T[], n: number): T[] {
    const shuffled = [...array].sort(() => this.random() - 0.5);
    return shuffled.slice(0, Math.min(n, array.length));
  }

  /** Shuffle array in place */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** Generate random string */
  string(length: number, charset = "abcdefghijklmnopqrstuvwxyz"): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += charset[this.int(0, charset.length - 1)];
    }
    return result;
  }

  /** Generate random UUID-like string */
  uuid(): string {
    const hex = "0123456789abcdef";
    let uuid = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += "-";
      } else if (i === 14) {
        uuid += "4";
      } else if (i === 19) {
        uuid += hex[this.int(8, 11)];
      } else {
        uuid += hex[this.int(0, 15)];
      }
    }
    return uuid;
  }
}

// Default random instance
let defaultRandom = new SeededRandom();

/** Set global seed for reproducibility */
export function setGeneratorSeed(seed: number): void {
  defaultRandom = new SeededRandom(seed);
}

/** Get current global random instance */
export function getRandom(): SeededRandom {
  return defaultRandom;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Create node metadata */
export function createMetadata(): NodeMetadata {
  return {
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    version: "1.0.0",
    status: "active",
  };
}

/** Generate unique node ID */
export function generateNodeId(prefix = "node", rng = defaultRandom): string {
  return `${prefix}-${rng.string(8)}`;
}

/** Generate unique edge ID */
export function generateEdgeId(rng = defaultRandom): string {
  return `edge-${rng.string(8)}`;
}

/** Random position for node */
export function randomPosition(rng = defaultRandom): { x: number; y: number } {
  return {
    x: rng.int(0, 1000),
    y: rng.int(0, 1000),
  };
}

// =============================================================================
// CONTENT GENERATORS
// =============================================================================

const SAMPLE_MESSAGES = [
  "Welcome to the journey!",
  "Please select an option:",
  "Thank you for your response.",
  "Processing your request...",
  "Here's your information:",
  "Would you like to continue?",
  "Almost done!",
  "One moment please...",
  "Great choice!",
  "Let me help you with that.",
];

/** Template patterns for realistic variable interpolation */
const TEMPLATE_PATTERNS = [
  "Hello {{user.name}}!",
  "Your response: {{userResponse}}",
  "Status: {{nodes.Webhook.status}}",
  "Score: {{score}} points",
  "Welcome back, {{user.name}}!",
  "Your selection: {{userChoice}}",
  "Profile ID: {{nodes.Create_Profile.profileId}}",
  "Order #{{orderNumber}} confirmed",
  "Thanks {{user.name}}, we received your {{answer}}",
  "Step {{step}} of {{totalSteps}}",
];

/** Emojis for realistic content */
const EMOJIS = ["👋", "✅", "⚠️", "🎉", "📝", "🔔", "💡", "🚀", "❤️", "⏳", "🔄", "📊"];

/** Messages with emojis for realistic content */
const EMOJI_MESSAGES = [
  "👋 Welcome to the journey!",
  "✅ Your request has been processed!",
  "⚠️ Please check your input.",
  "🎉 Congratulations! You've completed the task!",
  "📝 Please fill in the form below.",
  "🔔 You have a new notification!",
  "💡 Here's a tip for you.",
  "🚀 Let's get started!",
  "❤️ Thanks for being with us!",
  "⏳ Please wait a moment...",
];

const SAMPLE_BUTTONS = ["Yes", "No", "Continue", "Back", "Option A", "Option B", "Option C", "Skip", "Submit", "Cancel", "Learn More", "Get Started"];

/** Context-specific button labels for realistic journeys */
const CONTEXT_BUTTONS = [
  "Developer",
  "Designer",
  "Product Manager",
  "Try Again",
  "Skip for Now",
  "Contact Support",
  "View Details",
  "Confirm",
  "Upgrade Now",
  "Remind Later",
];

const SAMPLE_LABELS = ["Welcome", "Question", "Info", "Decision", "Response", "Wait", "Check", "Result", "End", "API Call"];

/** Tag names for realistic tag operations */
const TAG_NAMES = ["active", "premium", "completed", "pending", "new_user", "engaged", "onboarding_started", "onboarding_completed", "needs_followup", "vip"];

/** Variable keys for realistic variable operations */
const VARIABLE_KEYS = ["step", "score", "attempt_count", "last_action", "user_tier", "onboarding_step", "completed_at", "preferences"];

/** Response storage variable names */
const RESPONSE_VARS = ["userResponse", "userChoice", "answer", "selection", "feedback", "user_input", "selected_option"];

/** Webhook storage variable names */
const WEBHOOK_STORE_VARS = ["apiResult", "profile", "userData", "response", "result"];

/** JSON paths for webhook response extraction */
const JSON_PATHS = ["$.data", "$.result", "$.response", "$.body", "$.payload"];

/** Generate random message content */
export function randomContent(rng = defaultRandom): string {
  return rng.pick(SAMPLE_MESSAGES);
}

/**
 * Generate realistic content with optional template variables and emojis
 * @param options - Configuration for content generation
 * @param rng - Random number generator
 */
export function generateRealisticContent(
  options: {
    includeTemplate?: boolean;
    includeEmoji?: boolean;
  } = {},
  rng = defaultRandom
): string {
  const includeTemplate = options.includeTemplate ?? rng.bool(0.3);
  const includeEmoji = options.includeEmoji ?? rng.bool(0.4);

  if (includeEmoji && includeTemplate) {
    // Emoji + template
    return `${rng.pick(EMOJIS)} ${rng.pick(TEMPLATE_PATTERNS)}`;
  } else if (includeEmoji) {
    // Emoji message
    return rng.pick(EMOJI_MESSAGES);
  } else if (includeTemplate) {
    // Template only
    return rng.pick(TEMPLATE_PATTERNS);
  }
  // Plain message
  return rng.pick(SAMPLE_MESSAGES);
}

/** Generate random button labels */
/** Helper to create a ButtonConfig object */
function createButton(text: string, id?: string, targetNodeId?: string): ButtonConfig {
  return {
    id: id ?? `btn-${text.toLowerCase().replace(/\s+/g, "-")}`,
    text,
    targetNodeId,
  };
}

export function randomButtons(count: number, rng = defaultRandom): ButtonConfig[] {
  return rng.pickN(SAMPLE_BUTTONS, count).map((text) => createButton(text));
}

/**
 * Generate realistic button labels (context-aware)
 * @param count - Number of buttons
 * @param useContextButtons - Whether to use context-specific buttons
 * @param rng - Random number generator
 */
export function generateRealisticButtons(count: number, useContextButtons = false, rng = defaultRandom): ButtonConfig[] {
  const source = useContextButtons ? CONTEXT_BUTTONS : SAMPLE_BUTTONS;
  return rng.pickN(source, count).map((text) => createButton(text));
}

/** Generate random label */
export function randomLabel(prefix = "", rng = defaultRandom): string {
  const base = rng.pick(SAMPLE_LABELS);
  return prefix ? `${prefix} ${base}` : base;
}

// =============================================================================
// ACTION GENERATORS (Tags, Variables, Media)
// =============================================================================

/**
 * Generate a tag action for node execution
 * @param probability - Probability of generating a tag action (0-1)
 * @param rng - Random number generator
 */
export function generateTagAction(probability = 0.25, rng = defaultRandom): TagAction | undefined {
  if (!rng.bool(probability)) return undefined;

  const addTags = rng.bool(0.7) ? rng.pickN(TAG_NAMES, rng.int(1, 2)) : undefined;
  const removeTags = rng.bool(0.3) ? rng.pickN(TAG_NAMES, 1) : undefined;

  // Don't return empty action
  if (!addTags && !removeTags) return undefined;

  return {
    tags: {
      add: addTags,
      remove: removeTags,
    },
  };
}

/**
 * Generate a variable action for node execution
 * @param probability - Probability of generating a variable action (0-1)
 * @param rng - Random number generator
 */
export function generateVariableAction(probability = 0.2, rng = defaultRandom): VariableAction | undefined {
  if (!rng.bool(probability)) return undefined;

  const op = rng.pick(["set", "increment"] as const);
  const key = rng.pick(VARIABLE_KEYS);

  if (op === "set") {
    const value = rng.pick(["completed", "in_progress", "pending", new Date().toISOString(), rng.int(1, 100)]);
    return {
      journeyOperations: [{ op: "set", key, value }],
    };
  } else {
    return {
      journeyOperations: [{ op: "increment", key, amount: rng.int(1, 5) }],
    };
  }
}

/**
 * Generate a media attachment
 * @param probability - Probability of generating media (0-1)
 * @param rng - Random number generator
 */
export function generateMedia(probability = 0.15, rng = defaultRandom): Media | undefined {
  if (!rng.bool(probability)) return undefined;

  const type = rng.pick(["image", "video"] as const);
  const extension = type === "image" ? rng.pick(["png", "jpg", "webp"]) : "mp4";

  return {
    type,
    url: `https://example.com/media/${rng.string(8)}.${extension}`,
  };
}

// =============================================================================
// NODE GENERATORS
// =============================================================================

/** Options for start node generation */
export interface StartNodeOptions {
  /** Include realistic content with templates/emojis */
  realistic?: boolean;
  /** Include media attachment */
  includeMedia?: boolean;
  /** Include tag action */
  includeTagAction?: boolean;
  /** Include variable action */
  includeVariableAction?: boolean;
}

/** Generate a start node */
export function generateStartNode(id?: string, options: StartNodeOptions = {}, rng = defaultRandom): JourneyNodeData {
  const nodeId = id ?? generateNodeId("start", rng);
  const realistic = options.realistic ?? rng.bool(0.5);

  const data: StartNodeData = {
    type: "start",
    schemaVersion: 1,
    label: "Start",
    content: realistic ? generateRealisticContent({}, rng) : randomContent(rng),
  };

  // Add media (~15% by default)
  const media = options.includeMedia !== false ? generateMedia(0.15, rng) : undefined;
  if (media) data.media = media;

  // Add tag action (~25% by default)
  const tagAction = options.includeTagAction !== false ? generateTagAction(0.25, rng) : undefined;
  if (tagAction) data.tagAction = tagAction;

  // Add variable action (~20% by default)
  const variableAction = options.includeVariableAction !== false ? generateVariableAction(0.2, rng) : undefined;
  if (variableAction) data.variableAction = variableAction;

  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data,
    metadata: createMetadata(),
  };
}

/** Options for end node generation */
export interface EndNodeOptions {
  /** Include realistic content with templates/emojis */
  realistic?: boolean;
  /** Include tag action */
  includeTagAction?: boolean;
  /** Include variable action */
  includeVariableAction?: boolean;
}

/** Generate an end node */
export function generateEndNode(id?: string, options: EndNodeOptions = {}, rng = defaultRandom): JourneyNodeData {
  const nodeId = id ?? generateNodeId("end", rng);
  const realistic = options.realistic ?? rng.bool(0.5);

  // End messages with emojis
  const endMessages = realistic
    ? ["🎉 Journey completed!", "✅ All done! Thank you!", "👋 Goodbye! See you next time!", "🚀 You've reached the end!"]
    : ["Journey completed!", "Done!", "Thank you!", "Goodbye!"];

  const data: EndNodeData = {
    type: "end",
    schemaVersion: 1,
    label: "End",
    content: rng.pick(endMessages),
  };

  // Add tag action (~30% by default - often want to mark completion)
  const tagAction = options.includeTagAction !== false ? generateTagAction(0.3, rng) : undefined;
  if (tagAction) data.tagAction = tagAction;

  // Add variable action (~25% by default - often want to set completion timestamp)
  const variableAction = options.includeVariableAction !== false ? generateVariableAction(0.25, rng) : undefined;
  if (variableAction) data.variableAction = variableAction;

  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data,
    metadata: createMetadata(),
  };
}

/** Options for message node generation */
export interface MessageNodeOptions {
  includeButtons?: boolean;
  buttonCount?: number;
  includeTimer?: boolean;
  timerSeconds?: number;
  responseType?: ResponseType;
  /** Include realistic content with templates/emojis */
  realistic?: boolean;
  /** Use context-specific button labels */
  useContextButtons?: boolean;
  /** Include storeResponseAs */
  includeStoreResponse?: boolean;
  /** Include media attachment */
  includeMedia?: boolean;
  /** Include tag action */
  includeTagAction?: boolean;
}

/** Generate a message node */
export function generateMessageNode(id?: string, options: MessageNodeOptions = {}, rng = defaultRandom): JourneyNodeData {
  const nodeId = id ?? generateNodeId("msg", rng);
  const includeButtons = options.includeButtons ?? rng.bool(0.5);
  const buttonCount = options.buttonCount ?? (includeButtons ? rng.int(2, 4) : 0);
  const includeTimer = options.includeTimer ?? rng.bool(0.2);
  const realistic = options.realistic ?? rng.bool(0.5);
  const useContextButtons = options.useContextButtons ?? rng.bool(0.3);

  const data: MessageNodeData = {
    type: "message",
    schemaVersion: 2,
    contentFormat: "text",
    label: randomLabel("", rng),
    content: realistic ? generateRealisticContent({}, rng) : randomContent(rng),
  };

  if (buttonCount > 0) {
    data.buttons = useContextButtons ? generateRealisticButtons(buttonCount, true, rng) : randomButtons(buttonCount, rng);
  }

  if (options.responseType) {
    data.responseType = options.responseType;
  } else if (buttonCount > 0) {
    data.responseType = rng.pick(["buttons", "any"] as ResponseType[]);
  } else if (rng.bool(0.3)) {
    data.responseType = "text";
  } else {
    data.responseType = "auto";
  }

  // Add storeResponseAs for non-auto responses (~30% by default)
  if (data.responseType !== "auto") {
    const includeStore = options.includeStoreResponse ?? rng.bool(0.3);
    if (includeStore) {
      data.storeResponseAs = rng.pick(RESPONSE_VARS);
    }
  }

  if (includeTimer) {
    data.timer = { seconds: options.timerSeconds ?? rng.int(1, 60) };
  }

  // Add media (~15% by default)
  const media = options.includeMedia !== false ? generateMedia(0.15, rng) : undefined;
  if (media) data.media = media;

  // Add tag action (~20% by default)
  const tagAction = options.includeTagAction !== false ? generateTagAction(0.2, rng) : undefined;
  if (tagAction) data.tagAction = tagAction;

  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data,
    metadata: createMetadata(),
  };
}

/** Options for condition node generation */
export interface ConditionNodeOptions {
  branchCount?: number;
  includeDefault?: boolean;
  useExpression?: boolean;
}

/** Generate a condition node */
export function generateConditionNode(id?: string, options: ConditionNodeOptions = {}, rng = defaultRandom): JourneyNodeData {
  const nodeId = id ?? generateNodeId("condition", rng);
  const branchCount = options.branchCount ?? rng.int(2, 4);
  const includeDefault = options.includeDefault ?? rng.bool(0.8);

  const branches: ConditionBranch[] = [];
  for (let i = 0; i < branchCount; i++) {
    const isLast = i === branchCount - 1;
    branches.push({
      id: `branch-${i}`,
      label: `Branch ${i + 1}`,
      isDefault: includeDefault && isLast ? true : undefined,
    });
  }

  const data: ConditionNodeData = {
    type: "condition",
    schemaVersion: 1,
    label: randomLabel("Check", rng),
    rulesOperator: rng.pick(["and", "or"]),
    branches,
  };

  // Add expression or rules
  if (options.useExpression ?? rng.bool(0.5)) {
    data.expression = rng.pick(["score > 50", "userResponse === 'yes'", "context.count >= 3", "tags.includes('premium')"]);
  } else {
    data.rules = [
      {
        field: rng.pick(["score", "tier", "userResponse", "status"]),
        operator: rng.pick(["equals", "notEquals", "greaterThan", "contains"]),
        value: rng.pick(["premium", "yes", "active", 50, 100]),
      },
    ];
  }

  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data,
    metadata: createMetadata(),
  };
}

/** Generate a wait node */
export function generateWaitNode(id?: string, durationSeconds?: number, rng = defaultRandom): JourneyNodeData {
  const nodeId = id ?? generateNodeId("wait", rng);
  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data: {
      type: "wait",
      schemaVersion: 1,
      label: "Wait",
      duration: { seconds: durationSeconds ?? rng.int(1, 300) },
    } as WaitNodeData,
    metadata: createMetadata(),
  };
}

/** Options for webhook node generation */
export interface WebhookNodeOptions {
  /** Use mock response */
  useMock?: boolean;
  /** Include authentication */
  includeAuth?: boolean;
  /** Include storeAs */
  includeStoreAs?: boolean;
  /** Include successPath */
  includeSuccessPath?: boolean;
  /** Include template variables in body */
  includeTemplateBody?: boolean;
}

/** Generate a webhook node */
export function generateWebhookNode(
  id?: string,
  options: WebhookNodeOptions = {},
  rng = defaultRandom
): JourneyNodeData {
  const nodeId = id ?? generateNodeId("webhook", rng);

  const useMock = options.useMock ?? true;

  const method = rng.pick(["GET", "POST", "PUT", "PATCH"] as const);

  const data: WebhookNodeData = {
    type: "webhook",
    schemaVersion: 1,
    label: randomLabel("API", rng),
    url: `https://api.example.com/${rng.string(8)}`,
    method,
    errorHandling: rng.pick(["continue", "retry", "fail"]),
    retryCount: rng.int(0, 3),
    timeoutMs: rng.int(1000, 10000),
  };

  // Add storeAs (~60% by default)
  const includeStoreAs = options.includeStoreAs ?? rng.bool(0.6);
  if (includeStoreAs) {
    data.storeAs = rng.pick(WEBHOOK_STORE_VARS);
  }

  // Add successPath (~50% by default)
  const includeSuccessPath = options.includeSuccessPath ?? rng.bool(0.5);
  if (includeSuccessPath) {
    data.successPath = rng.pick(JSON_PATHS);
  }

  // Add authentication (~40% by default)
  const includeAuth = options.includeAuth ?? rng.bool(0.4);
  if (includeAuth) {
    data.auth = {
      type: "bearer",
      token: `token-${rng.string(12)}`,
    };
  }

  // Add template body for POST/PUT/PATCH (~50% by default)
  if (method !== "GET") {
    const includeTemplateBody = options.includeTemplateBody ?? rng.bool(0.5);
    if (includeTemplateBody) {
      data.body = JSON.stringify({
        userId: "{{user.id}}",
        data: "{{userResponse}}",
        timestamp: "{{= new Date().toISOString() }}",
      });
      data.headers = {
        "Content-Type": "application/json",
      };
    }
  }

  if (useMock) {
    data.mockResponse = {
      enabled: true,
      statusCode: rng.pick([200, 200, 200, 400, 500]), // Mostly success
      body: {
        success: true,
        data: {
          id: rng.string(8),
          status: "created",
          profileId: `profile-${rng.string(6)}`,
        },
      },
      delay: rng.int(0, 100),
    };
  }

  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data,
    metadata: createMetadata(),
  };
}

// =============================================================================
// CRM NODE GENERATOR
// =============================================================================

/** Options for CRM node generation */
export interface CrmNodeOptions {
  /** Include pipeline ID */
  includePipelineId?: boolean;
  /** Include stage ID */
  includeStageId?: boolean;
  /** Include notes */
  includeNotes?: boolean;
}

/** Generate a CRM node */
export function generateCrmNode(id?: string, options: CrmNodeOptions = {}, rng = defaultRandom): JourneyNodeData {
  const nodeId = id ?? generateNodeId("crm", rng);

  const data: CrmNodeData = {
    type: "crm",
    schemaVersion: 1,
    label: "CRM Update",
  };

  // Add pipeline ID (~60% by default)
  const includePipelineId = options.includePipelineId ?? rng.bool(0.6);
  if (includePipelineId) {
    data.pipelineId = `pipeline-${rng.string(6)}`;
  }

  // Add stage ID (~70% by default)
  const includeStageId = options.includeStageId ?? rng.bool(0.7);
  if (includeStageId) {
    data.stageId = `stage-${rng.string(6)}`;
  }

  // Add notes (~30% by default)
  const includeNotes = options.includeNotes ?? rng.bool(0.3);
  if (includeNotes) {
    data.notes = rng.pick([
      "Moved to next stage via automation",
      "User completed onboarding",
      "Upgrade path initiated",
      "Added from journey: {{journey.name}}",
    ]);
  }

  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data,
    metadata: createMetadata(),
  };
}

// =============================================================================
// TELEPORT NODE GENERATOR
// =============================================================================

/** Options for Teleport node generation */
export interface TeleportNodeOptions {
  /** Target journey ID */
  targetJourneyId?: string;
  /** Target node ID */
  targetNodeId?: string;
  /** Preserve context when teleporting */
  preserveContext?: boolean;
}

/** Generate a Teleport node */
export function generateTeleportNode(id?: string, options: TeleportNodeOptions = {}, rng = defaultRandom): JourneyNodeData {
  const nodeId = id ?? generateNodeId("teleport", rng);

  const data: TeleportNodeData = {
    type: "teleport",
    schemaVersion: 1,
    label: "Teleport",
    targetJourneyId: options.targetJourneyId ?? `journey-${rng.string(8)}`,
    preserveContext: options.preserveContext ?? rng.bool(0.7),
  };

  // Add target node ID (~30% by default, otherwise starts from start)
  if (options.targetNodeId || rng.bool(0.3)) {
    data.targetNodeId = options.targetNodeId ?? `node-${rng.string(6)}`;
  }

  return {
    id: nodeId,
    type: "custom",
    position: randomPosition(rng),
    data,
    metadata: createMetadata(),
  };
}

// =============================================================================
// EDGE GENERATOR
// =============================================================================

/** Options for edge generation */
export interface EdgeOptions {
  sourceHandle?: string;
  label?: string;
  edgeType?: "default" | "success" | "retry" | "timer" | "dropoff" | "exit";
}

/** Generate an edge between two nodes */
export function generateEdge(sourceId: string, targetId: string, options: EdgeOptions = {}, rng = defaultRandom): JourneyEdgeData {
  return {
    id: generateEdgeId(rng),
    source: sourceId,
    target: targetId,
    sourceHandle: options.sourceHandle,
    label: options.label ?? "Transition",
    edgeType: options.edgeType ?? "default",
  };
}

// =============================================================================
// RANDOM NODE BY TYPE
// =============================================================================

const NODE_TYPE_WEIGHTS: Record<NodeType, number> = {
  start: 0, // Start is special, handled separately
  message: 50, // Most common
  condition: 15,
  wait: 10,
  webhook: 10,
  crm: 5,
  teleport: 5,
  questionnaire: 5,
  agent: 5, // AI Agent - specialized use
  end: 0, // End is special, handled separately
};

/** Generate a random node (not start or end) */
export function generateRandomNode(excludeTypes: NodeType[] = ["start", "end"], rng = defaultRandom): JourneyNodeData {
  // Build weighted selection
  const types: NodeType[] = [];
  for (const [type, weight] of Object.entries(NODE_TYPE_WEIGHTS)) {
    if (!excludeTypes.includes(type as NodeType)) {
      for (let i = 0; i < weight; i++) {
        types.push(type as NodeType);
      }
    }
  }

  if (types.length === 0) {
    // Fallback to message
    return generateMessageNode(undefined, {}, rng);
  }

  const selectedType = rng.pick(types);

  switch (selectedType) {
    case "message":
      return generateMessageNode(undefined, {}, rng);
    case "condition":
      return generateConditionNode(undefined, {}, rng);
    case "wait":
      return generateWaitNode(undefined, undefined, rng);
    case "webhook":
      return generateWebhookNode(undefined, { useMock: true }, rng);
    case "crm":
      return generateCrmNode(undefined, {}, rng);
    case "teleport":
      return generateTeleportNode(undefined, {}, rng);
    case "questionnaire":
    case "agent":
      // Fallback to message (generators not yet implemented)
      return generateMessageNode(undefined, {}, rng);
    default:
      return generateMessageNode(undefined, {}, rng);
  }
}
