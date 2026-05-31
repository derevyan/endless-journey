# AI Report Architecture

Deep dive into the system design, module structure, and data flow of the `@journey/ai-report` package.

## Design Principles

### 1. Builder Pattern
Each report section has a dedicated builder function that transforms raw data into structured output. This enables:
- **Modularity** - Use only the builders you need
- **Testability** - Each builder can be unit tested in isolation
- **Extensibility** - Add new sections without touching existing code

### 2. Schema-First Design
All types are defined as Zod schemas first, then TypeScript types are inferred:
```typescript
export const ButtonClickDetailSchema = z.object({...});
export type ButtonClickDetail = z.infer<typeof ButtonClickDetailSchema>;
```

Benefits:
- Runtime validation when needed
- Single source of truth for types
- Self-documenting schemas

### 3. DRY Through Shared Modules
Common patterns are extracted into shared modules:
- `shared/event-mappers.ts` - Event type mapping functions
- `shared/llm-grouping.ts` - LLM event grouping utilities
- `shared/llm-truncation.ts` - Content truncation helpers

### 4. Performance-Conscious Design
- O(n) algorithms preferred over O(n²)
- Lookup maps built once, reused for queries
- Optional sections to reduce report size

## Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PUBLIC API                               │
├─────────────────────────────────────────────────────────────────┤
│  @journey/ai-report              │ Main entry (re-exports all)  │
│  @journey/ai-report/schemas      │ All Zod schemas & types      │
│  @journey/ai-report/builders     │ Report building functions    │
│  @journey/ai-report/analyzers    │ Analysis functions           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BUILDERS LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    report-builder.ts                      │   │
│  │  Main orchestrator - calls all other builders            │   │
│  │  buildExecutionReport() → AIExecutionReport              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│      ┌───────────────────────┼───────────────────────┐          │
│      │                       │                       │          │
│      ▼                       ▼                       ▼          │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │ journey  │         │transition│         │ message  │        │
│  │   log    │         │ builder  │         │ builder  │        │
│  │ builder  │         │          │         │          │        │
│  └──────────┘         └──────────┘         └──────────┘        │
│      │                       │                       │          │
│      ▼                       ▼                       ▼          │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │ button   │         │conversa- │         │ workflow │        │
│  │  click   │         │  tion    │         │ builder  │        │
│  │ builder  │         │ builder  │         │          │        │
│  └──────────┘         └──────────┘         └──────────┘        │
│      │                       │                       │          │
│      ▼                       ▼                       ▼          │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │ variable │         │   crm    │         │   hitl   │        │
│  │ builder  │         │ builder  │         │ builder  │        │
│  └──────────┘         └──────────┘         └──────────┘        │
│      │                       │                       │          │
│      └───────────────────────┼───────────────────────┘          │
│                              ▼                                   │
│                    ┌──────────────┐                             │
│                    │ performance  │                             │
│                    │   builder    │                             │
│                    └──────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SHARED LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  shared/event-mappers.ts    │ mapEventType, mapTrigger,        │
│                             │ mapButtonOutcomeToUnprocessed     │
│  shared/llm-grouping.ts     │ groupLLMEventsByModule,          │
│                             │ findLLMEventByTimestamp          │
│  shared/llm-truncation.ts   │ truncateSystemPrompt,            │
│                             │ truncateInputMessages            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ANALYZERS LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  issue-detector.ts          │ detectIssues() - problem finder   │
│  path-analyzer.ts           │ buildPathDescription() - path viz │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SCHEMAS LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  report.ts        │ AIExecutionReportSchema, ReportOptionsSchema│
│  journal-log.ts   │ JourneyLogEntrySchema, event types          │
│  transitions.ts   │ TransitionDetailSchema, trigger types       │
│  messages.ts      │ MessageDetailSchema, ErrorDetailSchema      │
│  workflows.ts     │ WorkflowExecutionDetailSchema               │
│  conversations.ts │ AINodeConversationSchema, LLM call details  │
│  variables.ts     │ VariableChangeDetailSchema                  │
│  issues.ts        │ DetectedIssueSchema, categories             │
│  button-tracking.ts│ ButtonClickDetailSchema, outcomes          │
│  crm.ts           │ CRMActionDetailSchema, action types         │
│  hitl.ts          │ HITLDecisionDetailSchema, decision types    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CONSTANTS LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  thresholds.ts    │ DETECTION_THRESHOLDS, LLM_MATCHING,         │
│                   │ REPORT_LIMITS                               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Detail

### 1. Input Collection

The report builder receives data from multiple sources:

```
┌────────────────────────────────────────────────────────────┐
│                    DATABASE TABLES                          │
├────────────────────────────────────────────────────────────┤
│  journey_sessions   → SessionData (status, context, tags)  │
│  interactions       → InteractionRecord[] (events)         │
│  llm_usage_events   → LLMUsageRecord[] (LLM calls)         │
│  node_outputs       → NodeOutputRecord[] (agent outputs)   │
│  clients            → UserData (user info)                 │
│  journeys           → JourneyData (nodes, edges)           │
└────────────────────────────────────────────────────────────┘
```

