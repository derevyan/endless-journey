# Journey Variation Tester

A developer CLI tool that systematically explores and tests all possible execution paths through a journey graph, including input variations and race conditions.

For full Blade Runner documentation, see `docs/blade-runner/README.md`.

## Overview

The Variation Tester helps ensure journey quality by:

- **Path Coverage**: Testing every possible path from START to END nodes
- **Input Variations**: Testing all button clicks, text inputs, and timeout scenarios
- **Race Condition Testing**: Verifying behavior when user actions and timeouts compete
- **Coverage Reporting**: Tracking node, edge, branch, and input coverage
- **Error Diagnosis**: Distinguishing between journey design issues and engine bugs

## Pre-flight Check

Before running variation tests, use the [Journey Analyzer](./journey-analyzer.md) for fast structural validation:

```bash
# Quick structural analysis (~3ms)
pnpm journey:analyze ./journey.json

# Then run variation tests
pnpm blade-runner ./journey.json --quick
```

The analyzer catches most structural issues (missing edges, cycles, unreachable nodes) in milliseconds, saving time before expensive variation testing.

## Quick Start

### Blade Runner (Interactive CLI - Recommended)

```bash
# From packages/engine directory
cd packages/engine

# Interactive mode - shows menu
pnpm blade-runner ./journey.json

# Quick scan (~10 variations)
pnpm blade-runner ./journey.json --quick

# Standard test (~100 variations)
pnpm blade-runner ./journey.json --standard

# Thorough test (~500 variations)
pnpm blade-runner ./journey.json --thorough

# Full coverage (~2000 variations)
pnpm blade-runner ./journey.json --full
```

### Legacy CLI

```bash
# From root directory
pnpm journey:test ./apps/web/src/data/journeys/saas-onboarding/journey.json

# From packages/engine directory
cd packages/engine
pnpm journey-test ../../apps/web/src/data/journeys/saas-onboarding/journey.json
```

## Blade Runner - Interactive CLI

Blade Runner is an intelligent, interactive journey testing tool that provides:

- **Test Levels**: Choose from quick scan to full coverage
- **Error Diagnosis**: Distinguishes journey design issues from engine bugs
- **Enhanced Reporting**: Node context, timing breakdown, root cause analysis
- **Interactive Review**: Step through issues one by one
- **Export Formats**: JSON, Markdown, or text reports

### Test Levels

| Level    | Flag             | Variations | Use Case                      |
| -------- | ---------------- | ---------- | ----------------------------- |
| Quick    | `-1, --quick`    | ~10        | Smoke test during development |
| Standard | `-2, --standard` | ~100       | Regular testing               |
| Thorough | `-3, --thorough` | ~500       | Pre-release validation        |
| Full     | `-4, --full`     | ~2000      | Complete coverage audit       |

### CLI Options

| Option                      | Description                                        | Default        |
| --------------------------- | -------------------------------------------------- | -------------- |
| `-h, --help`                | Show help message                                  | -              |
| `-v, --version`             | Show version                                       | -              |
| `-1, --quick`               | Quick scan (~10 variations)                        | -              |
| `-2, --standard`            | Standard test (~100 variations)                    | -              |
| `-3, --thorough`            | Thorough test (~500 variations)                    | -              |
| `-4, --full`                | Full coverage (~2000 variations)                   | -              |
| `-f, --format <fmt>`        | Output format: `text`, `json`, `junit`, `markdown` | `text`         |
| `--output <path>`           | Write report to file or directory                  | -              |
| `--fail-fast`               | Stop on first failure                              | `true`         |
| `--no-fail-fast`            | Run all variations even on failures                | -              |
| `-p, --parallel <n>`        | Max concurrent executions                          | level default  |
| `-t, --timeout <ms>`        | Timeout per variation                              | `120000`       |
| `--time-scale <n>`          | Scale delays/timeouts (0.01 = 100x faster)         | `0.01`         |
| `--backend <name>`          | Execution backend: `engine`, `telegram-parity`     | `engine`       |
| `--mock-llm`                | Force mock LLM (default for parity)                | -              |
| `--real-llm`                | Disable mock LLM                                   | -              |
| `--parity-wait-ms <n>`      | Max wait per parity step                           | `3000`         |
| `--parity-poll-ms <n>`      | Parity poll interval                               | `50`           |
| `--parity-freeze-timers`    | Pause timers between inputs                        | parity default |
| `--no-parity-freeze-timers` | Let timers run normally                            | -              |
| `--sandbox-strict`          | Enforce Telegram API constraints                   | `false`        |
| `--batch`                   | Force batch mode (no interactive menu)             | -              |
| `--verbose`                 | Show detailed logs                                 | `false`        |

