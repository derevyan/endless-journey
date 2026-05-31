# File Structure Scanner (Architectural Audit)

## 🔍 Investigation

### 1. Map the Territory
Scan the `apps/` and `packages/` directories. Ignore `node_modules`, `dist`, `.git`.
Generate a high-level tree structure.

---

## 🛡️ The Lead Architect Checklist

### 1. Package Hierarchy (The Red Lines)
- [ ] **No Circular Dependencies**: `packages/A` imports `packages/B`, `B` imports `A`. -> **CRITICAL ERROR**.
- [ ] **Strict Layering**: 
    - `schemas` (Level 0) cannot import anything.
    - `logger` (Level 0) cannot import anything except external deps.
    - `db` (Level 1) imports `schemas`, `logger`.
    - `api` / `web` (Level 5) import everything.
- [ ] **No App Leaks**: `packages/*` CANNOT import from `apps/*`.

### 2. Feature Encapsulation (Web)
- [ ] **Location Check**: Does feature code live in `@/features/{name}`?
- [ ] **Structure Check**: Does it follow the pattern?
    ```
    features/{name}/
    ├── components/
    ├── hooks/
    ├── lib/
    ├── store/
    └── index.ts (Public API)
    ```
- [ ] **Shared vs Feature**: Is generic UI code in `shared/components/ui`? Is domain code in `features/`?

### 3. Naming & Hygiene
- [ ] **Kebab-Case**: Are ALL files and directories `kebab-case`?
- [ ] **Barrel Bloat**: Does `index.ts` export *everything* or just the public API?
- [ ] **Colocation**: Are tests colocated (`__tests__`) or unified? (Follow project standard).

---

## 🚀 Execution
1. **Report**: List all violations found.
2. **Plan**: Propose a move/rename plan.
3. **Execute**: (If authorized) Move files and update imports.
