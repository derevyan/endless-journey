# Unified Services Architecture

> A comprehensive service layer that provides consistent access to all backend services across the Journey Builder platform.

## Overview

The Unified Services Architecture establishes a **single interface for all service access** across the entire codebase. Whether code runs in the journey engine, LLM workflows, or agent tools, it accesses services through the same `SharedServiceContext` interface.

### Key Benefits

| Benefit         | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| **Consistency** | Same API everywhere - engine, workflows, tools               |
| **Flexibility** | Easy to add new services without touching every context type |
| **Testing**     | No-op factory enables effortless mocking                     |
| **Security**    | Permission system with capability-based access control       |
| **Type Safety** | Full TypeScript support with Zod validation                  |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED SERVICE LAYER                                │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                   SharedServiceContext                               │   │
│   │  (Single interface for all service access - defined in schemas)     │   │
│   │                                                                      │   │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│   │   │ variable │ │messenger │ │  memory  │ │mindstate │ │   crm    │ │   │
│   │   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│   │   │   tag    │ │ template │ │   dlq    │ │expression│ │ followUp │ │   │
│   │   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│   │                    ┌──────────┐ ┌──────────┐                         │   │
│   │                    │  cache   │ │ journey  │                         │   │
│   │                    └──────────┘ └──────────┘                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│              ┌───────────────────────┼───────────────────────┐              │
│              ▼                       ▼                       ▼              │
│   ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐    │
│   │ ExecutionContext  │   │  WorkflowContext  │   │ BuiltinToolContext│    │
│   │ (Journey Engine)  │   │ (Workflow Runner) │   │   (LLM Tools)     │    │
│   │                   │   │                   │   │                   │    │
│   │ services: shared  │   │ services: shared  │   │ services: shared  │    │
│   └───────────────────┘   └───────────────────┘   └───────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. SharedServiceContext

The central interface that all execution contexts use for service access.

**Location:** `packages/schemas/src/services/shared-context.ts`

```typescript
interface SharedServiceContext {
  // Core services (always available)
  readonly variable: IVariableService;
  readonly template: ITemplateService;
  readonly messenger: IMessengerService;

  // Optional services (check with has())
  readonly memory?: IMemoryService;
  readonly mindstate?: IMindstateService;
  readonly crm?: ICrmService;
  readonly tag?: ITagService;
  readonly dlq?: IDlqService;
  readonly expression?: IExpressionService;
  readonly followUp?: IFollowUpService;
  readonly cache?: ICacheService;
  readonly journey?: IJourneyService;

  /** Check if an optional service is available */
  has(service: OptionalServiceName): boolean;
}
```

### 2. Service Interfaces

Each service has a well-defined interface in `@journey/schemas`:

| Service    | Interface            | Purpose                       |
| ---------- | -------------------- | ----------------------------- |
| Variable   | `IVariableService`   | Get/set scoped variables      |
| Messenger  | `IMessengerService`  | Send messages, buttons, media |
| Template   | `ITemplateService`   | Template substitution         |
| Memory     | `IMemoryService`     | Semantic memory storage       |
| Mindstate  | `IMindstateService`  | Psychology parameter tracking |
| CRM        | `ICrmService`        | Pipeline and stage management |
| Tag        | `ITagService`        | User tag operations           |
| DLQ        | `IDlqService`        | Dead letter queue handling    |
| Expression | `IExpressionService` | Expression evaluation         |
| FollowUp   | `IFollowUpService`   | Follow-up scheduling          |
| Cache      | `ICacheService`      | Redis caching layer           |
| Journey    | `IJourneyService`    | Journey routing + transfers   |

### 3. No-Op Factory

For testing and contexts where services aren't needed:

**Location:** `packages/schemas/src/services/noop-factory.ts`

```typescript
// Full context with all services as no-ops
const context = createNoOpServiceContext();

// Minimal context (core services only)
const minimal = createMinimalServiceContext();

// Partial context (specify which optional services to include)
const partial = createPartialServiceContext(["memory", "tag"]);
```

### 4. Permission System

Capability-based access control for security isolation:

**Location:** `packages/schemas/src/permissions/`

```typescript
// Define what a subject can access
const capabilities: CapabilityDeclaration = {
  variables: {
    read: ["journey", "user"],
    write: ["journey"],
  },
  actions: ["sendMessage", "saveMemory"],
  external: [{ type: "webhook", domains: ["api.example.com"] }],
};

// Create guarded context that enforces permissions
const guarded = createGuardedContext(rawContext, checker);
```

---

## Related Documentation

