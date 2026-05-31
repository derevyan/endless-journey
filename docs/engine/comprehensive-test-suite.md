# Comprehensive Journey Test Suite

This document covers the Journey engine’s comprehensive and integration tests that validate core node/edge behavior, routing, and failure handling.

## Test Structure

### Test Files

All tests are located in `src/__tests__/` unless otherwise specified.

#### Comprehensive Tests

- **src/__tests__/comprehensive/node-types.comprehensive.test.ts** - Core node types (start/message/condition/wait/webhook/end)
- **src/__tests__/comprehensive/edge-types.comprehensive.test.ts** - Edge types (default/success/timer/retry/dropoff/exit)

#### Integration Tests

- **src/__tests__/session-engine.integration.test.ts** - End-to-end engine flows
- **src/__tests__/session-engine.destroy.test.ts** - Teardown and resource cleanup
- **src/__tests__/session-engine.validate-on-start.test.ts** - Validation preflight behavior
- **src/__tests__/follow-up-plugin.integration.test.ts** - Follow-up plugin sequencing
- **src/__tests__/questionnaire.integration.test.ts** - Questionnaire flows + reminders
- **src/__tests__/webhook-executor.integration.test.ts** - Real HTTP webhook tests
- **src/__tests__/timer-recovery.integration.test.ts** - Timer recovery on session resume

#### Handler Tests

- **src/__tests__/handlers.test.ts** - Handler unit coverage (CRM/Teleport/Agent/etc.)
- **src/__tests__/handler-registry.test.ts** - Registry overrides and handler lookup
- **src/handlers/__tests__/agent-handler.test.ts** - Agent handler specific tests

#### Event System Tests

- **src/__tests__/event-router.test.ts** - Event routing + active buttons + follow-ups
- **src/__tests__/event-queue.test.ts** - Queue serialization + overflow behavior
- **src/__tests__/resolve-transition.test.ts** - Unified transition resolution logic

#### Service Tests

- **src/__tests__/edge-selector.guard-context.test.ts** - Guard context + fallback selection
- **src/__tests__/middleware-pipeline.test.ts** - Tag/variable/CRM middleware ordering
- **src/__tests__/variable-service.strict.test.ts** - Strict variable operations
- **src/__tests__/variable-service.test.ts** - Variable CRUD operations
- **src/__tests__/timer-service.test.ts** - Timer scheduling and cancellation
- **src/__tests__/dlq-service.test.ts** - DLQ persistence + error recording
- **src/__tests__/condition-evaluator.test.ts** - Condition expression and rule evaluation
- **src/__tests__/expression-service.test.ts** - JEXL expression evaluation
- **src/__tests__/template-service.test.ts** - Template variable substitution
- **src/__tests__/webhook-executor.test.ts** - HTTP requests, retries, and circuit breakers
- **src/__tests__/bindings-context.test.ts** - Context building and namespace resolution
- **src/__tests__/service-factory.history-retention.test.ts** - History retention policies
- **src/services/__tests__/service-factory.uuid.test.ts** - UUID generation in service factory

#### Utility Tests

- **src/__tests__/node-outputs.test.ts** - Cross-node data storage
- **src/__tests__/output-helpers.test.ts** - Output formatting helpers
- **src/__tests__/timer-helpers.test.ts** - Timer operation helpers
- **src/__tests__/utils.test.ts** - General utility function coverage
- **src/__tests__/retry.test.ts** - Retry and backoff logic
- **src/__tests__/validation.test.ts** - Journey structure validation
- **src/utils/__tests__/conversation-history.test.ts** - Conversation history building

#### Resilience & Edge Case Tests

- **src/__tests__/race-conditions.test.ts** - Timer vs user event races
- **src/__tests__/failure-scenarios.test.ts** - Failure handling and recovery paths
- **src/__tests__/engine-edge-cases.test.ts** - Additional engine edge case coverage
- **src/__tests__/mindstate-analysis.test.ts** - Mindstate analysis triggers

#### Advanced Testing

- **src/__tests__/chaos.test.ts** - Chaos/failure injection tests
- **src/__tests__/property-based.test.ts** - Property-based invariant tests
- **src/__tests__/variation-system.test.ts** - Path variation testing system
- **src/__tests__/timing-profiles.test.ts** - Timing profile simulation
- **src/__tests__/enhanced-coverage.test.ts** - Extended coverage scenarios

Additional node types (CRM, Teleport, Questionnaire, Agent) are covered in handler/integration suites rather than the comprehensive node-type file.

### Fixtures

