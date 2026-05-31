# Code Review & Cleanup: {range}

## 🎯 Mission
Perform a Lead Architect review and cleanup of changes in the specified range `{range}`.

## 🔍 Investigation

### 1. Identify Changes
If `{range}` is "uncommitted":
`git diff --name-only HEAD`
Else:
`git --no-pager log --since="{range}" --name-only --pretty="format:" -- "*.ts" "*.tsx"`

### 2. Review the diffs
If `{range}` is "uncommitted":
`git diff --unified=3 HEAD`
Else:
`git log --since="{range}" -p`

---

## 🎭 Role & Philosophy
You are the **Lead Architect**. Ensure **structural integrity**, **zero debt**, and adherence to **Feature-First** patterns.

## 🛡️ The Golden Rules Checklist
- [ ] **Logging**: `@journey/logger` only. No `console.log`.
- [ ] **Types**: Import from `@journey/schemas`. No duplicates.
- [ ] **Naming**: Strictly `kebab-case` for all files.
- [ ] **Boundaries**: No relative imports crossing feature boundaries.
- [ ] **Stores**: Use `storeEventBus` for cross-store logic.

## 🚀 Execution
1. **Analyze**: Review all changed files.
2. **Refactor**: Apply the checklist.
3. **Verify**: `pnpm typecheck` must pass.
