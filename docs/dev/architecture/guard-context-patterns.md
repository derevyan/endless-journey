# Guard Context Patterns

> How to choose between basic and full context for edge guards.

---

## Overview

Edge guards evaluate conditions to determine which edges are "passable" from a node. The context available to guards affects both what conditions can be evaluated and the performance characteristics.

## Context Modes

| Context Mode          | Performance   | Use Case                                 | Available Data                                           |
| --------------------- | ------------- | ---------------------------------------- | -------------------------------------------------------- |
| `withAutoContext()`   | Auto-detect   | **Recommended** - auto-selects based on guard patterns | Depends on analysis |
| `withBasicContext()`  | Sync, fast    | Guards using session-local data only     | `session.*`, `tags.*`                                    |
| `withFullContext()`   | Async, slower | Guards needing variables or node outputs | `vars.*`, `nodes.*`, `session.*`, `tags.*`, `mindstate.*` |

## Auto Context Selection (Recommended)

The `withAutoContext(edges)` method **automatically analyzes guard expressions** and chooses the appropriate context mode. This is the recommended approach as it:

1. **Avoids unnecessary DB calls** - Only fetches variables when guards actually need them
2. **Reduces cognitive load** - No need to manually track what each guard references
3. **Is used by core handlers** - `message-handler`, `start-handler`, `event-router`, and `resolve-transition` all use it

```typescript
// Recommended - auto-detects context requirements
const selector = await EdgeSelector.from(context).withAutoContext(outgoingEdges);
const { passableEdges } = selector.selectTwoPhase(outgoingEdges);
```

### How It Works

The `analyzeGuardRequirements(edges)` function scans all guard expressions for namespace patterns:

```typescript
interface GuardRequirements {
  needsVars: boolean;      // Guard references vars.*
  needsNodes: boolean;     // Guard references nodes.*
  needsMindstate: boolean; // Guard references mindstate.*
  needsFullContext: boolean; // Any of the above (requires async fetch)
}

// Returns true if ANY guard contains these patterns
const requirements = EdgeSelector.analyzeRequirements(edges);
// { needsVars: true, needsNodes: false, needsMindstate: false, needsFullContext: true }
```

**Detection patterns:**
- `vars.` → requires variable fetch from DB
- `nodes.` → requires node outputs (already in session, but treated as full)
- `mindstate.` → requires mindstate values from mindstate service

## When to Use Each Mode

### Basic Context (Preferred)

Use basic context when guards only reference:

- `session.status` - Session lifecycle state
- `session.currentNodeId` - Current position
- `tags.*` - Client tags (e.g., `tags.premium`)
- Simple literals and comparisons

```typescript
// These guards use basic context (fast)
"session.status == 'active'";
"tags.verified == true";
"session.currentNodeId != 'error-node'";
```

### Full Context (When Needed)

Use full context when guards reference:

- `vars.*` - Variables from DB (global, journey, session, user scopes)
- `nodes.*` - Node outputs from previous executions
- `mindstate.*` - Mindstate parameter values (requires journey with mindstateConfig)
- Complex expressions requiring async data fetching

```typescript
// These guards require full context (async)
"vars.userPlan == 'premium'";
"nodes.GetCustomer.data.balance > 100";
"vars.dailyLimit < nodes.CountMessages.count";
"mindstate.mood.stress > 7";  // Mindstate parameter access
```

## Context Building

### EdgeSelector Usage

```typescript
// Modern approach using withAutoContext (recommended)
import { EdgeSelector } from "@journey/engine";

// In a handler:
const selector = await EdgeSelector.from(context).withAutoContext(outgoingEdges);
const { passableEdges, guardPassableEdges } = selector.selectTwoPhase(outgoingEdges);

// guardPassableEdges: edges that passed guard evaluation
// passableEdges: final result (includes fallback if all guards failed)
```

### Basic Context (Sync)

```typescript
private withBasicContext(): GuardContext {
  return {
    session: {
      status: this.session.status,
      currentNodeId: this.session.currentNodeId,
      userId: this.session.userId,
      // ... other session fields
    },
    tags: this.session.tags || [],
  };
}
```

### Full Context (Async)

```typescript
private async withFullContext(): Promise<GuardContext> {
  // Start with basic context
  const basic = this.withBasicContext();

  // Fetch variables from DB (scoped)
  const vars = await this.variableService.getAllVariables({
    organizationId: this.organizationId,
    journeyId: this.journeyId,
    sessionId: this.session.sessionId,
    userId: this.session.userId,
  });

  // Get node outputs from session state
  const nodes = this.session.nodeOutputs || {};

  return {
    ...basic,
    vars,
    nodes,
  };
}
```

