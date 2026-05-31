# Useless Test Cleaner (Trivia Hunter)

## 🎯 Mission
Find and remove low-value tests that slow down CI without catching bugs.

---

## 🔍 Targets

### 1. The "Zod Validator"
- **Pattern**: Tests that import a schema and just verify it parses valid/invalid data.
- **Why**: Zod is already tested. We trust `z`.
- **Action**: **DELETE**.

### 2. The "Simple Getter"
- **Pattern**: `it('should set value', () => { obj.val = 1; expect(obj.val).toBe(1) })`
- **Why**: You are testing the JavaScript language, not your code.
- **Action**: **DELETE**.

### 3. The "UI Existentialist"
- **Pattern**: `expect(screen.getByText('Title')).toBeInTheDocument()` (without interaction).
- **Why**: Low value. Snapshot tests cover this better if needed.
- **Action**: Evaluate. If it's a critical UI state, keep. If it's just "rendering works", consider implicitly testing via interaction.

---

## 🛡️ Verification
- Run `pnpm test` after deletion to ensure no false positives were anchoring other tests.
