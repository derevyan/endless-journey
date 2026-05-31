# Refactor Selected Code (Lead Architect Standard)

## 🎯 Goal
Refactor the **selected code** to meet the highest architectural standards.

---

## 🛡️ The Checklist

### 1. Structural Hygiene
- [ ] **Extract**: Is function >50 lines? Extract sub-functions.
- [ ] **Move**: Is this generic logic? Move to `shared/lib`.
- [ ] **Rename**: Are variables descriptive? (e.g., `isJourneyLoaded` vs `flag`).

### 2. Architectural Patterns
- [ ] **State**: Replace `useState` sync with derived state or `useStore` selectors.
- [ ] **Services**: Guard optional services with `services.has()`.
- [ ] **Types**: Replace manual interfaces with `z.infer<typeof Schema>` from `@journey/schemas`.
- [ ] **Query**: Ensure proper key invalidation if this is a mutation (`setQueryClient`).

### 3. Performance
- [ ] **Memo**: Wrap expensive calculations/components in `useMemo`/`memo`.
- [ ] **Loops**: strict checking on O(n^2) nested loops.

### 4. Safety
- [ ] **Types**: Remove `any`, `unknown` (unless strictly guarded).
- [ ] **Logs**: Convert `console.log` to `@journey/logger`.
- [ ] **Errors**: Convert generic errors to strictly typed `DomainError`.

---

## 🚀 Execution
1. **Plan**: Analyze the selection.
2. **Refactor**: Apply changes.
3. **Explain**: explicit summary of *why* changes were made.
