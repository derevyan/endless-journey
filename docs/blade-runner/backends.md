# Blade Runner Backends

Blade Runner supports multiple execution backends. Each backend receives the same variations but executes them through different pipelines.

## Engine Backend (default)

**Name:** `engine`

- Executes variations directly against the in-process Journey engine.
- Uses `VariationRunner` to drive the SessionEngine.
- Fast and deterministic.
- Supports worker threads (backend reports `supportsWorkers=true`), but the CLI currently runs in-process only.

## Telegram Parity Backend

**Name:** `telegram-parity`

Executes variations through the real API + Telegram adapter pipeline using a local harness and sandbox.

What it spins up:

- **API Harness**: a local Hono server created by `apps/api/src/testing/api-harness/`.
- **Telegram Sandbox**: a fake Telegram API server created by `apps/api/src/testing/telegram-sandbox/`.

What it exercises:

- Webhook handling
- Adapter formatting
- API session state
- Timer behavior
- Event bus + timer service wiring
- Agent workflows (auto-seeded from `apps/web/src/data/workflows/<key>/workflow.json` when missing)

### Defaults and Environment

When running with `--backend telegram-parity`, Blade Runner sets/uses:

| Variable                         | Purpose                     | Default                      |
| -------------------------------- | --------------------------- | ---------------------------- |
| `FORCE_MOCK_LLM`                 | Force mock LLM responses    | `true` (unless `--real-llm`) |
| `TELEGRAM_PARITY_WAIT_MS`        | Max wait per step           | `3000`                       |
| `TELEGRAM_PARITY_POLL_MS`        | Poll interval               | `50`                         |
| `TELEGRAM_PARITY_TIME_SCALE`     | Timer scaling               | `0.01`                       |
| `TELEGRAM_PARITY_FREEZE_TIMERS`  | Pause timers between inputs | `true`                       |
| `TELEGRAM_PARITY_STRIP_MEDIA`    | Skip media sends            | `true`                       |
| `TELEGRAM_PARITY_MOCK_USER_ID`   | Mock auth user key          | `user-demo`                  |
| `TELEGRAM_PARITY_CHANNEL_ID`     | Channel ID for parity runs  | static test UUID             |
| `TELEGRAM_PARITY_BOT_TOKEN`      | Bot token used by sandbox   | static test token            |
| `TELEGRAM_PARITY_WEBHOOK_SECRET` | Webhook secret              | `blade-runner-secret`        |
| `TELEGRAM_PARITY_FORCE_EXIT`     | Force exit-to-next-node     | `true`                       |
| `TELEGRAM_API_BASE`              | Telegram API base URL       | sandbox URL                  |
| `ALLOW_MOCK_AUTH`                | Allow mock user auth        | `true`                       |
| `NODE_ENV`                       | Runtime mode                | `test`                       |

### Flags

- `--parity-wait-ms` and `--parity-poll-ms` control the polling loop.
- `--parity-freeze-timers` pauses timers between inputs to reduce flakiness.
- `--no-parity-freeze-timers` lets timers run normally.
- `--parity-strip-media` skips media uploads to avoid missing asset failures.
- `--no-parity-strip-media` keeps media sends enabled.
- `--parity-user` overrides the mock user (`X-Mock-User-Id`) for parity runs.
- `--sandbox-strict` enforces Telegram API constraints (e.g., button lengths).

### Parallelism

The parity backend does not support workers and defaults to `--parallel 4`. You can raise `--parallel` to speed up runs, but watch API and DB load.

### Presets

Use presets to apply recommended parity configurations without wiring all flags:

```bash
pnpm blade-runner ./journey.json --preset parity-stable
```

Run `pnpm blade-runner --list-presets` to see all available presets.
