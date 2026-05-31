/**
 * System Tools Registration
 *
 * Registers all system (context-aware) tool factories with the unified registry.
 * System tools require execution context (services, session) to function.
 *
 * Categories:
 * - memory: save_memory, recall_memories
 * - variables: read_journey_variable, read_user_variable, read_mindstate_parameter
 * - context: get_user_profile, get_journey_context
 * - messaging: send_message
 * - journey: exit_to_next_node (journey routing)
 *
 * @module tools/unified/register-system
 */

import { createLogger } from "@journey/logger";

// Registry
import { unifiedToolRegistry } from "./registry";
import { SYSTEM_TOOL_NAMES } from "./tool-names";

// Tool factories
import {
  createRecallMemoriesTool,
  createSaveMemoryTool,
} from "../builtin/memory-tools";

import {
  createJourneyVariableTool,
  createMindstateParameterTool,
  createUserVariableTool,
  createWriteJourneyVariableTool,
  createWriteUserVariableTool,
} from "../builtin/variable-tools";

import {
  createAddUserTagsTool,
  createGetUserTagsTool,
  createRemoveUserTagsTool,
} from "../builtin/tag-tools";

import {
  createGetPipelinePositionTool,
  createMoveToPipelineStageTool,
} from "../builtin/pipeline-tools";

import {
  createJourneyContextTool,
  createUserProfileTool,
} from "../builtin/context-tools";

import {
  createExitToNextNodeTool,
  createSendMessageTool,
} from "../builtin/messaging-tools";

const log = createLogger("llm:tools:unified");

// ============================================================================
// IDEMPOTENT REGISTRATION GUARD
// ============================================================================

let systemToolsRegistered = false;

/**
 * Register all system tools with the unified registry
 *
 * This function is idempotent - calling it multiple times has no effect
 * after the first call. This prevents duplicate registration when modules
 * are imported multiple times (common in test environments).
 */
