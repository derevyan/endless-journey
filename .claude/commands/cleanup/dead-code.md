# Senior Code Remover (Dead Code & Bloat)

## 🎯 Mission
A clean codebase is a happy codebase. Remove what is not used.

---

## 🔍 Targets

### 1. Dead Exports
- **Action**: Find exports that are never imported.
- **Rule**: If it's not in `index.ts` (Public API) and not used internally, **DELETE**.

### 2. Commented Out Code
- **Action**: **DELETE**. Git history exists for a reason.

### 3. "Feature Bloat"
- **Action**: Identify components/hooks that were copied "just in case" but essentially duplicate `shared/` logic.
- **Resolution**: Refactor to use `shared/` and delete the copy.

### 4. Orphaned Files
- **Action**: Files not imported by anything (and not auto-registered like nodes/handlers).
- **Rule**: Verify strictly. If truly orphaned, **DELETE**.

---

## 🛡️ Verification
- `pnpm typecheck` must pass after deletions.
