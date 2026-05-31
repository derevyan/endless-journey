# Plan Critiquer (Architecture Review)

## 🎯 Goal
Review an `implementation_plan.md` or proposed approach against the system architecture.

---

## 🛡️ The Architect's Criteria

### 1. Alignment
- [ ] **Project Structure**: Does the plan place code in the correct feature/layer? (`docs/dev/architecture/project-structure.md`)
- [ ] **Package Rules**: Does it respect the dependency hierarchy? (No `db` in `web`?)

### 2. Simplicity & Standards
- [ ] **Over-Engineering**: Is there a simpler way? (e.g. usage of `shared/` tool vs building new).
- [ ] **Golden Rules**: Does it mention manual logging? (Reject). Does it mention strict types? (Accept).

### 3. Safety Check
- [ ] **Migrations**: Does it propose complex migrations? (Reject -> `db:reset-full`).
- [ ] **Testing**: Does it include a plan for *Flow Tests*?

---

## 🚀 Output
Provide a critique: "Approved", "Changes Requested" (with list), or "Rejected" (fundamental flaw).