## Expression Detection

The EdgeSelector uses `analyzeGuardRequirements` to determine context requirements by analyzing guard expressions:

```typescript
// From guard-utils.ts
import { analyzeGuardRequirements } from "@journey/engine";

const edges = [
  { id: "e1", guard: "tags.vip == true" },           // Basic context sufficient
  { id: "e2", guard: "vars.userPlan == 'premium'" }, // Needs full context
];

const requirements = analyzeGuardRequirements(edges);
// {
//   needsVars: true,      // e2 references vars.*
//   needsNodes: false,
//   needsMindstate: false,
//   needsFullContext: true
// }
```

**Detection is pattern-based** (simple string includes):
- `vars.` → `needsVars: true`
- `nodes.` → `needsNodes: true`
- `mindstate.` → `needsMindstate: true`
- Any of the above → `needsFullContext: true`

**Note:** Pattern detection is intentionally simple. For performance, use session/tags guards when possible rather than complex expressions.

## Performance Considerations

### Lazy Evaluation with Auto-Context

The `withAutoContext()` method ensures full context is only built when needed:

1. Analyze all guard expressions via `analyzeGuardRequirements(edges)`
2. If any guard references `vars.*`, `nodes.*`, or `mindstate.*` → build full context
3. Otherwise → use basic context (sync, no DB calls)

### Caching

Evaluation context is cached per-node execution via `getOrBuildEvaluationContext()`:

```typescript
// Inside handlers - context is built once and cached
const evalContext = await getOrBuildEvaluationContext(context);

// Subsequent calls in same execution reuse cached context
const evalContext2 = await getOrBuildEvaluationContext(context); // Returns cached
```

This caching is stored in the ExecutionContext and cleared on node transitions.

### Batch Fetching

When full context is needed, multiple variable scopes are fetched in parallel:

```typescript
const [globalVars, journeyVars, sessionVars, userVars] = await Promise.all([
  fetchGlobalVars(),
  fetchJourneyVars(),
  fetchSessionVars(),
  fetchUserVars()
]);
```

## Best Practices

### 1. Use withAutoContext()

```typescript
// Good: Let the system decide
const selector = await EdgeSelector.from(context).withAutoContext(outgoingEdges);

// Avoid: Manually choosing context mode (unless debugging)
const selector = EdgeSelector.from(context).withBasicContext(); // Manual
```

### 2. Prefer Basic Context Guards

```typescript
// Good: Uses tags (basic context)
guard: "tags.premium == true";

// Avoid: Uses vars when tags would work
guard: "vars.isPremium == true";
```

### 3. Cache Expensive Calculations

If a node output is used in multiple guards, compute it once:

```typescript
// In webhook node: Calculate and store
nodes.CalculateScore.score = computeExpensiveScore();

// In guards: Reference stored value
guard: "nodes.CalculateScore.score > 80";
```

### 4. Simple Expressions First

Put simple (basic context) guards on priority edges:

```typescript
// Edge 1 (checked first): Simple guard
{ label: "VIP", guard: "tags.vip == true", priority: 1 }

// Edge 2 (checked second): Complex guard
{ label: "HighValue", guard: "nodes.GetAccount.balance > 10000", priority: 2 }
```

### 5. Avoid Unnecessary Variables

```typescript
// Bad: Fetches all variables for simple check
guard: "vars.unused || session.status == 'active'";

// Good: Restructure to avoid unnecessary fetch
guard: "session.status == 'active'";
// (Move vars.unused check to separate edge if needed)
```

## Debugging

### Check Auto-Context Analysis

```typescript
import { EdgeSelector } from "@journey/engine";

// Analyze what context will be used without actually building it
const requirements = EdgeSelector.analyzeRequirements(outgoingEdges);
log.debug({
  needsVars: requirements.needsVars,
  needsNodes: requirements.needsNodes,
  needsMindstate: requirements.needsMindstate,
  willUseFull: requirements.needsFullContext
}, "guard:contextAnalysis");
```

### Log Context Mode During Selection

```typescript
log.debug(
  {
    edgeId: edge.id,
    guard: edge.guard,
    contextMode: requirements.needsFullContext ? "full" : "basic",
  },
  "guard:evaluating"
);
```

### Trace Variable Access

```typescript
log.trace(
  {
    variablesAccessed: Object.keys(vars),
    nodesAccessed: Object.keys(nodes),
  },
  "guard:contextBuilt"
);
```