### 2. Transformation Pipeline

Each builder transforms raw records into structured output:

```typescript
// Journey Log Builder
InteractionRecord[] → JourneyLogEntry[]
  ├── Map event type (mapEventType)
  ├── Enrich with node info (nodeMap)
  └── Generate description

// Transition Builder
InteractionRecord[] → TransitionDetail[]
  ├── Filter engine.transition events
  ├── Map trigger (mapTrigger)
  ├── Calculate duration at previous node
  └── Extract button/error context

// Conversation Builder
NodeOutputRecord[] + LLMUsageRecord[] → AINodeConversation[]
  ├── Group LLM events by module
  ├── Match events to responses (timestamp-based)
  ├── Build turn-by-turn history
  └── Aggregate metrics

// Issue Detector
JourneyLogEntry[] + ButtonClickDetail[] + ErrorDetail[] + TransitionDetail[]
  → DetectedIssue[]
  ├── Detect execution errors
  ├── Detect button click failures
  ├── Detect repeated nodes (loop detection)
  ├── Detect slow nodes
  └── Detect guard blocks
```

### 3. Output Assembly

The report builder assembles all sections:

```typescript
const report: AIExecutionReport = {
  // Metadata
  reportVersion: "1.0",
  generatedAt: new Date().toISOString(),
  reportType: session.status === "active" ? "in_progress" : "completed",

  // Context
  session: { ... },
  journey: { ... },
  user: { ... },

  // Optional graph
  journeyGraph: includeGraph ? buildJourneyGraph(journey) : undefined,

  // Summary (executive view)
  summary: buildSummary(...),

  // Detailed sections
  journeyLog: buildJourneyLog(...),
  transitions: buildTransitions(...),
  messages: buildMessages(...),
  errors: extractErrors(...),
  workflowExecutions: buildWorkflowExecutions(...),
  aiConversations: buildAIConversations(...),
  crmActions: buildCRMActions(...),
  hitlDecisions: buildHITLDecisions(...),
  variableChanges: buildVariableChanges(...),
  currentVariables: session.context,
  currentTags: session.tags,
  nodeOutputs: session.nodeOutputs,
  buttonClicks: buildButtonClicks(...),
  unprocessedEvents: buildUnprocessedEvents(...),

  // Analysis
  issues: detectIssues(...),
  performanceAnalysis: buildPerformanceAnalysis(...),
};
```

## Key Algorithms

### O(n) Issue Detection

The issue detector uses lookup maps to avoid O(n²) complexity:

```typescript
// Build lookup map once - O(n)
const firstTransitionToNode = new Map<string, TransitionDetail>();
for (const transition of transitions) {
  if (!firstTransitionToNode.has(transition.toNodeId)) {
    firstTransitionToNode.set(transition.toNodeId, transition);
  }
}

// Then O(1) lookups
for (const [nodeId, count] of nodeVisitCount) {
  if (count >= DETECTION_THRESHOLDS.REPEATED_NODE_VISIT_COUNT) {
    const transition = firstTransitionToNode.get(nodeId); // O(1)
    issues.push({ ... });
  }
}
```

### LLM Event Matching

Conversation builder matches LLM events to agent responses using timestamp proximity:

```typescript
function findLLMEventByTimestamp(
  events: LLMUsageRecord[],
  targetTimestamp: string | Date,
  toleranceMs: number = 5000
): LLMUsageRecord | undefined {
  const targetTime = new Date(targetTimestamp).getTime();
  let bestMatch: LLMUsageRecord | undefined;
  let bestDiff = Infinity;

  for (const event of events) {
    const eventTime = new Date(event.createdAt).getTime();
    const diff = Math.abs(eventTime - targetTime);

    if (diff <= toleranceMs && diff < bestDiff) {
      bestMatch = event;
      bestDiff = diff;
    }
  }

  return bestMatch;
}
```

### Event Type Mapping

Central mapping ensures consistency across builders:

```typescript
const EVENT_TYPE_MAP: Record<string, JourneyLogEventType> = {
  "user.message": "user_message",
  "user.click": "user_button_click",
  "engine.message": "bot_message",
  "engine.transition": "node_transition",
  // ... complete mapping
};

export function mapEventType(interactionType: string): JourneyLogEventType {
  return EVENT_TYPE_MAP[interactionType] || "node_transition";
}
```

## Schema Design

### Discriminated Unions

Button click outcomes use discriminated union pattern:

```typescript
export const ButtonClickOutcomeSchema = z.enum([
  "transition_success",  // Normal success
  "agent_reexecute",     // AI quick-reply
  "button_not_found",    // Button ID mismatch
  "edge_not_found",      // No edge for button
  "guard_blocked",       // Guard prevented
  "error",               // Error occurred
  "no_handler",          // No handler registered
]);
```

