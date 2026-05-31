# Journey Fuzzy Testing Framework

Comprehensive testing framework for the Journey Engine that catches bugs through random journey generation, property-based testing, structure validation, and chaos testing.

## Overview

The fuzzy testing framework provides four types of testing:

1. **Structure Validation** - Catch invalid journey configurations before runtime
2. **Property-Based Testing** - Verify invariants hold for any valid journey
3. **Chaos Testing** - Test resilience to failures and edge cases
4. **Random Journey Generation** - Generate valid/invalid journeys programmatically

## Quick Start

```bash
# Run all fuzzy tests
pnpm -C packages/engine test:fuzzy:all

# Run individual test suites
pnpm -C packages/engine test:validation   # Structure validation tests
pnpm -C packages/engine test:fuzzy        # Property-based tests
pnpm -C packages/engine test:chaos        # Chaos/failure injection tests
```

## Test Commands

| Command | Description |
|---------|-------------|
| `pnpm -C packages/engine test:validation` | Run structure validation tests (fast) |
| `pnpm -C packages/engine test:fuzzy` | Run property-based tests with random journeys |
| `pnpm -C packages/engine test:chaos` | Run chaos/failure injection tests |
| `pnpm -C packages/engine test:fuzzy:all` | Run all fuzzy tests together |

## Environment Variables

Configure test behavior with environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FUZZY_JOURNEY_COUNT` | 100 | Number of random journeys to generate |
| `FUZZY_SEED` | 42 | Seed for reproducible random generation |
| `FUZZY_TIMEOUT` | 30000 | Timeout per journey test (ms) |
| `FUZZY_CONCURRENCY` | 20 | Concurrent journey executions |
| `CHAOS_SEED` | 7777 | Seed for chaos test randomization |
| `CHAOS_TIMEOUT` | 30000 | Timeout for chaos tests (ms) |

### Examples

```bash
# Quick validation run
pnpm -C packages/engine test:validation

# Thorough fuzzy testing with 500 journeys
FUZZY_JOURNEY_COUNT=500 pnpm -C packages/engine test:fuzzy

# Reproducible test with specific seed
FUZZY_SEED=12345 pnpm -C packages/engine test:fuzzy

# Increase concurrency for large suites
FUZZY_CONCURRENCY=50 FUZZY_JOURNEY_COUNT=200 pnpm -C packages/engine test:fuzzy

# Debug a specific failure
FUZZY_SEED=12345 FUZZY_JOURNEY_COUNT=1 pnpm -C packages/engine test:fuzzy
```

---

## Structure Validation

The validation module catches invalid journey configurations before runtime.

### Validation Errors (Must Fix)

| Error Code | Description |
|------------|-------------|
| `NO_START_NODE` | Journey has no start node |
| `MULTIPLE_START_NODES` | Journey has more than one start node |
| `NO_END_NODE` | Journey has no end node |
| `DANGLING_EDGE_SOURCE` | Edge references non-existent source node |
| `DANGLING_EDGE_TARGET` | Edge references non-existent target node |
| `ORPHAN_NODE` | Node is not reachable from start |
| `AUTO_TRANSITION_CYCLE` | Infinite loop in auto-transitions |
| `MISSING_CONDITION_BRANCH_EDGE` | Condition node missing edge for a branch |
| `MISSING_TIMER_EDGE` | Message with timer has no timer edge |
| `DUPLICATE_NODE_ID` | Multiple nodes with same ID |
| `DUPLICATE_EDGE_ID` | Multiple edges with same ID |
| `DUPLICATE_BUTTON_IDS` | Duplicate button IDs on a node |
| `INVALID_FOLLOWUP_EXIT_TARGET` | Follow-up exitPath points to missing node |
| `INVALID_FOLLOWUP_BUTTON_TARGET` | Follow-up button targets missing node |
| `SELF_REFERENCING_FOLLOWUP` | Follow-up exit path loops back to same node |

### Validation Warnings (Should Fix)

| Warning Code | Description |
|--------------|-------------|
| `DEAD_END_NODE` | Node cannot reach any end node |
| `MISSING_DEFAULT_BRANCH` | Condition has no default branch |
| `EMPTY_MESSAGE_CONTENT` | Message node has empty content |
| `DUPLICATE_BUTTON_LABELS` | Message has duplicate button labels |
| `DUPLICATE_NODE_LABEL` | Duplicate sanitized node labels (nodeOutputs collision) |
| `MISSING_WEBHOOK_ERROR_EDGE` | Webhook has no error handling edge |
| `DISCONNECTED_BUTTON` | Button not connected to any edge |
| `MISSING_TEXT_RESPONSE_EDGE` | Text response node has no matching edge |
| `MISSING_QUESTIONNAIRE_TIMEOUT_EDGE` | Questionnaire timeout has no path |
| `MISSING_AGENT_TIMEOUT_EDGE` | Agent timeout has no path |

### Usage

```typescript
import { validateJourneyStructure, isValidJourney, formatValidationResult } from "@journey/engine";

// Quick check
if (isValidJourney(journey)) {
  // Journey is valid
}

