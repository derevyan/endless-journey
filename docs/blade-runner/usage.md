# Blade Runner Usage

## CLI

```bash
pnpm blade-runner <journey.json> [options]
```

Blade Runner expects a journey JSON file. It supports both formats:

```json
{
  "nodes": [],
  "edges": []
}
```

```json
{
  "name": "My Journey",
  "description": "Optional",
  "configuration": {
    "nodes": [],
    "edges": []
  }
}
```

If a `content.json` exists in the same directory as the journey file, Blade Runner merges it automatically.

## Pre-flight Check

Use the analyzer for a fast structural check before running variations:

```bash
pnpm journey:analyze ./journey.json
```

## Test Levels

The CLI exposes fixed test levels that map to concrete exploration settings.

| Level    | Flag         | maxPaths | fastMode | textSampleCount | race tests | concurrency |
| -------- | ------------ | -------- | -------- | --------------- | ---------- | ----------- |
| Quick    | `--quick`    | 1        | true     | 1               | false      | 100         |
| Standard | `--standard` | 10       | true     | 2               | false      | 500         |
| Thorough | `--thorough` | 100      | true     | 4               | false      | 500         |
| Full     | `--full`     | 1000     | false    | 8               | true       | 500         |

Notes:

- `fastMode=true` uses additive variation generation (faster).
- `fastMode=false` uses the full cartesian product (slower but exhaustive).
- `--parallel` overrides the concurrency above.
- Telegram parity runs default to `--parallel 4` unless overridden.

## Options

| Option                         | Description                                  | Default        |
| ------------------------------ | -------------------------------------------- | -------------- |
| `-h, --help`                   | Show help                                    | -              |
| `-v, --version`                | Show version                                 | -              |
| `-1, --quick`                  | Quick scan                                   | -              |
| `-2, --standard`               | Standard coverage                            | -              |
| `-3, --thorough`               | Thorough coverage                            | -              |
| `-4, --full`                   | Full coverage                                | -              |
| `-f, --format <fmt>`           | Output: `text`, `json`, `junit`, `markdown`  | `text`         |
| `--output <path>`              | Write report to file or directory            | -              |
| `--seed <number>`              | Deterministic variations                     | current time   |
| `--filter <pattern>`           | Run only matching variation IDs/descriptions | -              |
| `--time-scale <num>`           | Scale delays and timers                      | `0.01`         |
| `--backend <name>`             | `engine` or `telegram-parity`                | `engine`       |
| `--mock-llm`                   | Force mock LLM responses                     | parity default |
| `--real-llm`                   | Disable mock LLM responses                   | -              |
| `--parity-wait-ms <n>`         | Max wait per parity step (ms)                | `3000`         |
| `--parity-poll-ms <n>`         | Poll interval for parity (ms)                | `50`           |
| `--parity-freeze-timers`       | Pause session timers between inputs          | parity default |
| `--no-parity-freeze-timers`    | Let timers run between inputs                | -              |
| `--parity-strip-media`         | Skip media sends in parity runs              | parity default |
| `--no-parity-strip-media`      | Allow media sends in parity runs             | -              |
| `--parity-user <id>`           | Mock user key for parity auth                | `user-demo`    |
| `--preset <name>`              | Apply an execution preset                    | -              |
| `--list-presets`               | List available presets                       | -              |
| `--sandbox-strict`             | Enforce Telegram API constraints             | `false`        |
| `--fail-fast`                  | Stop on first failure                        | `true`         |
| `--no-fail-fast`               | Run all variations                           | -              |
| `-p, --parallel <n>`           | Max concurrent executions                    | level default  |
| `-t, --timeout <ms>`           | Timeout per variation                        | `120000`       |
| `--batch` / `--no-interactive` | Force batch mode                             | interactive    |
| `--verbose`                    | Show detailed logs                           | `false`        |

## Interactive Mode

Interactive mode is the default when you do not pass a test level or `--format`.

In interactive mode, Blade Runner also prompts for:

- Execution backend (engine vs telegram-parity)
- Preset selection for the chosen backend
- Optional advanced overrides (parallelism, time scale, parity wait/poll, etc.)

Dashboard controls (TTY only):

- `q` quit
- `p` pause/resume
- `f` toggle fail-fast
- `+` / `=` speed up (multiply time scale by ~1.5x - tests run faster)
- `-` / `_` slow down (divide time scale by ~1.5x - tests run slower)

## Custom Test Level

In interactive mode, select **Custom** to configure all test parameters:

| Parameter         | Description                                          | Range     |
| ----------------- | ---------------------------------------------------- | --------- |
| `maxPaths`        | Number of unique paths to explore                    | 1-1000    |
| `textSampleCount` | Text variations per interactive input                | 1-10      |
| `fastMode`        | Additive generation (fast) vs Cartesian (thorough)   | true/false|
| `includeRaceTests`| Enable race condition scenarios for timer nodes      | true/false|
| `concurrency`     | Maximum parallel variation executions                | 1-1000    |

This allows fine-grained control beyond the preset Quick/Standard/Thorough/Full levels.

## Execution Presets

Presets apply curated settings for speed, stability, or debug workflows. You can still override any setting with flags.

Use:

```bash
pnpm blade-runner ./journey.json --preset parity-stable
```

Available presets:

| Preset          | Backend           | Default Level (when not explicitly set) | Notes |
| --------------- | ----------------- | -------------------------------------- | ----- |
| `engine-default`| `engine`          | `standard`    | Default engine timings |
| `engine-fast`   | `engine`          | `standard`    | Time scale `0.001`, high parallelism |
| `engine-debug`  | `engine`          | `standard`    | Time scale `0.05`, parallel `1` |
| `parity-fast`   | `telegram-parity` | `standard`    | Max speed parity, timers may diverge from real-time behavior |
| `parity-stable` | `telegram-parity` | `standard`    | Recommended parity defaults for real behavior |
| `parity-debug`  | `telegram-parity` | `quick`       | Low concurrency, sandbox strict |

In the interactive menu, the selected test level is always respected; presets only apply execution settings.

List presets from the CLI:

```bash
pnpm blade-runner --list-presets
```

## Race Condition Testing

The **Full** test level (and custom configurations with `includeRaceTests: true`) includes race condition testing for nodes with timers.

Race tests verify deterministic engine behavior under timing-sensitive scenarios:

| Scenario       | Description                                          |
| -------------- | ---------------------------------------------------- |
| `user_first`   | User responds before timeout fires                   |
| `timeout_first`| Timeout fires before user responds                   |
| `concurrent`   | Both events arrive at nearly the same time           |

This ensures the engine handles edge cases correctly regardless of event timing.

## Interactive Review

When tests complete with failures (in interactive mode), you can review results:

- **View issues**: See detailed context for each failure (node path, expected vs actual)
- **Suggested fixes**: Get recommendations for resolving issues
- **Export results**: Save to JSON, Markdown, or JUnit format
- **Rerun tests**: Re-execute specific variations
- **Continue**: Exit review and proceed with more tests

## Common Commands

```bash
# Interactive menu
pnpm blade-runner ./journey.json

# Standard run with JSON output for CI
pnpm blade-runner ./journey.json --standard --format json --output tmp/report.json

# Reproduce a specific variation
pnpm blade-runner ./journey.json --seed 1767015016211 --filter "path-12"

# Telegram parity (preset)
pnpm blade-runner ./journey.json --preset parity-stable

# Telegram parity with fast timings
pnpm blade-runner ./journey.json \
  --standard --backend telegram-parity --mock-llm \
  --parity-wait-ms 1000 --parity-poll-ms 25 \
  --parallel 10 --no-fail-fast
```
