# @journey/ai-report

AI-optimized execution report generation for journey sessions. Transforms raw session data into structured, comprehensive reports designed for both human debugging and AI analysis.

## Overview

- **Report Generation** - Builds detailed execution reports from session interactions, LLM events, and node outputs
- **Issue Detection** - Automatically identifies problems (errors, slow nodes, loops, failed clicks)
- **Performance Analysis** - Tracks bottlenecks and provides optimization suggestions
- **CRM & HITL Tracking** - Captures CRM actions and human-in-the-loop decisions
- **AI-Friendly Format** - Structured data optimized for LLM consumption with context preservation

## Quick Start

```typescript
import { buildExecutionReport } from "@journey/ai-report/builders";
import type { ReportOptions } from "@journey/ai-report/schemas";

// Build a complete execution report
const report = buildExecutionReport(
  sessionData,      // Session state and outputs
  journeyData,      // Journey configuration (nodes, edges)
  userData,         // User information
  interactions,     // Chronological event log
  llmUsageEvents,   // LLM call details (optional)
  nodeOutputRecords, // Agent outputs (optional)
  options           // Report options (optional)
);

// Report includes:
// - Executive summary with path visualization
// - Chronological journey log
// - Transition details with triggers
// - Complete conversation history
// - Error details with context
// - AI node conversations with full LLM calls
// - CRM actions and HITL decisions
// - Detected issues with suggestions
// - Performance analysis
```

## Documentation Map

| Document                                 | Description                                |
| ---------------------------------------- | ------------------------------------------ |
| [README.md](./README.md)                 | This file - overview and quick start       |
| [architecture.md](./architecture.md)     | System design, data flow, module structure |
| [schemas.md](./schemas.md)               | Complete schema reference with all types   |
| [ai-agent-guide.md](./ai-agent-guide.md) | Guide for AI agents consuming reports      |

## Package Structure

```
packages/ai-report/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── schemas/                    # Zod schemas & types
│   │   ├── index.ts
│   │   ├── report.ts               # Main AIExecutionReport schema
│   │   ├── journal-log.ts          # Chronological event entries
│   │   ├── transitions.ts          # Node transition details
│   │   ├── messages.ts             # Message & error schemas
│   │   ├── workflows.ts            # Workflow execution details
│   │   ├── conversations.ts        # AI node conversation history
│   │   ├── variables.ts            # Variable change tracking
│   │   ├── issues.ts               # Detected issue schema
│   │   ├── button-tracking.ts      # Button click tracking
│   │   ├── crm.ts                  # CRM action schema
│   │   └── hitl.ts                 # HITL decision schema
│   ├── builders/                   # Report section builders
│   │   ├── index.ts
│   │   ├── report-builder.ts       # Main orchestrator
│   │   ├── journey-log-builder.ts  # Chronological log
│   │   ├── transition-builder.ts   # Transition extraction
│   │   ├── message-builder.ts      # Messages & errors
│   │   ├── button-click-builder.ts # Button tracking
│   │   ├── conversation-builder.ts # AI conversations
│   │   ├── workflow-builder.ts     # Workflow executions
│   │   ├── variable-builder.ts     # Variable changes
│   │   ├── crm-builder.ts          # CRM actions
│   │   ├── hitl-builder.ts         # HITL decisions
│   │   ├── performance-builder.ts  # Performance analysis
│   │   └── shared/                 # Shared utilities
│   │       ├── index.ts
│   │       ├── event-mappers.ts    # Event type mapping
│   │       ├── llm-grouping.ts     # LLM event grouping
│   │       └── llm-truncation.ts   # Content truncation
│   ├── analyzers/                  # Analysis functions
│   │   ├── index.ts
│   │   ├── issue-detector.ts       # Problem detection
│   │   └── path-analyzer.ts        # Path visualization
│   └── constants/                  # Configuration constants
│       ├── index.ts
│       └── thresholds.ts           # Detection thresholds
└── package.json
```

## Core Concepts

### Report Structure

The `AIExecutionReport` is organized into logical sections:

```
AIExecutionReport
├── Metadata (version, generatedAt, reportType)
├── Session (id, status, mode, duration, currentNode)
├── Journey (id, name, slug)
├── User (id, displayName, tags)
├── journeyGraph (optional - full node/edge definition)
├── summary (executive quick-scan)
│   ├── pathDescription ("Start → Welcome → Agent → End")
│   ├── nodesVisited, uniqueNodes
│   ├── message counts, button clicks, timeouts
│   ├── error/warning counts
│   └── LLM metrics (tokens, cost, call count)
├── journeyLog (chronological events)
├── transitions (node-to-node with reasons)
├── messages (complete conversation)
├── errors (all errors with context)
├── workflowExecutions (agent runs with LLM details)
├── aiConversations (conversation history with full LLM calls)
├── crmActions (CRM operations)
├── hitlDecisions (human approval decisions)
├── variableChanges (state evolution)
├── currentVariables (final state)
├── currentTags (final tags)
├── nodeOutputs (keyed by nodeId)
├── buttonClicks (all clicks with outcomes)
├── unprocessedEvents (failed interactions)
├── issues (detected problems with suggestions)
└── performanceAnalysis (bottlenecks, slow nodes)
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        INPUT DATA                            │
├──────────────────────────────────────────────────────────────┤
│  SessionData      │ Session state, context, outputs          │
│  JourneyData      │ Nodes, edges, configuration              │
│  UserData         │ User ID, name, platform ID               │
│  InteractionRecord│ Chronological events from DB             │
│  LLMUsageRecord   │ Full LLM call details (optional)         │
│  NodeOutputRecord │ Agent outputs (optional)                 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    BUILDERS PIPELINE                          │
├──────────────────────────────────────────────────────────────┤
│  1. buildJourneyLog()        → journeyLog[]                  │
│  2. buildTransitions()       → transitions[]                 │
│  3. buildMessages()          → messages[]                    │
│  4. extractErrors()          → errors[]                      │
│  5. buildButtonClicks()      → buttonClicks[]                │
│  6. buildUnprocessedEvents() → unprocessedEvents[]           │
│  7. buildAIConversations()   → aiConversations[]             │
│  8. buildWorkflowExecutions()→ workflowExecutions[]          │
│  9. buildCRMActions()        → crmActions[]                  │
│ 10. buildHITLDecisions()     → hitlDecisions[]               │
│ 11. buildVariableChanges()   → variableChanges[]             │
│ 12. buildPerformanceAnalysis()→ performanceAnalysis          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    ANALYZERS                                  │
├──────────────────────────────────────────────────────────────┤
│  detectIssues()         → issues[] (problems with suggestions)│
│  buildPathDescription() → "Start → Node1 → Node2 → End"      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    OUTPUT: AIExecutionReport                  │
└──────────────────────────────────────────────────────────────┘
```

## Usage Examples

### Basic Report Generation

```typescript
import { buildExecutionReport } from "@journey/ai-report/builders";

const report = buildExecutionReport(
  {
    id: "session-uuid",
    status: "completed",
    mode: "live",
    currentNodeId: "end-node",
    startedAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:05:00Z",
    completedAt: "2024-01-15T10:05:00Z",
    context: { userName: "John", score: 85 },
    tags: ["premium", "completed"],
    nodeOutputs: {},
  },
  journeyData,
  userData,
  interactions
);
```

### With LLM Details (Agent Nodes)

```typescript
const report = buildExecutionReport(
  sessionData,
  journeyData,
  userData,
  interactions,
  llmUsageEvents,    // Full LLM call details
  nodeOutputRecords, // Agent response history
  {
    includeLLMDetails: true,
    systemPromptMaxChars: 2000,  // Truncate long prompts
    conversationHistoryMaxChars: 5000,
  }
);

// Access AI conversation details
for (const conversation of report.aiConversations) {
  console.log(`Agent: ${conversation.nodeLabel}`);
  console.log(`Turns: ${conversation.turns.length}`);
  console.log(`Tokens: ${conversation.metrics.totalTokens}`);

  for (const turn of conversation.turns) {
    console.log(`User: ${turn.userMessage}`);
    console.log(`Assistant: ${turn.assistantResponse}`);

    // Full LLM call details
    if (turn.llmCall) {
      console.log(`Model: ${turn.llmCall.config.model}`);
      console.log(`System Prompt: ${turn.llmCall.systemPrompt}`);
    }
  }
}
```