export function registerSystemTools(): void {
  if (systemToolsRegistered) {
    log.debug({}, "tools:unified:systemToolsAlreadyRegistered");
    return;
  }
  systemToolsRegistered = true;

  // ==========================================================================
  // MEMORY TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createSaveMemoryTool, {
    name: SYSTEM_TOOL_NAMES.SAVE_MEMORY,
    displayName: "Save Memory",
    description: "Save a fact about the user to remember in future conversations",
    category: "memory",
    requiredServices: ["memory"],
    usageExample: "If user shares a personal fact like 'My name is John', use tool 'save_memory' to remember it",
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
  });

  unifiedToolRegistry.registerSystem(createRecallMemoriesTool, {
    name: SYSTEM_TOOL_NAMES.RECALL_MEMORIES,
    displayName: "Recall Memories",
    description: "Search memories about this user using semantic similarity",
    category: "memory",
    requiredServices: ["memory"],
    usageExample: "If user asks 'What do you know about me?', use tool 'recall_memories' to retrieve relevant details",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs search results to respond",
    },
  });

  // ==========================================================================
  // VARIABLE TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createJourneyVariableTool, {
    name: SYSTEM_TOOL_NAMES.READ_JOURNEY_VARIABLE,
    displayName: "Read Journey Variable",
    description: "Read a journey-scoped variable specific to this journey execution",
    category: "variables",
    requiredServices: ["variable"],
    usageExample: "If you need to know what the user selected in a previous step, use tool 'read_journey_variable' to retrieve it",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs variable value to use in response",
    },
  });

  unifiedToolRegistry.registerSystem(createUserVariableTool, {
    name: SYSTEM_TOOL_NAMES.READ_USER_VARIABLE,
    displayName: "Read User Variable",
    description: "Read a user profile variable that persists across interactions",
    category: "variables",
    requiredServices: ["variable"],
    usageExample: "If you need to access user profile data like email, use tool 'read_user_variable' to retrieve it",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs variable value to use in response",
    },
  });

  unifiedToolRegistry.registerSystem(createMindstateParameterTool, {
    name: SYSTEM_TOOL_NAMES.READ_MINDSTATE_PARAMETER,
    displayName: "Read Mindstate Parameter",
    description: "Read a parameter from a mindstate flow tracking user progress",
    category: "variables",
    requiredServices: ["variable", "mindstate"],
    usageExample: "If you need to check the user's progress flow, use tool 'read_mindstate_parameter' to retrieve it",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs parameter value to use in response",
    },
  });

  unifiedToolRegistry.registerSystem(createWriteJourneyVariableTool, {
    name: SYSTEM_TOOL_NAMES.WRITE_JOURNEY_VARIABLE,
    displayName: "Write Journey Variable",
    description: "Write a journey-scoped variable specific to this journey execution",
    category: "variables",
    requiredServices: ["variable"],
    usageExample: "If you need to save a temporary value for this session, use tool 'write_journey_variable' to store it",
    timingConfig: {
      timing: "immediate",
      configurable: true,
    },
  });

  unifiedToolRegistry.registerSystem(createWriteUserVariableTool, {
    name: SYSTEM_TOOL_NAMES.WRITE_USER_VARIABLE,
    displayName: "Write User Variable",
    description: "Write a user profile variable that persists across interactions",
    category: "variables",
    requiredServices: ["variable"],
    usageExample: "If user updates their profile info like language, use tool 'write_user_variable' to save it",
    timingConfig: {
      timing: "immediate",
      configurable: true,
    },
  });

  // ==========================================================================
  // TAG TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createAddUserTagsTool, {
    name: SYSTEM_TOOL_NAMES.ADD_USER_TAGS,
    displayName: "Add User Tags",
    description: "Add tags to the current user for segmentation",
    category: "tags",
    requiredServices: ["tag"],
    usageExample: "If user shows interest in a specific topic, use tool 'add_user_tags' to segment them",
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
  });

  unifiedToolRegistry.registerSystem(createRemoveUserTagsTool, {
    name: SYSTEM_TOOL_NAMES.REMOVE_USER_TAGS,
    displayName: "Remove User Tags",
    description: "Remove tags from the current user",
    category: "tags",
    requiredServices: ["tag"],
    usageExample: "If user is no longer interested in a topic, use tool 'remove_user_tags' to remove the tag",
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
  });

  unifiedToolRegistry.registerSystem(createGetUserTagsTool, {
    name: SYSTEM_TOOL_NAMES.GET_USER_TAGS,
    displayName: "Get User Tags",
    description: "Get all tags assigned to the current user",
    category: "tags",
    requiredServices: ["tag"],
    usageExample: "If you need to check the user's segments, use tool 'get_user_tags' to list their tags",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs tag list to respond",
    },
  });

  // ==========================================================================
  // PIPELINE/CRM TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createMoveToPipelineStageTool, {
    name: SYSTEM_TOOL_NAMES.MOVE_TO_PIPELINE_STAGE,
    displayName: "Move to Pipeline Stage",
    description: "Move user to a specific CRM pipeline and stage",
    category: "crm",
    requiredServices: ["crm"],
    usageExample: "If user qualifies for the next sales stage, use tool 'move_to_pipeline_stage' to update their status",
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
  });

  unifiedToolRegistry.registerSystem(createGetPipelinePositionTool, {
    name: SYSTEM_TOOL_NAMES.GET_PIPELINE_POSITION,
    displayName: "Get Pipeline Position",
    description: "Get user's current position in CRM pipelines",
    category: "crm",
    requiredServices: ["crm"],
    usageExample: "If you need to know the user's CRM status, use tool 'get_pipeline_position' to check it",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs pipeline status to inform response about user's CRM stage",
    },
  });

  // ==========================================================================
  // CONTEXT TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createUserProfileTool, {
    name: SYSTEM_TOOL_NAMES.GET_USER_PROFILE,
    displayName: "Get User Profile",
    description: "Get user profile information including name, platform, and variables",
    category: "context",
    requiredServices: ["variable"],
    usageExample: "If you need user's global profile details, use tool 'get_user_profile' to retrieve them",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs user profile to respond",
    },
  });

  unifiedToolRegistry.registerSystem(createJourneyContextTool, {
    name: SYSTEM_TOOL_NAMES.GET_JOURNEY_CONTEXT,
    displayName: "Get Journey Context",
    description: "Get current journey context including variables, tags, and node outputs",
    category: "context",
    requiredServices: ["variable"],
    usageExample: "If you need the full context of the current session, use tool 'get_journey_context' to retrieve it",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs journey context to respond",
    },
  });

  // ==========================================================================
  // MESSAGING TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createSendMessageTool, {
    name: SYSTEM_TOOL_NAMES.SEND_MESSAGE,
    displayName: "Send Message",
    description: "Send a message to the user with optional buttons and media",
    category: "messaging",
    requiredServices: ["messenger"],
    usageExample: "If you need to send a message with buttons or media, use tool 'send_message' to deliver it",
    timingConfig: {
      timing: "immediate",
      configurable: true,
    },
  });

  // ==========================================================================
  // JOURNEY ROUTING TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createExitToNextNodeTool, {
    name: SYSTEM_TOOL_NAMES.EXIT_TO_NEXT_NODE,
    displayName: "Exit to Next Node",
    description: "Exit the current agent node and transition to the next node in the journey",
    category: "journey",
    requiredServices: ["messenger"],
    usageExample: "If the goal of this step is complete, use tool 'exit_to_next_node' to proceed",
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
  });

  // ==========================================================================
  // INITIALIZATION COMPLETE
  // ==========================================================================

  log.debug(
    { count: unifiedToolRegistry.getCounts().system },
    "tools:unified:systemToolsRegistered"
  );
}

// NOTE: Tools are registered explicitly via registerBuiltinTools() call
// in @journey/llm/tools/unified/index.ts, not automatically on import.
// This function is exported for explicit control and testing.
