# Testing Patterns

> Using no-op factories and mocking patterns for testing services.

## Overview

The unified services architecture includes a comprehensive no-op factory that creates "null object" implementations of all services. This enables easy testing without complex mocking.

**Location:** `packages/schemas/src/runtime/services/noop-factory.ts`

---

## No-Op Service Factory

### Creating Test Contexts

```typescript
import { createNoOpServiceContext, createMinimalServiceContext, createPartialServiceContext } from "@journey/schemas";

// Full context - all services as no-ops
const fullContext = createNoOpServiceContext();

// Minimal context - only core services
const minimalContext = createMinimalServiceContext();

// Partial context - specify which optional services
const partialContext = createPartialServiceContext(["memory", "tag"]);
```

### Context Comparison

| Factory                                   | Core Services | Optional Services | `has()` Returns      |
| ----------------------------------------- | ------------- | ----------------- | -------------------- |
| `createNoOpServiceContext()`              | All           | All               | `true` for all       |
| `createMinimalServiceContext()`           | All           | None              | `false` for all      |
| `createPartialServiceContext(["memory"])` | All           | Only specified    | `true` for specified |

---

## No-Op Service Behaviors

Each no-op service has predictable, safe behavior:

### IVariableService (No-Op)

```typescript
const service = createNoOpVariableService();

await service.getAll("journey"); // Returns {}
await service.getValue("journey", "x"); // Returns undefined
await service.setValue("journey", "x", 1); // Does nothing (no error)
await service.exists("journey", "x"); // Returns false
```

### IMessengerService (No-Op)

```typescript
const service = createNoOpMessengerService();

await service.sendMessage("Hello");
// Returns { success: true, messageId: "noop-..." }

await service.sendButtons([{ id: "1", text: "Click" }]);
// Returns { success: true, messageId: "noop-..." }
```

### IMemoryService (No-Op)

```typescript
const service = createNoOpMemoryService();

await service.save({ key: "test", content: "..." }); // Does nothing
await service.search("query"); // Returns []
await service.getRecent(10); // Returns []
await service.get("key"); // Returns null
await service.exists("key"); // Returns false
```

### ICacheService (No-Op)

```typescript
const service = createNoOpCacheService();

await service.get("key"); // Returns null
await service.set("key", "value"); // Does nothing
await service.delete("key"); // Returns false
await service.ttl("key"); // Returns -2 (not found)
await service.isHealthy(); // Returns true
```

---

## Testing Examples

### Testing a Handler

```typescript
import { describe, it, expect } from "vitest";
import { createNoOpServiceContext } from "@journey/schemas";
import { messageHandler } from "./message-handler";

describe("MessageHandler", () => {
  it("should send message successfully", async () => {
    const context = {
      services: createNoOpServiceContext(),
      node: { data: { content: "Hello {{user.name}}" } },
      session: { userId: "user-123" },
    };

    const result = await messageHandler.execute(context);

    expect(result.success).toBe(true);
  });

  it("should handle missing variables gracefully", async () => {
    const context = {
      services: createNoOpServiceContext(), // getAll returns {}
      node: { data: { content: "Hello {{vars.journey.name}}" } },
      session: {},
    };

    // No-op variable service returns {} for getAll
    // Handler should handle missing variable
    const result = await messageHandler.execute(context);

    expect(result.success).toBe(true);
  });
});
```

### Testing with Specific Services

```typescript
describe("MemoryHandler", () => {
  it("should skip memory save when service unavailable", async () => {
    const context = {
      services: createMinimalServiceContext(), // No memory service
      // ...
    };

    // has("memory") returns false
    expect(context.services.has("memory")).toBe(false);

    const result = await memoryHandler.execute(context);

    // Should succeed without attempting memory save
    expect(result.success).toBe(true);
  });

  it("should save memory when service available", async () => {
    const context = {
      services: createPartialServiceContext(["memory"]),
      // ...
    };

    expect(context.services.has("memory")).toBe(true);

    const result = await memoryHandler.execute(context);
    expect(result.success).toBe(true);
  });
});
```

### Testing with Mocked Services

When you need to verify service calls, mock specific services:

```typescript
import { vi, describe, it, expect } from "vitest";
import { createNoOpServiceContext } from "@journey/schemas";

describe("with mocked services", () => {
  it("should call variable service with correct parameters", async () => {
    const context = createNoOpServiceContext();

    // Override specific method
    const mockSetValue = vi.fn();
    context.variable.setValue = mockSetValue;

    await myHandler.execute({ services: context });

    expect(mockSetValue).toHaveBeenCalledWith("journey", "result", 42);
  });

  it("should send correct message", async () => {
    const context = createNoOpServiceContext();

    const mockSendMessage = vi.fn().mockResolvedValue({
      success: true,
      messageId: "msg-123",
    });
    context.messenger.sendMessage = mockSendMessage;

    await myHandler.execute({ services: context });

    expect(mockSendMessage).toHaveBeenCalledWith("Hello, World!", expect.any(Object));
  });
});
```

---

## API Route Testing

