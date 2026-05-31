# Using Shared Services

> Practical guide for accessing services through SharedServiceContext.

## Overview

The unified services layer provides a consistent API for accessing services across the entire codebase:
- Journey Engine handlers
- LLM workflow nodes
- Builtin LLM tools
- Custom tools and integrations

**Architecture docs:** [Unified Services Architecture](../architecture/unified-services/README.md)

---

## Quick Start

### Accessing Services

All execution contexts provide a `services` property implementing `SharedServiceContext`:

```typescript
// In a handler, workflow node, or tool
const { services } = context;

// Core services (always available)
const value = await services.variable.getValue("journey", "orderTotal");
await services.messenger.sendMessage("Hello!");
const rendered = await services.template.render("Hello {{user.name}}!");

// Optional services (check availability first)
if (services.has("memory")) {
  await services.memory.save({ key: "note", content: "User prefers email" });
}
```

### The `has()` Pattern

Always check optional services before using them:

```typescript
// Good: Check before use
if (services.has("memory")) {
  await services.memory.save({ key: "fact", content: "..." });
}

// Good: Graceful degradation
const memories = services.has("memory")
  ? await services.memory.search("preferences")
  : [];
```

---

## Service Reference

### Core Services (Always Available)

| Service | Interface | Purpose |
|---------|-----------|---------|
| `variable` | `IVariableService` | Variable CRUD + operations |
| `template` | `ITemplateService` | Template rendering |
| `messenger` | `IMessengerService` | Send messages/buttons |

### Optional Services (Use `has()`)

| Service | Interface | Purpose |
|---------|-----------|---------|
| `memory` | `IMemoryService` | Semantic memory storage |
| `mindstate` | `IMindstateService` | Psychological state |
| `crm` | `ICrmService` | Pipeline management |
| `tag` | `ITagService` | Tag operations |
| `dlq` | `IDlqService` | Dead Letter Queue |
| `expression` | `IExpressionService` | Expression evaluation |
| `followUp` | `IFollowUpService` | Follow-up sequences |
| `cache` | `ICacheService` | Redis caching |

---

## Common Patterns

### 1. Variable Operations

```typescript
// Read a variable
const total = await services.variable.getValue("journey", "orderTotal");

// Write a variable
await services.variable.setValue("journey", "orderTotal", 99.99);

// Get all variables in a scope
const journeyVars = await services.variable.getAll("journey");

// Execute an operation (increment, push, etc.)
await services.variable.execute({
  operation: "increment",
  scope: "journey",
  key: "viewCount",
  operand: 1
});
```

### 2. Sending Messages

```typescript
// Simple message
await services.messenger.sendMessage("Hello!");

// Message with options
await services.messenger.sendMessage("Welcome!", {
  parseMode: "HTML",
  disablePreview: true
});

// Buttons
await services.messenger.sendButtons([
  { id: "yes", text: "Yes, continue" },
  { id: "no", text: "No, cancel" }
], {
  header: "Ready to proceed?"
});
```

### 3. Template Rendering

```typescript
// Simple template
const greeting = await services.template.render(
  "Hello {{user.firstName}}!",
  { user: { firstName: "John" } }
);

// With full variable context
const message = await services.template.render(
  "Your order total: {{vars.journey.orderTotal}}",
  variableContext
);
```

### 4. Memory Operations

```typescript
if (services.has("memory")) {
  // Save a memory
  await services.memory.save({
    key: "preference",
    content: "User prefers morning deliveries",
    memoryType: "fact"
  });

  // Search memories
  const relevant = await services.memory.search("delivery preferences", 5);

  // Get recent memories
  const recent = await services.memory.getRecent(10);
}
```

### 5. Tag Operations

```typescript
if (services.has("tag")) {
  // Add a tag
  await services.tag.add("vip");

  // Remove a tag
  await services.tag.remove("trial");

  // Check tag
  const hasTag = await services.tag.has("vip");

  // Get all tags
  const tags = await services.tag.getAll();
}
```

### 6. CRM Operations

```typescript
if (services.has("crm")) {
  // Move to pipeline stage
  await services.crm.moveToStage("pipeline-123", "qualified");

  // Set deal value
  await services.crm.setDealValue("pipeline-123", 5000);

  // Create a note
  await services.crm.createNote("Called, very interested in premium plan");
}
```

---

## Writing an LLM Tool

When creating a builtin LLM tool, use the services from context:

