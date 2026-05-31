# Blade Runner

Blade Runner is the Journey testing CLI. It explores execution paths, generates input variations, runs them against the engine or the Telegram parity backend, and produces coverage plus diagnostics.

## Quick Start

```bash
# Quick smoke test
pnpm blade-runner apps/web/src/data/journeys/saas-onboarding/journey.json --quick

# Standard run with JSON output
pnpm blade-runner apps/web/src/data/journeys/saas-onboarding/journey.json \
  --standard --format json --output tmp/blade-runner.json

# Telegram parity run (API + adapter pipeline)
pnpm blade-runner apps/web/src/data/journeys/saas-onboarding/journey.json \
  --standard --backend telegram-parity --mock-llm --no-fail-fast
```

## Documentation Map

- `docs/blade-runner/usage.md`
- `docs/blade-runner/architecture.md`
- `docs/blade-runner/backends.md`
- `docs/blade-runner/outputs.md`
- `docs/blade-runner/troubleshooting.md`

## Key Locations

- CLI entrypoint: `packages/engine/bin/blade-runner.ts`
- Blade Runner UI and diagnostics: `packages/engine/src/testing/blade-runner/`
- Core testing runtime: `packages/engine/src/testing/`
- Backends: `packages/engine/src/testing/backends/`
- Telegram parity harness + sandbox: `apps/api/src/testing/`