// Detailed validation
const result = validateJourneyStructure(journey);
if (!result.valid) {
  console.log(formatValidationResult(result));
  // Shows errors, warnings, and summary
}

// Access specific information
console.log(result.errors);   // Array of ValidationError
console.log(result.warnings); // Array of ValidationError
console.log(result.summary);  // Node counts, types, features
```

---

## Property-Based Testing

Tests that verify invariants hold for ANY valid journey.

### Tested Properties

| Property | Description |
|----------|-------------|
| **Termination** | Every journey reaches end or waits for input within MAX_STEPS |
| **State Consistency** | Session state is always valid after any operation |
| **History Integrity** | History events match actual execution path |
| **Message Ordering** | Messages sent in node execution order |
| **No Duplicate Messages** | Same message never sent twice for same node |

### Test Categories

```typescript
describe("Property-Based Journey Tests", () => {
  // Validates N random journeys pass structure validation
  it("validates 100 random journeys correctly");

  // Verifies mixed valid/invalid journeys are correctly identified
  it("correctly identifies invalid journeys");

  // Tests termination within step limit
  it("every valid journey reaches end or waits within MAX_STEPS");

  // Tests linear auto-transition journeys complete
  it("linear auto-transition journeys complete immediately");

  // Tests session state remains valid
  it("session state remains valid after execution");

  // Tests history only references valid nodes
  it("history only references valid nodes");
});
```

---

## Chaos Testing

Tests resilience to failures and unexpected conditions.

### Failure Types Tested

| Failure Type | Description |
|--------------|-------------|
| **Permanent Send Failure** | Message sending always fails |
| **Transient Send Failure** | Message sending fails N times then succeeds |
| **Mid-Journey Failure** | Failure injected during execution |
| **Sequential Failures** | Multiple failures in sequence |
| **Random Failure Injection** | Random failures at configurable probability |
| **State Corruption** | Invalid node references, empty history |
| **Timer Interaction** | Failures during timer waits |
| **Webhook Chaos** | Webhook failures during execution |

### Example Test Cases

```typescript
describe("Chaos Testing", () => {
  it("handles permanent send failure gracefully");
  it("handles transient failure with recovery");
  it("recovers from failure mid-journey");
  it("handles multiple sequential failures");
  it("handles rapid sequential events");
  it("survives 10% failure rate");
  it("survives 30% failure rate with retries");
  it("handles invalid node reference in session");
  it("handles failure during timer wait");
});
```

---

## Journey Generators

Programmatically generate journeys for testing with realistic features.

### Generator Functions

```typescript
import {
  generateValidJourney,
  generateLinearJourney,
  generateBranchingJourney,
  generateInvalidJourney,
  generateEdgeCaseJourney,
  generateRandomJourneys,
  generateMixedJourneys,
  setGeneratorSeed,
  // New realistic content generators
  generateRealisticContent,
  generateRealisticButtons,
  generateTagAction,
  generateVariableAction,
  generateMedia,
  // New node generators
  generateCrmNode,
  generateTeleportNode,
} from "@journey/engine/__tests__/generators";

// Set seed for reproducibility
setGeneratorSeed(12345);

// Generate a random valid journey with realistic features
// Includes: template variables, tag/variable actions, media, error edges
const journey = generateValidJourney({
  minNodes: 3,
  maxNodes: 10,
  seed: 42,
});

// Generate a linear journey (start -> N messages -> end)
const linear = generateLinearJourney(5, {
  responseType: "auto", // or "buttons", "text", "any"
  seed: 42,
});

// Generate a branching journey with condition
const branching = generateBranchingJourney(3, { seed: 42 });

// Generate multiple random journeys
const journeys = generateRandomJourneys(100, { seed: 42 });
```

### Realistic Features in Generated Journeys

Generated journeys now include production-like features:

| Feature | Probability | Example |
|---------|------------|---------|
| Template variables | ~30% | `Hello {{user.name}}!` |
| Emoji content | ~40% | `👋 Welcome!` |
| storeResponseAs | ~30% | Store user response in variable |
| Tag actions | ~25% | Add/remove tags on node execution |
| Variable actions | ~20% | Set/increment journey variables |
| Media attachments | ~15% | Images/videos on messages |
| Webhook auth | ~40% | Bearer token authentication |
| Webhook storeAs | ~60% | Store API response |
| Error/retry edges | ~50% | Webhook error handling paths |
| Dropoff edges | ~20% | Abandoned interactive nodes |

### Invalid Journey Types

Generate specific invalid journeys for testing error detection:

```typescript
type InvalidationType =
  | "no_start"           // Missing start node
  | "no_end"             // Missing end node
  | "multiple_starts"    // Multiple start nodes
  | "dangling_edge"      // Edge to non-existent node
  | "orphan_node"        // Unreachable node
  | "auto_cycle"         // Infinite auto-transition loop
  | "missing_branch_edge"// Condition missing branch edge
  | "missing_timer_edge" // Message timer without timer edge
  | "duplicate_node_id"  // Duplicate node IDs
  | "duplicate_edge_id"; // Duplicate edge IDs

