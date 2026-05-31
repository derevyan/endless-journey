# Legacy Code Destroyer (Backward Compatibility)

## 🎯 Mission
**Search and Destroy.** We do not support backward compatibility for this stage of the project. We are building the future, not maintaining the past.

---

## 🔍 Search Targets

### 1. Explicit Deprecations
- Search: `@deprecated`
- Search: `/** @deprecated */`
- Action: **DELETE**. If used, refactor the consumer to use the new method.

### 2. "Compat" shims
- Search: `legacy`, `compat`, `backward`, `v1_`, `old_`
- Action: **Investigate & Delete**.

### 3. Dual-Mode Logic
- Search: `if (newWay) { ... } else { ...oldWay... }`
- Action: **Remove the else block**. Make `newWay` the ONLY way.

---

## 🛡️ Rules of Engagement
1. **No Mercy**: If it's deprecated, it goes.
2. **Fix Consumers**: Do not just delete definition; update the caller to the new API.
3. **Verify**: Run `pnpm typecheck` after every deletion batch.
