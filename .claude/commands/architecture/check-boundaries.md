# Architecture Boundary Check (AUDIT)

## 🎯 Mission
Enforce strict architectural boundaries to prevent "Spaghetti Code".

## 🛠️ Execution Steps

### 1. Check for Forbidden Imports
Run these grep commands to find violations:

**Violation 1: Relative imports crossing features**
```bash
grep -r "\.\./\.\./features" apps/web/src/features | grep -v "node_modules"
```
> Fix: Should use `@/features/...`

**Violation 2: Stores importing other stores directly**
```bash
grep -r "store\.getState\(\)" apps/web/src/stores | grep "import .*store"
```
> Fix: Use `storeEventBus` for cross-store communication.

**Violation 3: Console Logs**
```bash
grep -r "console\.log" apps/web/src | grep -v ".test." | grep -v "node_modules"
```
> Fix: Use `@journey/logger`.

### 2. Verify Store Placement
- `features/{feature}/store` must NOT be imported by other features.

## ✅ Validation
If any commands return output, the architecture check **FAILS**.
Refactor code to fix violations.