- **src/__tests__/comprehensive/fixtures/** - Comprehensive journey configs
- **src/__tests__/fixtures/** - Shared fixtures for integration/unit tests

### Test Summary

| Category | Test Files | Tests |
|----------|------------|-------|
| Comprehensive | 2 | 41 |
| Integration | 7 | 133 |
| Handlers | 3 | 76 |
| Event System | 3 | 85 |
| Services | 13 | 205 |
| Utilities | 7 | 137 |
| Resilience | 4 | 79 |
| Advanced | 3 | 70 |
| **Total** | **42** | **826** |

*Note: Chaos and property-based tests are excluded from normal test runs but can be run separately.*
*Last updated: January 2026*

## Running Tests

### Available Test Commands

From repository root, use `--filter` syntax:

| Command | Description |
|---------|-------------|
| `pnpm --filter @journey/engine test` | Run all tests (excludes chaos/property-based) |
| `pnpm --filter @journey/engine test:comprehensive` | Run comprehensive node/edge tests |
| `pnpm --filter @journey/engine test:slow` | Run slow tests (comprehensive + chaos + property-based) |
| `pnpm --filter @journey/engine test:fuzzy` | Run property-based fuzzy tests |
| `pnpm --filter @journey/engine test:chaos` | Run chaos/failure injection tests |
| `pnpm --filter @journey/engine test:fuzzy:all` | Run all fuzzy tests (property-based + chaos + validation) |
| `pnpm --filter @journey/engine test:questionnaire` | Run questionnaire integration tests |
| `pnpm --filter @journey/engine test:followup` | Run follow-up integration tests |
| `pnpm --filter @journey/engine test:coverage` | Run tests with coverage report |
| `pnpm --filter @journey/engine test:watch` | Run tests in watch mode |

### Run All Comprehensive Tests

```bash
pnpm --filter @journey/engine test:comprehensive
```

### Run Specific Test Suite

```bash
# Using vitest directly from packages/engine directory
cd packages/engine
pnpm vitest run src/__tests__/comprehensive/node-types.comprehensive.test.ts

# Or using filter syntax from root
pnpm --filter @journey/engine exec vitest run src/__tests__/comprehensive/node-types.comprehensive.test.ts
```

### Run with Coverage

```bash
pnpm --filter @journey/engine test:coverage
```

## Test Coverage Goals

- ✅ Core node types covered comprehensively
- ✅ Edge types covered comprehensively
- ✅ Integration flows validated via session-engine tests
- ✅ Error paths and race conditions covered

## Known Test Coverage Gaps

The following areas have been identified as needing additional test coverage:

### Critical Priority (P0)

#### Event Router (`event-router.test.ts`)

Current coverage: ~60% (43 tests). Recently improved with handler delegation tests. Remaining gaps:

| Area | Current Coverage | Tests Needed |
|------|-----------------|--------------|
| Plugin follow-up timeout routing | Partial | 2+ tests |
| Guard evaluation edge cases | Partial | 2+ tests |
| Response behavior "exit" action | None | 2+ tests |

#### Event Queue (`event-queue.test.ts`)

Current coverage: Good (28 tests). Remaining gaps:

| Area | Current Coverage | Tests Needed |
|------|-----------------|--------------|
| High-load concurrency (1000+ events) | None | 2+ tests |
| Deque corruption recovery | None | 1 test |

### Medium Priority (P1)

| Area | File | Tests Needed |
|------|------|--------------|
| Timer recovery on resume | `timer-service.test.ts` | 2+ tests for stale timer handling |
| Guard error metrics | `guard-utils.test.ts` | 1+ test for error rate tracking |
| Plugin follow-up recovery | `timer-service.follow-up.test.ts` | 2+ tests |

### Low Priority (P2)

| Area | File | Tests Needed |
|------|------|--------------|
| Version persistence scenarios | `session-state-manager.test.ts` | 2+ tests |
| Mindstate analysis trigger verification | `mindstate-analysis.test.ts` | 1+ test |
| Cross-node output reference tests | `node-outputs.test.ts` | 2+ tests |

### How to Contribute

When addressing coverage gaps:

1. Use existing test patterns from nearby test files
2. Create minimal journey fixtures for each scenario
3. Verify edge cases (empty inputs, concurrent events, error paths)
4. Update this document when gaps are filled

## Writing New Tests

When adding new features, ensure you:

1. Add test cases to relevant comprehensive test files
2. Create new journey fixtures if needed
3. Test both happy paths and error paths
4. Test edge cases and boundary conditions
5. Update this document with new test files

## Test Patterns

### Creating Test Sessions

```typescript
const createSession = (journeyId: string): EnhancedUserJourney => ({
  sessionId: "test-session",
  userId: "test-user",
  journeyId,
  currentNodeId: "",
  status: "active",
  context: {},
  tags: [],
  pendingTimers: [],
  pendingPluginFollowUps: [], // For follow-up plugin tests
  nodeOutputs: {},
  activeButtons: undefined, // For button routing tests
  hasStarted: false, // For resume detection tests
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
  history: [],
});
```

### Simulating User Interactions

```typescript
// Button click
adapter.simulateButtonClick("option-a");

// Text message
adapter.simulateMessage("Hello");

// Timeout
adapter.simulateTimeout(timerId);
```

Note: button clicks use button IDs (not labels).

### Verifying Results

```typescript
// Check messages sent
const messages = adapter.getSentMessages();
expect(messages[0].message.content).toBe("Expected content");

// Check session state
const session = engine.getSession();
expect(session.currentNodeId).toBe("expected-node");
expect(session.status).toBe("active");

// Check events logged
expect(collectedEvents).toContainEqual(
  expect.objectContaining({
    type: "engine.transition",
    nodeId: "target-node",
  })
);
```

## Related Documentation

- [Engine Architecture](/docs/engine/README.md)
