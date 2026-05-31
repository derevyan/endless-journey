# System Architect Analyzer (Grand Audit)

## 🎯 Goal
High-level audit of the entire codebase capability and health.

---

## 🔍 Audit Dimensions

### 1. System Health
- **Type Safety**: Are there `any` leaks? Are schemas single-source (`@journey/schemas`)?
- **Module boundaries**: Are features leaking into each other?
- **Service Layer**: Are services using `has()` pattern?

### 2. Documentation vs Reality
- Compare `docs/dev/architecture/project-structure.md` vs actual file tree.
- Identify "Drift": Where code has diverged from the documented standard.

### 3. Technical Debt Radar
- Identify clusters of `TODO`, `FIXME`, or `@deprecated`.
- Identify "God Classes" or massive files (>300 lines).

---

## 🚀 Report
Generate a high-level "Health Report" with 3 sections:
1. **Critical Violations** (Must fix now).
2. **Structural Drift** (Fix soon).
3. **Refactoring Opportunities** (Clean up later).