### Optional Sections

Heavy sections are optional to control report size:

```typescript
export const AIExecutionReportSchema = z.object({
  // Required
  reportVersion: z.literal("1.0"),
  session: SessionSchema,
  summary: ReportSummarySchema,

  // Optional
  journeyGraph: JourneyGraphSchema.optional(),
  crmActions: z.array(CRMActionDetailSchema).optional(),
  hitlDecisions: z.array(HITLDecisionDetailSchema).optional(),
  performanceAnalysis: PerformanceAnalysisSchema.optional(),
});
```

### Node Output Keys

Node outputs use `nodeId` as key to prevent collisions:

```typescript
// Old (collision-prone)
const key = output.sanitizedLabel || output.nodeId;
sessionData.nodeOutputs[key] = output.data;

// New (collision-safe)
sessionData.nodeOutputs[output.nodeId] = {
  label: output.sanitizedLabel,
  data: output.data,
};
```

## Extension Points

### Adding New Builders

1. Create schema in `schemas/`:
```typescript
// schemas/my-feature.ts
export const MyFeatureDetailSchema = z.object({...});
export type MyFeatureDetail = z.infer<typeof MyFeatureDetailSchema>;
```

2. Create builder in `builders/`:
```typescript
// builders/my-feature-builder.ts
export function buildMyFeature(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): MyFeatureDetail[] {
  // Transform logic
}
```

3. Export from index files
4. Integrate in `report-builder.ts`
5. Add to `AIExecutionReportSchema`

### Adding New Event Types

1. Add to `JourneyLogEventTypeSchema`:
```typescript
export const JourneyLogEventTypeSchema = z.enum([
  // ... existing
  "my_new_event",
]);
```

2. Add mapping in `event-mappers.ts`:
```typescript
const EVENT_TYPE_MAP = {
  // ... existing
  "my.new.event": "my_new_event",
};
```

### Adding New Issue Categories

1. Add to `IssueCategorySchema`:
```typescript
export const IssueCategorySchema = z.enum([
  // ... existing
  "my_new_issue",
]);
```

2. Add detection logic in `issue-detector.ts`

## Performance Considerations

### Memory Efficiency

- Builders process events in single pass where possible
- No deep cloning of large objects
- Optional sections excluded when not requested

### Time Complexity

| Operation         | Complexity | Notes            |
| ----------------- | ---------- | ---------------- |
| Event mapping     | O(1)       | Hash map lookup  |
| Journey log build | O(n)       | Single pass      |
| Transition build  | O(n)       | Single pass      |
| Issue detection   | O(n)       | Uses lookup maps |
| Path description  | O(n)       | Single pass      |
| LLM grouping      | O(n)       | Single pass      |

### Report Size Control

Use `ReportOptions` to control output size:

```typescript
const options: ReportOptions = {
  // Exclude large sections
  includeGraph: false,

  // Truncate LLM content
  systemPromptMaxChars: 1000,
  conversationHistoryMaxChars: 2000,

  // Filter events
  maxEvents: 500,
};
```

## Error Handling

### Graceful Degradation

Builders handle missing data gracefully:

```typescript
// Missing node info
const nodeInfo = interaction.nodeId ? nodeMap.get(interaction.nodeId) : undefined;
const nodeLabel = nodeInfo?.label || nodeInfo?.id || "unknown";

// Missing LLM events
const llmEvents = getLLMEventsForNode(...) || [];

// Missing metrics
const totalTokens = metrics?.totalTokens ||
  turns.reduce((sum, t) => sum + (t.tokensUsed || 0), 0);
```

### Type Safety

All inputs are typed, outputs match Zod schemas:

```typescript
// Input types enforced
export function buildJourneyLog(
  interactions: InteractionRecord[],  // Typed input
  nodeMap: Map<string, NodeInfo>      // Typed input
): JourneyLogEntry[] {                // Typed output
  // ...
}
```

## Testing Strategy

### Unit Tests

Each builder should have unit tests:

```typescript
describe("buildJourneyLog", () => {
  it("maps user.message to user_message", () => {
    const interactions = [
      { id: "1", timestamp: "...", eventType: "user.message", ... }
    ];
    const result = buildJourneyLog(interactions, nodeMap);
    expect(result[0].eventType).toBe("user_message");
  });
});
```

### Integration Tests

Test full report generation:

```typescript
describe("buildExecutionReport", () => {
  it("generates complete report for session", () => {
    const report = buildExecutionReport(
      mockSession,
      mockJourney,
      mockUser,
      mockInteractions
    );

    expect(report.reportVersion).toBe("1.0");
    expect(report.journeyLog.length).toBeGreaterThan(0);
    expect(report.summary.nodesVisited).toBeGreaterThan(0);
  });
});
```

## See Also

- [README](./README.md) - Package overview
- [Schema Reference](./schemas.md) - Complete type definitions
- [AI Agent Guide](./ai-agent-guide.md) - Guide for AI consumers