const invalid = generateInvalidJourney("auto_cycle", 42);
```

### Edge Case Journey Types

Generate specific edge cases for boundary testing:

```typescript
type EdgeCaseType =
  | "minimal"           // Start -> End only
  | "linear_long"       // 100+ node linear chain
  | "wide_branch"       // Condition with 10 branches
  | "deep_nesting"      // Deeply nested conditions
  | "all_auto"          // All auto-transition nodes
  | "all_interactive"   // All nodes require input
  | "max_buttons"       // Message with 10 buttons
  | "empty_content"     // Nodes with empty content
  | "long_timer"        // 24-hour timer
  | "many_webhooks";    // 10 sequential webhooks

const edgeCase = generateEdgeCaseJourney("wide_branch", 42);
```

---

## File Structure

```
packages/engine/src/
├── validation/
│   ├── graph-utils.ts      # Graph algorithms (DFS, cycles, reachability)
│   ├── journey-validator.ts # Validation logic
│   └── index.ts            # Exports
├── __tests__/
│   ├── generators/
│   │   ├── node-generators.ts    # Node generation utilities (all node types)
│   │   ├── journey-generator.ts  # Journey generation functions
│   │   └── index.ts              # Exports
│   ├── validation.test.ts        # Structure validation tests
│   ├── property-based.test.ts    # Property-based tests
│   └── chaos.test.ts             # Chaos/failure tests
```

### Supported Node Types

Generators cover the core node types used in randomized journeys (agent/questionnaire nodes are not generated yet):

| Node Type | Generator Function | Options |
|-----------|-------------------|---------|
| Start | `generateStartNode()` | `realistic`, `includeMedia`, `includeTagAction`, `includeVariableAction` |
| End | `generateEndNode()` | `realistic`, `includeTagAction`, `includeVariableAction` |
| Message | `generateMessageNode()` | `responseType`, `includeButtons`, `includeTimer`, `realistic`, `includeMedia`, `includeStoreResponse` |
| Condition | `generateConditionNode()` | `branchCount`, `includeDefault`, `useExpression` |
| Wait | `generateWaitNode()` | `durationSeconds` |
| Webhook | `generateWebhookNode()` | `useMock`, `includeAuth`, `includeStoreAs`, `includeSuccessPath`, `includeTemplateBody` |
| CRM | `generateCrmNode()` | `action`, `includePipelineId`, `includeStageId`, `includeNotes` |
| Teleport | `generateTeleportNode()` | `targetJourneyId`, `targetNodeId`, `preserveContext` |

---

## Reproducibility

All generators use seeded random number generation for reproducibility:

```typescript
import { SeededRandom, setGeneratorSeed } from "@journey/engine/__tests__/generators";

// Set global seed
setGeneratorSeed(12345);

// Or create isolated RNG
const rng = new SeededRandom(12345);
console.log(rng.int(1, 100));    // Deterministic integer
console.log(rng.bool(0.5));      // Deterministic boolean
console.log(rng.pick(["a", "b"])); // Deterministic pick
```

When a test fails, note the seed and use it to reproduce:

```bash
# Reproduce specific failure
FUZZY_SEED=12345 FUZZY_JOURNEY_COUNT=1 pnpm -C packages/engine test:fuzzy
```

---

## Integration with CI

Recommended CI configuration:

```yaml
# Fast validation on every commit
- name: Validate Journey Structure
  run: pnpm -C packages/engine test:validation

# Thorough fuzzy testing on PRs
- name: Fuzzy Testing
  run: FUZZY_JOURNEY_COUNT=200 pnpm -C packages/engine test:fuzzy:all

# Extended testing on main branch
- name: Extended Fuzzy Testing
  run: FUZZY_JOURNEY_COUNT=1000 pnpm -C packages/engine test:fuzzy:all
  if: github.ref == 'refs/heads/main'
```

---

## Adding New Validations

To add a new validation rule:

1. Add error/warning code to `ValidationErrorCode` type
2. Create validation function in `journey-validator.ts`
3. Call it from `validateJourneyStructure`
4. Add test cases in `validation.test.ts`

Example:

```typescript
// In journey-validator.ts
export function validateMyRule(journey: JourneyConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for issues
  if (/* condition */) {
    errors.push({
      code: "MY_ERROR_CODE",
      severity: "error", // or "warning"
      message: "Description of the issue",
      nodeId: node.id,
    });
  }

  return errors;
}

// Add to validateJourneyStructure
errors.push(...validateMyRule(journey));
```

---

## Adding New Generator Types

To add a new journey generator:

1. Create generator function in `journey-generator.ts`
2. Export from `index.ts`
3. Add tests in appropriate test file

Example:

```typescript
export function generateMySpecialJourney(
  options: { seed?: number } = {}
): JourneyConfig {
  const rng = options.seed ? new SeededRandom(options.seed) : getRandom();
  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  // Build journey structure
  const start = generateStartNode("start", rng);
  nodes.push(start);
  // ... add more nodes and edges

  return { nodes, edges };
}
```
