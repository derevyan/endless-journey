# Test Coverage Audit: {target}

## 🎯 Mission
Analyze test coverage for `{target}` and remove "trivia" tests.

## 🛡️ Execution Standards
- **No Trivia**: Delete tests that only check Zod schemas, basic getters, or obvious logic.
- **Focus on Flows**: Tests should check real-life user journeys and integration points.

## 🚀 Workflow

### 1. Analyze Coverage
- Run tests with coverage reporting.
- Identify missing core functionality tests.

### 2. Identify Trivia
- Scan existing test files for overlap or low-value assertions.

### 3. The Plan
Create a proposal in `docs/dev/proposals/active/test-audit-{target}_[DATE]` to:
- Delete specific low-value tests.
- Add missing integration/flow tests.

## ✅ Output
Notify the user with the cleanup plan.
