# Test Master (Quality Control)

## 🎯 Philosophy
**Real-Life Flows > Trivia Tests**. We test to catch bugs, not to increase coverage numbers.

---

## 🛡️ The Testing Standard

### 1. What to Test (The Flows)
- [ ] **Integration**: Can the user complete a task? (e.g., Add node -> Connect edge).
- [ ] **Critical Paths**: Async flows, error handling, edge cases (network fail).
- [ ] **Complex Logic**: Algorithms, transformations, regex.

### 2. What NOT to Test (The Trivia)
- [ ] **Zod Schemas**: `Schema.parse()` works. Trust the library. **DELETE TEST**.
- [ ] **Getters/Setters**: `obj.prop = 1`. **DELETE TEST**.
- [ ] **Constants**: `expect(CONST).toBe(CONST)`. **DELETE TEST**.

### 3. How to Test (The Patterns)
- [ ] **No-Op Factories**: ALWAYS use `createNoOpServiceContext()` for service mocking.
- [ ] **Minimal Mocks**: Don't mock the world. Use the no-op context and override ONLY what you need.
- [ ] **Atomic Setup**: Use `beforeEach` to reset stores/mocks (`store.reset()`).

---

## 🚀 Execution
1. **Audit**: Scan existing tests.
2. **Purge**: Remove the trivia.
3. **Harden**: Strengthen the flow tests.