```typescript
// packages/llm/src/tools/builtin/my-tool.ts
import type { AgentTool } from "../types";
import { z } from "zod";

export const myCustomTool: AgentTool = {
  name: "my_custom_tool",
  description: "Does something useful",
  schema: z.object({
    input: z.string(),
  }),

  // Declare required capabilities
  capabilities: {
    variables: { read: ["journey"], write: ["journey"] },
    actions: ["sendMessage"],
  },

  async execute(params, context) {
    const { services } = context;

    // Read a variable
    const value = await services.variable.getValue("journey", "myVar");

    // Do something with it
    const result = processValue(value, params.input);

    // Write result
    await services.variable.setValue("journey", "result", result);

    return { success: true, result };
  },
};
```

---

## Testing with No-Op Factory

Use the no-op factory for testing without real service implementations:

```typescript
import { createNoOpServiceContext, createMinimalServiceContext } from "@journey/schemas";
import { describe, it, expect, vi } from "vitest";

describe("MyHandler", () => {
  it("should process successfully", async () => {
    // Full context with all services as no-ops
    const services = createNoOpServiceContext();

    // Optional: Mock specific methods
    services.variable.getValue = vi.fn().mockResolvedValue(42);

    const result = await myHandler.execute({ services });

    expect(result.success).toBe(true);
    expect(services.variable.getValue).toHaveBeenCalledWith("journey", "count");
  });

  it("should handle missing optional services", async () => {
    // Minimal context - only core services
    const services = createMinimalServiceContext();

    // has("memory") returns false
    expect(services.has("memory")).toBe(false);

    const result = await myHandler.execute({ services });

    // Handler should gracefully skip memory operations
    expect(result.success).toBe(true);
  });
});
```

### Context Factory Comparison

| Factory | Core Services | Optional Services | Use Case |
|---------|--------------|-------------------|----------|
| `createNoOpServiceContext()` | All | All | Full testing |
| `createMinimalServiceContext()` | All | None | Test graceful degradation |
| `createPartialServiceContext(["memory"])` | All | Only specified | Selective testing |

---

## Type Conversion Utilities

Use these utilities for consistent type handling:

```typescript
import { isEmpty, isTruthy, toNumber, toString } from "@journey/schemas";

// Check if value is "empty" (null, undefined, "", whitespace, [], {})
if (isEmpty(userInput)) {
  await services.messenger.sendMessage("Please provide a value");
  return;
}

// Truthy check (false for: null, undefined, false, 0, "", [], NaN)
if (isTruthy(shouldProceed)) {
  // Continue
}

// Safe number conversion (NaN → 0)
const total = toNumber(rawTotal) + toNumber(shipping);

// Safe string conversion (null → "")
const message = `Order total: ${toString(total)}`;
```

**Important edge cases:**
- `isTruthy("false")` → `true` (non-empty string)
- `isEmpty({})` → `true` but `isTruthy({})` → `true`
- `isEmpty(0)` → `false` (0 is a valid value)

---

## Best Practices

### 1. Always Check Optional Services

```typescript
// Good
if (services.has("memory")) {
  await services.memory.save(...);
}

// Bad - will throw if memory not available
await services.memory.save(...);
```

### 2. Use Declarative Capabilities

When writing LLM tools, declare capabilities explicitly:

```typescript
capabilities: {
  variables: { read: ["journey", "user"], write: ["journey"] },
  actions: ["sendMessage"],
}
```

### 3. Prefer No-Op Context for Tests

```typescript
// Good - clean, predictable
const services = createNoOpServiceContext();

// Avoid - complex setup
const services = {
  variable: { getValue: vi.fn(), setValue: vi.fn(), ... },
  // ... many more mocks
};
```

### 4. Handle Errors Gracefully

```typescript
try {
  await services.crm.moveToStage(pipelineId, stageId);
} catch (error) {
  log.error({ err: serializeError(error) }, "crm:moveToStage:failed");
  // Continue without CRM update rather than failing the handler
}
```

---

## Related Documentation

- [Unified Services Architecture](../architecture/unified-services/README.md) - Full architecture
- [Service Interfaces](../architecture/unified-services/service-interfaces.md) - All interface specs
- [Variable Namespaces](../architecture/unified-services/variable-namespaces.md) - Template syntax
- [Permission Model](../architecture/unified-services/permission-model.md) - Capability-based access
- [Testing Patterns](../architecture/unified-services/testing-patterns.md) - No-op factory details
- [Type Conversion](../architecture/unified-services/type-conversion.md) - Utility functions