Note: Blade Runner runs in a single process. Worker threads are available in the programmatic API only.

### Examples

```bash
# Interactive mode with menu
pnpm blade-runner ./journey.json

# Quick smoke test
pnpm blade-runner ./journey.json --quick

# Standard test with JSON output for CI
pnpm blade-runner ./journey.json --standard --format json

# Thorough test, continue on failures
pnpm blade-runner ./journey.json --thorough --no-fail-fast

# Full coverage with markdown report
pnpm blade-runner ./journey.json --full --format markdown > report.md

# Telegram parity backend
pnpm blade-runner ./journey.json --standard --backend telegram-parity --mock-llm
```

### Enhanced Error Reporting

When failures occur, Blade Runner provides detailed engineering information:

```
═════════════════════════════════════════════════════════════════

  ⏰ TIMEOUT at sim-role-1

  ERROR:
    Operation timed out after 30000ms

  NODE DETAILS:
    Type:     message
    Label:    SIM Role 1
    Delay:    3s (wait before send)
    Response: auto (no buttons)
    Edge:     → sim-role-2 (default)

  EXECUTION PATH:
    msg-1 → v1-button → v1 → node-2 → q1 → branch-money →
    v2-button → v2 → node-4 → a1 → sim-welcome → node-7 →
    sim-role-1 → ❌

  TIMING:
    Duration: 15.0s
    Trigger:  forceEdgeTransition (30000ms limit)

  ROOT CAUSE ANALYSIS:
    ⚠ Node has 3s delay but runner expected immediate transition
    ⚠ Handler was likely sleeping when force-transition was called
    → Likely engine bug: test runner races handler delays

  AFFECTED: 109 variations

  REPRODUCE:
    pnpm blade-runner ./journey.json --seed 1767015016211

═════════════════════════════════════════════════════════════════
```

### Issue Categories

Blade Runner classifies issues into categories:

| Category        | Icon | Description                             |
| --------------- | ---- | --------------------------------------- |
| Journey Design  | 🎨   | User's journey has a structural problem |
| Engine Bug      | 🐛   | Engine behaved unexpectedly             |
| Test Limitation | 🧪   | Test infrastructure limitation          |
| Timeout         | ⏰   | Operation took too long                 |
| Unknown         | ❓   | Needs manual investigation              |

### Markdown Export

The markdown export includes enhanced engineering details:

```bash
pnpm blade-runner ./journey.json --standard --format markdown > report.md
```

The report includes:

- Summary with pass/fail counts
- Coverage metrics (nodes, edges, branches)
- Issues with node details table
- Timing breakdown
- Root cause analysis
- Reproduction command with seed
- Uncovered nodes/edges tables

## Legacy CLI Options (journey-test)

| Option               | Description                              | Default      |
| -------------------- | ---------------------------------------- | ------------ |
| `-h, --help`         | Show help message                        | -            |
| `-v, --version`      | Show version                             | -            |
| `-f, --format <fmt>` | Output format: `text`, `json`, `junit`   | `text`       |
| `-c, --coverage`     | Show detailed coverage report            | `false`      |
| `--fail-fast`        | Stop on first failure                    | `false`      |
| `-p, --parallel <n>` | Max concurrent executions                | `500`        |
| `-t, --timeout <ms>` | Timeout per variation                    | `30000`      |
| `-s, --seed <n>`     | Random seed for reproducibility          | current time |
| `-r, --race-tests`   | Include race condition tests             | `false`      |
| `--fast`             | Fast mode: additive variation generation | `false`      |
| `--filter <pattern>` | Filter variations by ID/description      | -            |
| `--max-paths <n>`    | Max paths to explore                     | `1000`       |
| `-I, --interactive`  | Interactive mode (pause on failure)      | TTY default  |
| `--no-interactive`   | Force batch mode                         | -            |
| `--verbose`          | Show detailed logs                       | `false`      |

## Programmatic Usage

```typescript
import { VariationTester, testJourney } from "@journey/engine/testing";

// Quick test
const result = await testJourney(journey);
console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);

// Full control
const tester = new VariationTester(journey, {
  maxPaths: 500,
  maxDepth: 100,
  includeDeadEnds: true,
  textSampleCount: 3,
  includeRaceTests: true,
  fastMode: true,
  concurrency: 200,
  workers: 0, // Auto: use CPU count
  timeScale: 0.01, // Fast clock
  timeout: 120000,
  failFast: true,
  seed: 12345,
  format: "json",
  filter: "path-3",
  journeyPath: "./journey.json", // For identification in reports
});

const output = await tester.runFormatted();
console.log(output);

// Get stats without running
const stats = tester.getStats();
console.log(`Estimated variations: ${stats.estimatedVariations}`);
```