| Document                                        | Description                        |
| ----------------------------------------------- | ---------------------------------- |
| [Service Interfaces](./service-interfaces.md)   | Detailed interface specifications  |
| [Variable Namespaces](./variable-namespaces.md) | `{{vars.scope.key}}` syntax guide  |
| [Event Bridge](./event-bridge.md)               | SSE to store event synchronization |
| [Permission Model](./permission-model.md)       | Capability-based access control    |
| [Type Conversion](./type-conversion.md)         | Type conversion utilities          |
| [Testing Patterns](./testing-patterns.md)       | Using no-op factories in tests     |

---

## Quick Start

### Using Services in Engine Handlers

```typescript
// packages/engine/src/handlers/message-handler.ts
async function execute(context: ExecutionContext) {
  // Access variables
  const name = await context.services.variable.getValue("user", "firstName");

  // Send message
  await context.services.messenger.sendMessage(`Hello, ${name}!`);

  // Check optional service
  if (context.services.has("memory")) {
    await context.services.memory.save({ key: "greeting", content: "User greeted" });
  }
}
```

### Using Services in LLM Tools

```typescript
// packages/llm/src/tools/builtin/variable-tools.ts
const tool: AgentTool = {
  name: "read_journey_variable",
  capabilities: {
    variables: { read: ["journey"] },
    actions: ["readContext"],
  },
  execute: async (params, context) => {
    return context.services.variable.getValue("journey", params.key);
  },
};
```

### Testing with No-Op Services

```typescript
// __tests__/my-handler.test.ts
import { createNoOpServiceContext } from "@journey/schemas";

describe("MyHandler", () => {
  it("should handle missing variable gracefully", async () => {
    const context = {
      services: createNoOpServiceContext(),
      // ... other context fields
    };

    // No-op variable service returns {} from getAll()
    const result = await myHandler.execute(context);
    expect(result.success).toBe(true);
  });
});
```

---

## File Locations

### Schemas Package

```
packages/schemas/src/
├── services/
│   ├── index.ts                    # Module exports
│   ├── shared-context.ts           # SharedServiceContext interface
│   ├── variable-service.ts         # IVariableService
│   ├── messenger-service.ts        # IMessengerService
│   ├── memory-service.ts           # IMemoryService
│   ├── template-service.ts         # ITemplateService
│   ├── tag-service.ts              # ITagService
│   ├── crm-service.ts              # ICrmService
│   ├── mindstate-service.ts        # IMindstateService
│   ├── dlq-service.ts              # IDlqService
│   ├── expression-service.ts       # IExpressionService
│   ├── follow-up-service.ts        # IFollowUpService
│   ├── cache-service.ts            # ICacheService
│   └── noop-factory.ts             # No-op implementations
├── permissions/
│   ├── index.ts                    # Module exports
│   ├── subjects.ts                 # PermissionSubject types
│   ├── resources.ts                # PermissionResource, SystemAction
│   ├── capabilities.ts             # CapabilityDeclaration, profiles
│   ├── checker.ts                  # PermissionChecker class
│   ├── guarded-context.ts          # createGuardedContext factory
│   └── audit.ts                    # Audit logging
└── variables/
    ├── index.ts                    # Module exports
    ├── namespaces.ts               # VariableNamespaces type
    ├── context-builder.ts          # buildVariableNamespaces function
    └── type-conversion.ts          # isEmpty, isTruthy, toNumber, etc.
```

### Engine Package

```
packages/engine/src/
├── types.ts                        # ExecutionContext uses SharedServiceContext
├── context/
│   └── context-builder.ts          # Uses buildVariableNamespaces
└── handlers/
    └── *.ts                        # All handlers use context.services
```

### LLM Package

```
packages/llm/src/
├── workflow/
│   ├── types.ts                    # WorkflowContext uses SharedServiceContext
│   └── variable-resolver.ts        # Uses unified variable namespace
└── tools/
    └── builtin/
        ├── types.ts                # BuiltinToolContext uses SharedServiceContext
        └── *.ts                    # All tools declare capabilities
```

---

## Migration Guide

If you're updating existing code to use the unified services:

### Before (Direct Service Access)

```typescript
// Old pattern - direct imports, different interfaces
import { variableService } from "@/modules/variables/services/variable-service";
const value = await variableService.get(sessionId, "journey", "key");
```

### After (Unified Context)

```typescript
// New pattern - consistent interface via context
const value = await context.services.variable.getValue("journey", "key");
```

### Key Changes

1. **Always access services through context.services**
2. **Check optional services with context.services.has()**
3. **Use type conversion utilities from schemas**
4. **Declare tool capabilities for permission enforcement**

---

## See Also

- [System Overview](../system-overview.md) - High-level architecture
- [Data Flows](../data-flows.md) - Event and data flow diagrams
- [Unified Module Communication Proposal](../../proposals/implemented/unified-module-communication/README.md) - Original proposal with implementation details
