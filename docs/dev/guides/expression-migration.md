# Expression Migration Guide (expr-eval -> JEXL)

This guide covers the expression engine change for journey runtime expressions. All engine-side expressions now use JEXL with a shared function registry.

## Affected Areas

- Condition nodes: `expression`
- Guard expressions: `edge.guard.expression`
- Questionnaire skip rules: `question.skipIf`
- Template expressions: `{{= ... }}` in message/webhook templates

## Syntax Changes

- Logical operators: `and` / `or` / `not` -> `&&` / `||` / `!`
- Prefer boolean literals (`true` / `false`) instead of numeric coercion (`1` / `0`)

Examples:

- `score > 50 and level >= 3` -> `score > 50 && level >= 3`
- `not user.blocked` -> `!user.blocked`

## Shared Function Registry

These functions are available everywhere expressions run:

- String: `upper`, `lower`, `trim`, `capitalize`, `length`
- Conditional: `default`, `isEmpty`
- Array: `first`, `last`, `join`, `includes`
- Number: `round`, `floor`, `ceil`, `abs`
- Date: `now`, `formatDate`
- JSON: `json`, `parse`

Transforms (pipe syntax) are available for: `upper`, `lower`, `trim`, `first`, `last`, `length`.

Examples:

- `upper(user.firstName)`
- `user.firstName|trim|upper`
- `default(vars.journey.segment, "default")`

## Migration Checklist

- Replace `and/or/not` operators with `&&/||/!`.
- Validate any conditions that relied on numeric boolean coercion.
- Run `pnpm -C packages/engine test` after updates.
