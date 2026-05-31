# Journey Analyzer

Fast O(n+e) structural analysis of journey graphs. Run before variation testing to catch problems early.

## Overview

The Journey Analyzer performs graph-based validation in **milliseconds** (vs minutes for variation testing):

- **Structural validation**: Start/end nodes, connectivity, cycles
- **Edge validation**: Timer edges, condition branches, button connections
- **Metrics**: Path count, depth, bottlenecks, complexity scoring

## Quick Start

```bash
# Basic analysis
pnpm journey:analyze ./apps/web/src/data/journeys/saas-onboarding/journey.json

# Full analysis with bottleneck detection
pnpm journey:analyze ./journey.json --full

# JSON output for CI
pnpm journey:analyze ./journey.json --json
```

## CLI Options

| Option            | Description                       | Default |
| ----------------- | --------------------------------- | ------- |
| `-h, --help`      | Show help message                 | -       |
| `-v, --version`   | Show version                      | -       |
| `--json`          | Output as JSON for CI integration | `false` |
| `--strict`        | Treat warnings as errors          | `false` |
| `--full`          | Include bottleneck detection      | `false` |
| `--max-paths <n>` | Max paths to enumerate            | `10000` |

## Output Example

```
Journey Analysis Report
══════════════════════════════════════════════════

Journey: journey.json
Nodes: 16 | Edges: 25

Structure
────────────────────────────────────────
✓ Start/End: Valid (1 start, 3 end nodes)
✓ Connectivity: All nodes reachable
✓ Cycles: No infinite loops detected

Metrics
────────────────────────────────────────
Paths to END:     1,091
Max depth:        11 nodes
Branching factor: 2.54
Bottlenecks:      feature-intro
Complexity:       🟠 High (61/100)

Time: 4ms
```

## Validation Checks

### Errors (Must Fix)

| Code                                      | Description                                  |
| ----------------------------------------- | -------------------------------------------- |
| `NO_START_NODE`                           | Journey has no start node                    |
| `MULTIPLE_START_NODES`                    | Journey has more than one start node         |
| `NO_END_NODE`                             | Journey has no end node                      |
| `ORPHAN_NODE`                             | Node not reachable from start                |
| `AUTO_TRANSITION_CYCLE`                   | Infinite loop with no user input to break it |
| `MISSING_TIMER_EDGE`                      | Message has timer but no timer edge          |
| `MISSING_CONDITION_BRANCH_EDGE`           | Condition node missing edge for branch       |
| `DANGLING_EDGE_SOURCE/TARGET`             | Edge references non-existent node            |
| `DUPLICATE_NODE_ID` / `DUPLICATE_EDGE_ID` | Non-unique IDs                               |
| `DUPLICATE_BUTTON_IDS`                    | Duplicate button IDs on a node               |
| `INVALID_FOLLOWUP_EXIT_TARGET`            | Follow-up exitPath points to missing node    |
| `INVALID_FOLLOWUP_BUTTON_TARGET`          | Follow-up button targets missing node        |
| `SELF_REFERENCING_FOLLOWUP`               | Follow-up exit path loops back to same node  |

### Warnings (Should Review)

| Code                                 | Description                                             |
| ------------------------------------ | ------------------------------------------------------- |
| `DEAD_END_NODE`                      | Node cannot reach any end node                          |
| `DISCONNECTED_BUTTON`                | Button not connected to any path                        |
| `MISSING_DEFAULT_BRANCH`             | Condition has no default branch                         |
| `MISSING_WEBHOOK_ERROR_EDGE`         | Webhook has no error handling                           |
| `EMPTY_MESSAGE_CONTENT`              | Message node has empty content                          |
| `MISSING_TEXT_RESPONSE_EDGE`         | Text response node has no matching edge                 |
| `MISSING_QUESTIONNAIRE_TIMEOUT_EDGE` | Questionnaire timeout has no path                       |
| `MISSING_AGENT_TIMEOUT_EDGE`         | Agent timeout has no path                               |
| `DUPLICATE_BUTTON_LABELS`            | Duplicate button labels on a node                       |
| `DUPLICATE_NODE_LABEL`               | Duplicate sanitized node labels (nodeOutputs collision) |

## Metrics

### Path Count

Number of unique paths from START to END. If >10,000, shown as `-1` with "path explosion" warning.

### Max Depth

Longest path length (number of nodes from START to END).

### Bottleneck Nodes

Nodes that **all** paths pass through (excluding START/END). These are single points of control in your journey.

### Branching Factor

Average number of outgoing edges per node. Higher = more complexity.

### Complexity Score

0-100 score based on:

- Path count (0-40 points)
- Max depth (0-25 points)
- Branching factor (0-20 points)
- Errors/warnings (0-15 points)

| Level      | Score  | Description                        |
| ---------- | ------ | ---------------------------------- |
| 🟢 Low     | 0-25   | Simple, easy to test               |
| 🟡 Medium  | 26-50  | Moderate complexity                |
| 🟠 High    | 51-75  | Complex, many paths                |
| 🔴 Extreme | 76-100 | Very complex, consider simplifying |

## Programmatic Usage (Internal)

The CLI is the supported interface. For internal tooling inside this repo, import from the source module:

```typescript
// Adjust the relative path to your file location
import { analyzeJourney, formatAnalysisReport } from "../../packages/engine/src/validation/journey-analyzer";

const result = analyzeJourney(journey, {
  maxPaths: 10000,
  maxPathLength: 100,
  includeBottlenecks: true,
});

console.log(`Valid: ${result.valid}`);
console.log(`Paths: ${result.metrics.pathCount}`);
console.log(`Complexity: ${result.metrics.complexity}`);

// Formatted output
console.log(formatAnalysisReport(result, "my-journey.json"));
```

## CI Integration

### GitHub Actions

```yaml
- name: Analyze Journey
  run: pnpm journey:analyze ./journey.json --json > analysis.json

- name: Check for Errors
  run: |
    if [ $(jq '.errors | length' analysis.json) -gt 0 ]; then
      echo "Journey has validation errors"
      exit 1
    fi
```

### Exit Codes

| Code | Meaning                                                  |
| ---- | -------------------------------------------------------- |
| 0    | Valid journey (no errors)                                |
| 1    | Invalid journey (errors, or warnings in `--strict` mode) |

## When to Use

| Tool                  | Use Case                     | Speed    |
| --------------------- | ---------------------------- | -------- |
| `journey:analyze`     | Quick structural validation  | ~3ms     |
| `journey:test --fast` | Input coverage testing       | ~2-5s    |
| `journey:test`        | Exhaustive variation testing | ~minutes |

**Recommended workflow:**

1. Run `journey:analyze` first (catches 90% of issues in milliseconds)
2. If valid, run `journey:test --fast` for input coverage
3. For critical journeys, run full `journey:test`

## Related

- [Variation Tester](./variation-tester.md) - Exhaustive path testing
- [Fuzzy Testing](./fuzzy-testing.md) - Random input testing
