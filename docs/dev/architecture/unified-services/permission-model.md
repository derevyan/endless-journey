# Permission Model

> Capability-based access control for service operations.

## Overview

The permission model provides security isolation between different execution contexts. Each subject (journey engine, LLM tool, workflow node) declares what capabilities it needs, and the permission system enforces those boundaries at runtime.

**Location:** `packages/schemas/src/permissions/`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION LAYER                                     │
│                                                                              │
│   ┌────────────────────┐     ┌────────────────────┐     ┌────────────────┐ │
│   │ PermissionSubject  │────▶│CapabilityDeclaration│────▶│PermissionChecker│ │
│   │ (who is asking)    │     │ (what they can do) │     │ (enforcement)  │ │
│   └────────────────────┘     └────────────────────┘     └────────────────┘ │
│                                                                    │        │
│                                                                    ▼        │
│                                                         ┌────────────────┐  │
│                                                         │ GuardedContext │  │
│                                                         │ (transparent)  │  │
│                                                         └────────────────┘  │
│                                                                    │        │
│                                                                    ▼        │
│                                                         ┌────────────────┐  │
│                                                         │SharedServiceCtx│  │
│                                                         │ (actual work)  │  │
│                                                         └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Permission Subject

Identifies who is requesting access:

```typescript
type PermissionSubject = {
  type: "journey_engine" | "workflow" | "llm_tool" | "external_integration" | "system" | "read_only";
  id: string;
  organizationId?: string;
  sessionId?: string;
  journeyId?: string;
};

// Factory functions
const subject = createJourneyEngineSubject({ organizationId: orgId, sessionId, journeyId });
const toolSubject = createLlmToolSubject({ toolId: toolName, organizationId: orgId, sessionId });
const readOnly = createReadOnlySubject({ purpose: "analytics", organizationId: orgId });
```

### Capability Declaration

Declares what a subject can access:

```typescript
interface CapabilityDeclaration {
  variables: {
    read: VariableScope[]; // ["journey", "user"]
    write: VariableScope[]; // ["journey"]
  };
  actions: SystemAction[]; // ["sendMessage", "saveMemory"]
  external: ExternalTarget[]; // [{ type: "webhook", domains: ["api.example.com"] }]
}
```

### Pre-defined Profiles

Common capability profiles for different use cases:

| Profile                | Description             | Variables          | Actions                  |
| ---------------------- | ----------------------- | ------------------ | ------------------------ |
| `JOURNEY_ENGINE`       | Full access for engine  | All read/write     | All                      |
| `LLM_TOOL_STANDARD`    | Safe AI tool access     | journey/user read  | sendMessage, saveMemory  |
| `READ_ONLY`            | Analytics/monitoring    | All read           | None                     |
| `EXTERNAL_INTEGRATION` | Minimal external access | global read        | Limited                  |
| `WORKFLOW_NODE`        | Workflow step execution | journey read       | sendMessage, setVariable |
| `CRM_MANAGER`          | Full CRM access         | journey read/write | All CRM actions          |

---

## Usage

### Creating a Permission Checker

```typescript
import { PermissionChecker, CapabilityProfiles } from "@journey/schemas";

const checker = new PermissionChecker(createLlmToolSubject("my_tool", orgId, sessionId), CapabilityProfiles.LLM_TOOL_STANDARD);
```

### Checking Permissions

```typescript
// Check variable access
checker.checkVariableRead("journey", "orderTotal"); // ✓ OK
checker.checkVariableRead("global", "apiKey"); // ✗ Throws

// Check actions
checker.checkAction("sendMessage"); // ✓ OK
checker.checkAction("deleteUser"); // ✗ Throws

// Check external access
checker.checkExternal({ type: "webhook", url: "https://api.example.com/..." });
```

### Using Guarded Context

The guarded context wraps SharedServiceContext and enforces permissions transparently:

```typescript
import { createGuardedContext } from "@journey/schemas";

// Wrap the raw context
const guarded = createGuardedContext(rawContext, checker);

// Service calls are automatically checked
await guarded.variable.getValue("journey", "total"); // ✓ OK
await guarded.variable.setValue("global", "key", 1); // ✗ Throws PermissionDeniedError
```

---

## LLM Tool Capabilities

Each LLM tool declares its required capabilities:

```typescript
// packages/llm/src/tools/builtin/variable-tools.ts
const readJourneyVariableTool: AgentTool = {
  name: "read_journey_variable",
  description: "Read a journey variable",
  schema: z.object({ key: z.string() }),

  // Capability declaration
  capabilities: {
    variables: { read: ["journey"] },
    actions: ["readContext"],
  },

  execute: async (params, context) => {
    // If capabilities don't match, this will throw
    return context.services.variable.getValue("journey", params.key);
  },
};
```

### Tool Capability Reference

| Tool                    | Variable Read    | Variable Write | Actions     |
| ----------------------- | ---------------- | -------------- | ----------- |
| `read_journey_variable` | journey          | -              | readContext |
| `read_user_variable`    | user             | -              | readContext |
| `save_memory`           | -                | -              | saveMemory  |
| `recall_memories`       | -                | -              | readContext |
| `send_message`          | -                | -              | sendMessage |
| `get_user_profile`      | user             | -              | readContext |
| `get_journey_context`   | journey, session | -              | readContext |

