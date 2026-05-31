# Blade Runner Outputs

Blade Runner can print results to stdout or write them to a file.

## Output Paths

Use `--output <path>` to write a report. If the path is a directory (or ends with `/`), Blade Runner writes:

```
blade-runner-report.<ext>
```

Extensions:

- `json` for JSON
- `md` for markdown
- `xml` for JUnit
- `txt` for text

## Text (default)

The default console output includes:

- Summary of pass/fail counts
- Coverage totals
- Grouped issues with diagnosis (for Blade Runner)
- Interactive review prompt (TTY only)

## Markdown

Use `--format markdown` to emit a report suitable for PRs or docs.

The markdown report includes:

- Summary and coverage
- Issue groups with node context and timing breakdown
- Suggested fixes
- Reproduction hints (seed, filter)

## JSON

`--format json` emits the full `BladeRunnerResult` object. This includes diagnosis and performance data in addition to raw variation results.

Top-level fields (abridged):

```json
{
  "journeyId": "string",
  "journeyName": "string",
  "journeyPath": "string",
  "summary": { "total": 0, "passed": 0, "failed": 0, "skipped": 0, "alternatePaths": 0, "durationMs": 0 },
  "coverage": { "nodes": {}, "edges": {}, "branches": {}, "inputs": {} },
  "results": [{ "variation": {}, "success": true, "status": "passed" }],
  "issues": [{ "issue": {}, "variations": [] }],
  "issueSummary": { "journeyDesign": 0, "engineBugs": 0, "testLimitations": 0, "timeouts": 0, "pathDivergence": 0, "unknown": 0 },
  "testLevel": "standard",
  "performance": { "variationsPerSecond": 0, "avgVariationMs": 0 },
  "seed": 0,
  "timestamp": "ISO-8601",
  "backend": { "name": "engine" }
}
```

## JUnit XML

`--format junit` emits a JUnit-compatible XML test suite. Each variation is a testcase. Failed variations include the error message, path, and visited nodes.

Note: JUnit output is generated from the lower-level `VariationTesterResult` and does not include Blade Runner diagnosis.