## Architecture

```
blade-runner <journey.json>
        │
        ▼
┌─────────────────┐
│  BladeRunner    │ (interactive menu, diagnosis)
│     Menu        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│VariationTester  │ (orchestrator)
└────────┬────────┘
         │
    ┌────┴────┬──────────────┐
    ▼         ▼              ▼
┌────────┐ ┌────────┐ ┌─────────────┐
│Variation│ │Variation│ │RaceCondition│
│Explorer │ │Runner   │ │Tester       │
└────────┘ └────────┘ └─────────────┘
    │          │              │
    └──────────┴──────────────┘
               │
               ▼
        ┌─────────────┐
        │MockMessaging│
        │Adapter      │
        └─────────────┘
               │
               ▼
        ┌─────────────┐
        │  Diagnosis  │ (error classification)
        │   Engine    │
        └─────────────┘
               │
               ▼
        ┌─────────────┐
        │  Reporter   │ (enhanced output)
        └─────────────┘
```

### Components

| Component             | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `BladeRunner Menu`    | Interactive test level selection                     |
| `VariationExplorer`   | Discovers all paths and generates input combinations |
| `VariationRunner`     | Executes variations against SessionEngine            |
| `CoverageTracker`     | Tracks node/edge/branch/input coverage               |
| `RaceConditionTester` | Tests timing scenarios for timer nodes               |
| `Diagnosis Engine`    | Classifies errors as journey design vs engine bugs   |
| `Reporter`            | Enhanced console and export formatting               |

## Coverage Metrics

### Node Coverage

Tracks which nodes were visited during testing.

### Edge Coverage

Tracks which edges (transitions) were traversed.

### Branch Coverage

For condition nodes, tracks which branches were taken.

### Input Coverage

For interactive nodes, tracks:

- Which buttons were clicked
- Whether text input was tested
- Whether timeout was tested

## Fast Mode vs Exhaustive Mode

The tester supports two variation generation modes:

### Fast Mode (`--fast` or use test levels) - Recommended

Uses **additive** variation generation:

- Tests each input option independently
- N inputs across all nodes = N+1 variations
- Much faster, good for most testing needs

```bash
# Using blade-runner test levels
pnpm blade-runner ./journey.json --quick     # ~10 variations
pnpm blade-runner ./journey.json --standard  # ~100 variations

# Using legacy CLI
pnpm journey:test ./journey.json --fast
```

### Exhaustive Mode

Uses **cartesian product** variation generation:

- Tests all combinations of inputs
- N₁ × N₂ × N₃ variations (can explode exponentially)
- More thorough, but much slower

```bash
# Full coverage with blade-runner
pnpm blade-runner ./journey.json --full

# Legacy CLI without fast mode
pnpm journey:test ./journey.json
```

## Handling Large Journeys

Complex journeys can generate thousands of variations due to combinatorial explosion. Use these strategies:

```bash
# Use blade-runner test levels (recommended)
pnpm blade-runner ./journey.json --quick      # Start small
pnpm blade-runner ./journey.json --standard   # Normal testing

# Legacy CLI options
pnpm journey:test ./journey.json --fast       # Fast mode
pnpm journey:test ./journey.json --max-paths 50
pnpm journey:test ./journey.json --filter "path-0"
```

## Race Condition Testing

When `--race-tests` is enabled (or using thorough/full test levels), timer nodes are tested with three scenarios:

| Scenario        | Description                              |
| --------------- | ---------------------------------------- |
| `user_first`    | User responds before timeout fires       |
| `timeout_first` | Timeout fires before user responds       |
| `concurrent`    | Both events arrive nearly simultaneously |

This helps verify the engine handles timing edge cases correctly.

## Troubleshooting

### "Exceeded maximum steps"

The variation hit a loop or deadlock. Check:

- Journey has proper exit conditions
- Condition nodes have default branches
- No infinite loops in the graph

### Low Coverage

- Use higher test level (`--thorough` or `--full`)
- Remove `--filter` to test all variations
- Use `--race-tests` for timer coverage

### Slow Execution

- Use lower test level (`--quick` or `--standard`)
- Decrease `--parallel` if system is overloaded
- Use `--filter` to test specific scenarios

### Timeouts

- Increase `--timeout` for journeys with many delayed nodes
- Check if nodes have large delay values (cumulative delays can exceed timeout)
- Default timeout is 120 seconds to handle complex paths

## API Reference

See the [testing module exports](/packages/engine/src/testing/index.ts) for full API documentation.