---

## CRM Permissions

Granular CRM access control:

```typescript
// CRM action types
type CrmAction =
  | "crmMoveToStage"
  | "crmAddToPipeline"
  | "crmRemoveFromPipeline"
  | "crmUpdatePosition"
  | "crmSetDealValue"
  | "crmUpdateContact"
  | "crmCreateNote"
  | "crmAssignOwner";

// CRM action groups
const CrmActionGroups = {
  PIPELINE_MANAGEMENT: ["crmMoveToStage", "crmAddToPipeline", "crmRemoveFromPipeline"],
  DEAL_MANAGEMENT: ["crmSetDealValue", "crmUpdatePosition"],
  CRM_BASIC: ["crmMoveToStage", "crmCreateNote"],
  CRM_ALL: [
    /* all CRM actions */
  ],
};
```

### CRM Capability Profiles

```typescript
// Full CRM access
CapabilityProfiles.CRM_MANAGER;

// Pipeline automation only
CapabilityProfiles.PIPELINE_AUTOMATION;

// AI sales/support tools
CapabilityProfiles.LLM_TOOL_CRM;
```

---

## Error Handling

### PermissionDeniedError

```typescript
class PermissionDeniedError extends Error {
  constructor(
    public readonly subject: PermissionSubject,
    public readonly resource: PermissionResource,
    public readonly action: string,
    public readonly reason: string
  ) {
    super(`Permission denied: ${reason}`);
  }

  // Safe message for end users (no sensitive details)
  toSafeMessage(): string {
    return "You don't have permission to perform this action";
  }
}
```

### Handling in Code

```typescript
try {
  await guardedContext.variable.setValue("global", "key", value);
} catch (error) {
  if (error instanceof PermissionDeniedError) {
    log.warn(
      {
        subject: error.subject.type,
        action: error.action,
        reason: error.reason,
      },
      "permission:denied"
    );

    return { error: error.toSafeMessage() };
  }
  throw error;
}
```

---

## Audit Logging

Track permission checks for security auditing:

```typescript
import {
  createAuditingChecker,
  createLlmToolSubject,
  CapabilityProfiles,
  InMemoryAuditLogger,
  generatePermissionSummary,
} from "@journey/schemas";

// Create audited checker
const auditLog = new InMemoryAuditLogger();
const subject = createLlmToolSubject({ toolId: "read_context", sessionId, organizationId });
const checker = createAuditingChecker(subject, CapabilityProfiles.LLM_TOOL_STANDARD, auditLog);

// All checks are logged
await guardedContext.variable.getValue("journey", "total");

// Review audit log
const entries = auditLog.getEntries();

// Generate summary
const summary = generatePermissionSummary(entries);
// { totalChecks, allowedCount, deniedCount, denialRate, topActions, topDenialReasons, subjectsWithMostDenials }
```

---

## Best Practices

### 1. Least Privilege

Give subjects only the permissions they need:

```typescript
// Good: Minimal permissions for a read-only tool
const capabilities = {
  variables: { read: ["journey"] },
  actions: ["readContext"],
  external: [],
};

// Avoid: Over-permissioned tool
const capabilities = {
  variables: { read: ["journey", "user", "global"], write: ["journey", "user"] },
  actions: ["sendMessage", "saveMemory", "deleteData"],
  external: [{ type: "webhook" }],
};
```

### 2. Check Before Use

```typescript
// Good: Check optional service availability
if (context.services.has("memory")) {
  // Only attempt memory operations if service is available
  await context.services.memory.save({ ... });
}

// Good: Declare capability and let the system enforce
capabilities: {
  actions: ["saveMemory"],
}
```

### 3. Use Profiles

```typescript
// Good: Use pre-defined profiles
const checker = new PermissionChecker(subject, CapabilityProfiles.LLM_TOOL_STANDARD);

// Avoid: Inline capability definitions (except for custom tools)
const checker = new PermissionChecker(subject, {
  variables: { read: ["journey", "user"], write: [] },
  actions: ["sendMessage"],
  external: [],
});
```

---

## Multi-Tenancy

Permission checks include organization and session validation:

```typescript
// Check organization match
checker.checkOrganization(requestedOrgId);

// Check session match
checker.checkSession(requestedSessionId);

// Check journey match
checker.checkJourney(requestedJourneyId);
```

This prevents cross-tenant data access.

---

## File Structure

```
packages/schemas/src/permissions/
├── index.ts              # Module exports
├── subjects.ts           # PermissionSubject type, factory functions
├── resources.ts          # PermissionResource, SystemAction, CrmActions
├── capabilities.ts       # CapabilityDeclaration, CapabilityProfiles
├── checker.ts            # PermissionChecker class
├── guarded-context.ts    # createGuardedContext factory
└── audit.ts              # Audit logging utilities
```

---

## See Also

- [Service Interfaces](./service-interfaces.md) - Protected service methods
- [SharedServiceContext](./README.md) - Architecture overview
- [LLM Tools](../../../llm/tools.md) - Tool capability declarations