Use API test helpers to override the service container in route tests.

### Using Mock Services

```typescript
import { createTestApp } from "../helpers/test-app";
import { createMockServices } from "../../services/test-helpers";
// Adjust relative paths to your test file location.

describe("GET /api/variables", () => {
  it("returns global variables", async () => {
    const { services, mocks } = createMockServices();
    mocks.variable.getGlobalVariables.mockResolvedValue([
      { key: "apiKey", value: "sk-123", description: null },
    ]);

    const { app, cleanup } = createTestApp({ services });

    const res = await app.request("/api/variables");

    expect(res.status).toBe(200);
    expect(mocks.variable.getGlobalVariables).toHaveBeenCalledOnce();

    cleanup();
  });
});
```

### Using No-Op Services

```typescript
import { createTestApp } from "../helpers/test-app";
import { createTestServices } from "../../services/test-helpers";
// Adjust relative paths to your test file location.

const { app, cleanup } = createTestApp({ services: createTestServices() });
```

---

## Testing Event Bridge

The event bridge uses a specific mocking pattern for the event dispatcher:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { storeEventBus } from "../store-event-bus";
import { eventBridge } from "../event-bridge";
import { eventDispatcher } from "@/shared/lib/events";

// Mock the event dispatcher
vi.mock("@/shared/lib/events", () => ({
  eventDispatcher: {
    registerGlobal: vi.fn(),
    clear: vi.fn(),
  },
}));

describe("EventBridge", () => {
  let mockHandler: ((event: FrontendEvent) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler = null;

    // Capture the handler when registerGlobal is called
    vi.mocked(eventDispatcher.registerGlobal).mockImplementation((config) => {
      mockHandler = config.handler;
      return () => {
        mockHandler = null;
      };
    });

    storeEventBus.clear();
    eventBridge.stop();
    eventBridge.resetMetrics();
  });

  it("should transform session.started", () => {
    const storeListener = vi.fn();
    storeEventBus.on("sync:session.started", storeListener);

    eventBridge.start();

    // Simulate incoming event
    mockHandler?.({
      id: "evt-123",
      type: "session.started",
      sessionId: "sess-456",
      journeyId: "journey-789",
      timestamp: new Date().toISOString(),
      // ... other required fields
    });

    expect(storeListener).toHaveBeenCalledWith({
      type: "sync:session.started",
      payload: {
        sessionId: "sess-456",
        journeyId: "journey-789",
      },
    });
  });
});
```

---

## Testing Type Conversion

```typescript
import { describe, it, expect } from "vitest";
import { isEmpty, isTruthy, toNumber, toString } from "@journey/schemas";

describe("type conversion", () => {
  describe("isEmpty", () => {
    it("should return true for empty values", () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty("")).toBe(true);
      expect(isEmpty("   ")).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
    });

    it("should return false for non-empty values", () => {
      expect(isEmpty(0)).toBe(false); // 0 is a valid value
      expect(isEmpty(false)).toBe(false); // false is a valid value
      expect(isEmpty("0")).toBe(false); // non-empty string
    });
  });

  describe("isTruthy edge cases", () => {
    it("string 'false' is truthy", () => {
      expect(isTruthy("false")).toBe(true);
    });

    it("empty object is truthy", () => {
      expect(isTruthy({})).toBe(true);
    });

    it("empty array is falsy", () => {
      expect(isTruthy([])).toBe(false);
    });
  });
});
```

---

## Best Practices

### 1. Use No-Op Context by Default

```typescript
// Good: Start with no-op, override what you need
const context = createNoOpServiceContext();
context.variable.getValue = vi.fn().mockResolvedValue("test");

// Avoid: Creating complex mock structures from scratch
const context = {
  variable: {
    getAll: vi.fn(),
    getValue: vi.fn(),
    setValue: vi.fn(),
    // ... many more methods
  },
  // ... many more services
};
```

### 2. Check Optional Services

```typescript
// Good: Test both paths
it("handles with memory service", async () => {
  const ctx = createPartialServiceContext(["memory"]);
  // ...
});

it("handles without memory service", async () => {
  const ctx = createMinimalServiceContext();
  // ...
});
```

### 3. Test Error Handling

```typescript
it("handles service errors gracefully", async () => {
  const context = createNoOpServiceContext();
  context.messenger.sendMessage = vi.fn().mockRejectedValue(new Error("Network error"));

  const result = await myHandler.execute({ services: context });

  expect(result.success).toBe(false);
  expect(result.error).toContain("Network error");
});
```

---

## Test Coverage

The no-op factory has comprehensive tests:

```
packages/schemas/src/__tests__/noop-factory.test.ts
- 54 tests covering all 11 service factories
- Tests for createNoOpServiceContext
- Tests for createMinimalServiceContext
- Tests for createPartialServiceContext
```

---

## See Also

- [Service Interfaces](./service-interfaces.md) - Interface specifications
- [SharedServiceContext](./README.md) - Architecture overview
- [Testing Guidelines](../../../../CLAUDE.md#testing-guidelines) - Project testing standards