### Filtering Large Sessions

```typescript
const report = buildExecutionReport(
  sessionData,
  journeyData,
  userData,
  interactions,
  [],
  [],
  {
    // Time range filter
    fromTimestamp: "2024-01-15T10:00:00Z",
    toTimestamp: "2024-01-15T10:02:00Z",

    // Limit events
    maxEvents: 100,

    // Exclude heavy sections
    includeGraph: false,
    includeMessages: true,
    includeWorkflows: true,
  }
);
```

### Using Individual Builders

```typescript
import {
  buildJourneyLog,
  buildTransitions,
  buildButtonClicks,
  buildCRMActions,
  buildHITLDecisions,
  buildPerformanceAnalysis,
} from "@journey/ai-report/builders";
import { detectIssues } from "@journey/ai-report/analyzers";

// Build only what you need
const journeyLog = buildJourneyLog(interactions, nodeMap);
const transitions = buildTransitions(interactions, nodeMap);
const buttonClicks = buildButtonClicks(interactions, nodeMap);
const crmActions = buildCRMActions(interactions, nodeMap);
const hitlDecisions = buildHITLDecisions(interactions, nodeMap);

// Detect issues
const issues = detectIssues(journeyLog, buttonClicks, errors, transitions);

// Analyze performance
const perfAnalysis = buildPerformanceAnalysis(transitions, workflowExecutions);
```

## Report Options

```typescript
interface ReportOptions {
  // Section inclusion (default: true)
  includeGraph?: boolean;      // Include full journey graph
  includeMessages?: boolean;   // Include message history
  includeWorkflows?: boolean;  // Include workflow executions
  includeLLMDetails?: boolean; // Include full LLM call details

  // LLM truncation
  systemPromptMaxChars?: number;         // Max chars for system prompts
  conversationHistoryMaxChars?: number;  // Max chars per conversation turn
  includeInputMessages?: boolean;        // Include input messages to LLM

  // Filtering
  fromTimestamp?: string;  // ISO datetime - start filter
  toTimestamp?: string;    // ISO datetime - end filter
  eventTypes?: string[];   // Filter to specific event types
  maxEvents?: number;      // Limit total events

  // Pagination
  offset?: number;
  limit?: number;
}
```

## Issue Detection

The `detectIssues()` function automatically identifies problems:

| Category               | Severity | Detection                             |
| ---------------------- | -------- | ------------------------------------- |
| `execution_error`      | error    | Any `engine.error` event              |
| `button_click_ignored` | error    | Button click with non-success outcome |
| `repeated_node`        | info     | Node visited 3+ times                 |
| `slow_node`            | warning  | Node duration > 30 seconds            |
| `guard_blocked`        | warning  | Guard blocked transition              |

Each issue includes:
- `severity`: error, warning, info
- `category`: Issue type
- `nodeId`: Where it occurred
- `timestamp`: When it occurred
- `message`: Human-readable description
- `suggestion`: Actionable fix recommendation
- `context`: Additional data for debugging

## Event Type Mapping

Raw interaction events are mapped to report event types:

| Raw Event            | Report Event Type                    |
| -------------------- | ------------------------------------ |
| `user.message`       | `user_message`                       |
| `user.click`         | `user_button_click`                  |
| `engine.message`     | `bot_message`                        |
| `engine.transition`  | `node_transition`                    |
| `engine.error`       | `node_error`                         |
| `workflow.started`   | `workflow_started`                   |
| `workflow.completed` | `workflow_completed`                 |
| `llm.guard.blocked`  | `guard_blocked`                      |
| `journey.crm`        | `crm_action`                         |
| `system.hitl`        | `hitl_decision`                      |
| ...                  | See `event-mappers.ts` for full list |

## Transition Triggers

The report tracks why each transition occurred:

| Trigger           | Description                                 |
| ----------------- | ------------------------------------------- |
| `auto`            | Automatic transition (no user input needed) |
| `button_click`    | User clicked a button                       |
| `timer_expired`   | Timer/timeout triggered                     |
| `condition_true`  | If/else condition evaluated true            |
| `condition_false` | If/else condition evaluated false           |
| `guard_passed`    | Guard condition passed                      |
| `guard_blocked`   | Guard condition blocked                     |
| `error`           | Error caused transition                     |
| `workflow_exit`   | Workflow/agent exited                       |

## Performance Analysis

The performance builder identifies bottlenecks:

```typescript
interface PerformanceAnalysis {
  totalDurationMs: number;
  avgNodeDurationMs: number;
  slowestNodes: Array<{
    nodeId: string;
    nodeLabel?: string;
    avgDurationMs: number;
    executionCount: number;
  }>;
  bottlenecks: string[];  // Human-readable descriptions
  bottleneckDetails: Array<{
    nodeId: string;
    reason: string;
    impact: "high" | "medium" | "low";
    avgDurationMs: number;
    suggestion?: string;
  }>;
}
```

Impact levels:
- **high**: >60s average OR >30% of session time
- **medium**: >30s average OR >15% of session time
- **low**: Above threshold but lower impact

## Configuration Constants

Thresholds can be adjusted in `constants/thresholds.ts`:

```typescript
export const DETECTION_THRESHOLDS = {
  REPEATED_NODE_VISIT_COUNT: 3,   // Visits before flagging
  SLOW_NODE_DURATION_MS: 30000,   // 30 seconds
  PATH_LABEL_MAX_LENGTH: 20,      // Path visualization
} as const;

export const LLM_MATCHING = {
  TIMESTAMP_TOLERANCE_MS: 5000,   // LLM event matching
} as const;
```

## API Reference

### Main Exports

```typescript
// Schemas
import type {
  AIExecutionReport,
  ReportOptions,
  JourneyLogEntry,
  TransitionDetail,
  MessageDetail,
  ErrorDetail,
  ButtonClickDetail,
  AINodeConversation,
  WorkflowExecutionDetail,
  VariableChangeDetail,
  CRMActionDetail,
  HITLDecisionDetail,
  DetectedIssue,
  PerformanceAnalysis,
} from "@journey/ai-report/schemas";

// Builders
import {
  buildExecutionReport,
  buildJourneyLog,
  buildTransitions,
  buildMessages,
  extractErrors,
  buildButtonClicks,
  buildUnprocessedEvents,
  buildAIConversations,
  buildWorkflowExecutions,
  buildVariableChanges,
  buildCRMActions,
  buildHITLDecisions,
  buildPerformanceAnalysis,
} from "@journey/ai-report/builders";

// Analyzers
import {
  detectIssues,
  buildPathDescription,
} from "@journey/ai-report/analyzers";
```

### Input Types

```typescript
interface SessionData {
  id: string;
  status: "active" | "completed" | "dropped" | "paused" | "error";
  mode?: "live" | "test" | "simulation";
  currentNodeId: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  context: Record<string, unknown>;
  tags: string[];
  nodeOutputs: Record<string, { label?: string; data: unknown }>;
}

interface JourneyData {
  id: string;
  name: string;
  slug?: string;
  configuration: {
    nodes: Array<{ id: string; type: string; data: { label?: string } }>;
    edges: Array<{ id: string; source: string; target: string }>;
  };
}

interface InteractionRecord {
  id: string;
  timestamp: string;
  eventType: string;
  nodeId: string | null;
  payload: unknown;
}
```

## Testing

```bash
# Run unit tests
pnpm --filter @journey/ai-report test

# Run with coverage
pnpm --filter @journey/ai-report test:coverage

# Type check
pnpm --filter @journey/ai-report typecheck
```

## See Also

- [Architecture Details](./architecture.md) - Deep dive into system design
- [Schema Reference](./schemas.md) - Complete type definitions
- [AI Agent Guide](./ai-agent-guide.md) - Guide for AI consumers
- [Engine Documentation](../engine/README.md) - Journey execution engine
- [API Routes](../api/README.md) - REST API endpoints
