# Blade Runner Troubleshooting

## Runs Are Slow

Try these in order:

1. Use a smaller test level: `--quick` or `--standard`.
2. Increase parallelism with `--parallel <n>`.
3. Use a lower time scale: `--time-scale 0.01`.
4. Limit variations with `--filter "path-12"` and/or `--seed`.

For Telegram parity runs, reduce wait/poll intervals:

```bash
--parity-wait-ms 1000 --parity-poll-ms 25
```

## Many Timeouts

- Increase `--timeout` for long journeys or large delays.
- Check if nodes have long delay values.
- For parity runs, keep `--parity-freeze-timers` enabled to avoid racing timers.

## Unexpected Alternate Paths

Alternate paths are reported when the engine takes a valid path that does not match the predicted path (for example, condition branches or button handling).

Actions:

- Inspect the issue group details in the report.
- Re-run with `--filter` on the variation ID.
- Verify edge and condition definitions in the journey.

## Telegram Parity Failures

If the parity backend fails to progress:

1. Use `--mock-llm` to avoid real LLM latency.
2. Increase `--parity-wait-ms` if updates are late.
3. Reduce `--parallel` if the API harness is overloaded.
4. Run with `--sandbox-strict` to validate Telegram payload limits.

## Reproducing a Failure

Use the seed and variation ID from the report:

```bash
pnpm blade-runner ./journey.json --seed <seed> --filter "<variation-id>"
```

## No Interactive Controls

Dashboard controls only work in a TTY. If running in CI or with `--batch`, the run is non-interactive.
