# CRM + Journey Builder Integration Architecture

This document describes the architecture for integrating the CRM (Customer Relationship Management) system with the Journey Builder automation platform.

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Data Model](#data-model)
4. [CRM Node Type](#crm-node-type)
5. [Auto-Assignment](#auto-assignment)
6. [API Reference](#api-reference)
7. [UI Organization](#ui-organization)
8. [Migration Guide](#migration-guide)

---

## Overview

The system supports:

- **One default CRM pipeline** where every client is automatically assigned
- **Multiple custom CRM pipelines** that clients can be added to via journey actions
- **Clients in multiple pipelines simultaneously**, each with its own stage
- **Journey-triggered CRM actions** for flexible automation
- **Journey-level default pipeline** - journeys can specify a default pipeline for CRM nodes

### Pipeline Resolution Order

When a CRM node executes without an explicit `pipelineId`, the system resolves the pipeline in this order:

```
1. CRM Node's pipelineId (if set)      --> Use explicit pipeline
2. Journey's defaultPipelineId (if set) --> Use journey default
3. Organization's default pipeline      --> Fallback (auto-created if missing)
```

This allows journeys to be associated with specific pipelines without requiring every CRM node to specify the pipeline.

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Users /   │  │   Journey   │  │   CRM Kanban        │  │
│  │  Contacts   │  │   Builder   │  │   Board             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Client    │  │   Session   │  │   CRM Stage         │  │
│  │   Service   │  │   Engine    │  │   Service           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   clients   │  │  journey_   │  │  crm_client_stages  │  │
│  │             │  │  sessions   │  │  crm_pipelines      │  │
│  │             │  │             │  │  crm_pipeline_stages│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Separation of Contact, Journey, and CRM

These three concepts are **independent layers**:

| Layer                | Description                                 | Storage                   |
| -------------------- | ------------------------------------------- | ------------------------- |
| **Contact (Client)** | Who the person is (Telegram ID, name, etc.) | `clients` table           |
| **Journey**          | What automation flow they're in             | `journey_sessions` table  |
| **CRM Pipeline**     | Where they are in a business process        | `crm_client_stages` table |

**Key insight**: We never say "user is in this journey, so they live in this CRM". Instead: "this journey triggers these CRM actions".

### 2. Multi-Pipeline Support

A client can be in **multiple CRM pipelines simultaneously**, each with its own stage:

```
Client "John Doe"
├── Default Pipeline: Stage "Engaged"
├── Webinar Leads Pipeline: Stage "Registered"
└── VIP Customers Pipeline: Stage "Trial"
```

### 3. Journey → CRM Direction

Journeys trigger CRM actions, not the other way around. The CRM module doesn't know about journeys - it just responds to API calls.

```
Journey Node (CRM Action) ──calls──▶ CRM Service ──updates──▶ Database
```

---

## Data Model

### Core Tables

```sql
-- Clients (Contacts)
clients (
  id,              -- e.g., "telegram_123456789"
  platform,        -- "telegram", "whatsapp", etc.
  firstName,
  lastName,
  username,
  ...
)

-- CRM Pipelines (Boards)
crm_pipelines (
  id,
  organization_id,
  name,            -- "Sales Pipeline", "Webinar Leads", etc.
  is_default,      -- TRUE for the default pipeline
  color,
  position,
  ...
)

-- CRM Pipeline Stages
crm_pipeline_stages (
  id,
  pipeline_id,
  organization_id,
  name,            -- "Unassigned", "Qualified", "Converted", etc.
  color,
  position,
  is_default,      -- TRUE for the default/entry stage
  is_system,       -- TRUE for system-managed stages
  ...
)

-- Client Stage Assignments (one per client per pipeline)
crm_client_stages (
  id,
  client_id,
  organization_id,
  pipeline_id,     -- Which pipeline this assignment is for
  stage_id,        -- Current stage in that pipeline
  assigned_by,     -- User ID or NULL for system
  assigned_at,
  notes,
  UNIQUE(client_id, pipeline_id)  -- One stage per pipeline
)

-- Stage History (for analytics)
crm_stage_history (
  id,
  client_id,
  organization_id,
  pipeline_id,
  from_stage_id,
  to_stage_id,
  changed_by,
  changed_at,
  duration_ms,     -- Time spent in previous stage
  notes,
  ...
)
```

### Key Constraint

```sql
-- Client can only have ONE stage per pipeline
-- But can be in MULTIPLE pipelines
UNIQUE(client_id, pipeline_id) ON crm_client_stages
```

---

## CRM Node Type

### Schema Definition

```typescript
// packages/schemas/src/nodes/types/journey/crm.ts
const CrmActionSchema = z.enum([
  "create", // Add to pipeline (if not exists)
  "move", // Move to different stage
  "remove", // Remove from pipeline
]);

const CrmNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("crm"),
  action: CrmActionSchema,
  pipelineId: z.string().optional(), // If not set, uses default
  stageId: z.string().optional(), // If not set for create, uses default stage
  notes: z.string().optional(),
});
```

### Actions

#### 1. Create (Add to Pipeline)

Adds the client to a pipeline at a specific stage. Does nothing if client already exists in that pipeline.

```typescript
// Journey node configuration
{
  type: "crm",
  action: "create",
  pipelineId: "webinar-leads-pipeline-id",  // Optional
  stageId: "registered-stage-id",            // Optional
  notes: "Added from Webinar signup journey"
}
```

**Behavior**:

- If `pipelineId` is not set → uses organization's default pipeline
- If `stageId` is not set → uses pipeline's default stage (usually "Unassigned")
- If client already in pipeline → no-op (preserves existing stage)

#### 2. Move (Change Stage)

Moves the client to a different stage within a pipeline.

```typescript
{
  type: "crm",
  action: "move",
  stageId: "qualified-stage-id",  // Required
  notes: "Qualified after completing onboarding"
}
```

**Behavior**:

- Stage determines which pipeline to move within
- Records history with duration in previous stage
- Logs activity for timeline

#### 3. Remove (Remove from Pipeline)

Removes the client from a specific pipeline.

```typescript
{
  type: "crm",
  action: "remove",
  pipelineId: "webinar-leads-pipeline-id",  // Required
}
```

### Engine Handler

```typescript
// packages/engine/src/handlers/crm-handler.ts
export const crmHandler: NodeHandler = {
  nodeType: "crm",

  async execute(context: ExecutionContext): Promise<HandlerResult> {
    const { session, node, services } = context;
    const crmData = node.data as CrmNodeData;
    const clientId = session.userId;

    // Execute action via CRM service
    switch (crmData.action) {
      case "create":
        await services.crm.addToPipeline(clientId, pipelineId, stageId, notes);
        break;
      case "move":
        await services.crm.moveToStage(clientId, stageId, notes);
        break;
      case "remove":
        await services.crm.removeFromPipeline(clientId, pipelineId);
        break;
    }

    // Always transition to next node (non-blocking)
    return { action: "transition", targetNodeId: nextNode, trigger: "crm_action" };
  },
};
```

### CRM Service Interface

```typescript
// packages/engine/src/types.ts
interface CrmService {
  addToPipeline(clientId: string, pipelineId?: string, stageId?: string, notes?: string): Promise<void>;
  moveToStage(clientId: string, stageId: string, notes?: string): Promise<void>;
  removeFromPipeline(clientId: string, pipelineId: string): Promise<void>;
}
```

---

## Auto-Assignment

### Organization Initialization

When a new organization is created (via user signup), the system automatically provisions:

1. **Default CRM Pipeline** - "Sales Pipeline" with standard stages
2. **Demo Journey** - "Starter Template" with a 3-step welcome flow

This is handled by the `organization-init-service.ts` via Better Auth's `organizationHooks.afterCreateOrganization` hook:

```typescript
// apps/api/src/lib/auth.ts
organization({
  organizationHooks: {
    afterCreateOrganization: async ({ organization: org, user }) => {
      await initializeOrganization(org.id, user.id);
    },
  },
});
```

### When a Client First Interacts

Every new client is automatically assigned to the organization's default CRM pipeline:

```typescript
// apps/api/src/modules/channels/webhooks/telegram.ts
if (isNewSession) {
  // Emit journey started event
  await publishEvent({ type: "journey.started", ... });

  // Auto-assign to default CRM pipeline (fire-and-forget)
  assignClientToDefaultPipeline(clientId, organizationId).catch((err) => {
    log.debug({ err }, "webhook:crmAutoAssign:failed");
  });
}
```

### Implementation

```typescript
// apps/api/src/modules/crm/stage-service.ts
export async function assignClientToDefaultPipeline(clientId: string, organizationId: string): Promise<void> {
  // 1. Ensure default pipeline exists (creates if missing - lazy initialization)
  const defaultPipeline = await ensureDefaultPipeline(organizationId);

  // 2. Check if already has stage in this pipeline
  const existing = await getClientStage(clientId, organizationId, defaultPipeline.id);
  if (existing) return; // Already assigned

  // 3. Get default stage (usually "Unassigned")
  const defaultStage = await getDefaultStage(organizationId, defaultPipeline.id);
  if (!defaultStage) return;

  // 4. Assign with null assignedBy (system assignment)
  await assignClientToStage(clientId, organizationId, defaultStage.id, null, "Auto-assigned on first interaction");
}
```

### Ensuring Default Pipeline Exists

The `ensureDefaultPipeline` function uses lazy initialization to guarantee a default pipeline always exists:

```typescript
// apps/api/src/modules/crm/pipeline-service.ts
export async function ensureDefaultPipeline(organizationId: string): Promise<Pipeline> {
  // Check if default pipeline already exists
  const existing = await getDefaultPipeline(organizationId);
  if (existing) return existing;

  // Create default pipeline if missing (idempotent)
  return await createDefaultPipeline(organizationId);
}
```

This is called:

- When auto-assigning clients to the default pipeline
- When CRM nodes need to resolve a pipeline
- When loading CRM data for an organization

````

### Characteristics

- **Non-blocking**: Runs asynchronously, doesn't fail main request
- **Idempotent**: Safe to call multiple times
- **System assignment**: `assignedBy: null` indicates automatic assignment
- **Notes**: Includes explanation for audit trail

---

## API Reference

### Get All Client Stages

Returns all pipeline stages for a client:

```typescript
// GET /api/crm/clients/:clientId/stages
const stages = await getClientStages(clientId, organizationId);

// Response
[
  {
    id: "assignment-uuid",
    clientId: "telegram_123",
    organizationId: "org-uuid",
    pipelineId: "pipeline-uuid",
    pipelineName: "Default Pipeline",
    pipelineColor: "#3b82f6",
    stageId: "stage-uuid",
    stageName: "Engaged",
    stageColor: "#22c55e",
    assignedBy: null,  // System assignment
    assignedAt: "2024-01-15T10:30:00Z",
    notes: "Auto-assigned on first interaction"
  },
  {
    pipelineName: "Webinar Leads",
    stageName: "Registered",
    assignedBy: "user-uuid",  // Manual assignment
    ...
  }
]
````

### Get Stage in Specific Pipeline

```typescript
const stage = await getClientStage(clientId, organizationId, pipelineId);
```

### Assign to Stage

```typescript
await assignClientToStage(
  clientId,
  organizationId,
  stageId, // Stage determines pipeline
  assignedBy, // User ID or null
  notes // Optional
);
```

### Assign to Pipeline (Default Stage)

```typescript
await assignClientToPipeline(
  clientId,
  organizationId,
  pipelineId,
  notes // Optional
);
```

---

## UI Organization

### Contacts List View

Shows all clients with badges for their CRM stages:

```
┌──────────────────────────────────────────────────────────────┐
│ Contacts                                                      │
├──────────────────────────────────────────────────────────────┤
│ Name          │ Default CRM    │ Other Pipelines │ Journeys  │
├───────────────┼────────────────┼─────────────────┼───────────┤
│ John Doe      │ 🟢 Engaged     │ Webinar: 🔵 Reg │ Onboard ▶ │
│ Jane Smith    │ 🟡 Qualified   │ VIP: 🟣 Trial   │ Upsell ✓  │
│ Bob Wilson    │ 🔴 Churned     │ —               │ —         │
└──────────────────────────────────────────────────────────────┘
```

### CRM Kanban View

Each pipeline has its own Kanban board:

```
Pipeline: Webinar Leads
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Unassigned  │ Registered  │ Attended    │ Converted   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │
│ │ Card 1  │ │ │ John D. │ │ │ Alice   │ │ │ Bob W.  │ │
│ │ ...     │ │ │ Onboard▶│ │ │ VIP:🟣  │ │ │         │ │
│ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │
│             │ ┌─────────┐ │             │             │
│             │ │ Jane S. │ │             │             │
│             │ │ Upsell▶ │ │             │             │
│             │ └─────────┘ │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Contact Details Page

```
┌─────────────────────────────────────────────────────────────┐
│ John Doe                                         @johndoe   │
├─────────────────────────────────────────────────────────────┤
│ CRM Memberships                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Default Pipeline    │ 🟢 Engaged    │ 5 days ago       │ │
│ │ Webinar Leads      │ 🔵 Registered │ 2 days ago       │ │
│ │ VIP Customers      │ 🟣 Trial      │ Today            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Active Journeys                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Onboarding Journey  │ Step 5/8 │ "Quick Feedback" node │ │
│ │ Upsell Journey      │ Paused   │ Waiting for response   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Timeline                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Today 10:30  │ Stage: Qualified → Engaged              │ │
│ │ Today 09:15  │ Journey: Completed step "Pro Tips"      │ │
│ │ Yesterday    │ CRM: Added to VIP Customers pipeline    │ │
│ │ 2 days ago   │ Stage: Unassigned → Registered          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Guide

### Database Migration

Run migration `0017_multi_pipeline_clients.sql`:

```sql
-- 1. Add pipeline_id column
ALTER TABLE crm_client_stages ADD COLUMN pipeline_id uuid;

-- 2. Populate from stage's pipeline
UPDATE crm_client_stages cs
SET pipeline_id = ps.pipeline_id
FROM crm_pipeline_stages ps
WHERE cs.stage_id = ps.id;

-- 3. Make required and add FK
ALTER TABLE crm_client_stages ALTER COLUMN pipeline_id SET NOT NULL;
ALTER TABLE crm_client_stages ADD CONSTRAINT ... FOREIGN KEY ...;

-- 4. Change unique constraint
ALTER TABLE crm_client_stages DROP CONSTRAINT crm_client_stage_org;
CREATE UNIQUE INDEX crm_client_stage_pipeline ON crm_client_stages(client_id, pipeline_id);
```

### Code Changes Required

1. **Schema**: Update `crmClientStages` and `crmStageHistory` to include `pipelineId`
2. **Stage Service**: Update `assignClientToStage` to use new constraint
3. **Queries**: Update all queries that assumed one stage per org

---

## Example Journey Flow

### Webinar Registration Journey

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────┐
│  Start  │────▶│ CRM: Create  │────▶│  Welcome    │────▶│  Wait   │
│         │     │ Webinar/Reg  │     │  Message    │     │  1 day  │
└─────────┘     └──────────────┘     └─────────────┘     └────┬────┘
                                                              │
     ┌────────────────────────────────────────────────────────┘
     ▼
┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Attended?   │─yes─▶│ CRM: Move    │────▶│  Thanks!    │
│  (Condition) │     │ to Attended  │     │  (End)      │
└──────┬───────┘     └──────────────┘     └─────────────┘
       │ no
       ▼
┌──────────────┐     ┌──────────────┐
│  Reminder    │────▶│  No Show     │
│  Message     │     │  (End)       │
└──────────────┘     └──────────────┘
```

This journey:

1. Adds client to "Webinar Leads" pipeline at "Registered" stage
2. Sends welcome message
3. Waits 1 day
4. Checks if they attended
5. Moves to "Attended" stage if yes, or ends as no-show

---

## Journey Default Pipeline

Journeys can specify a `defaultPipelineId` that will be used by CRM nodes when they don't explicitly set a pipeline.

### Configuration

```typescript
// Journey record in database
{
  id: "journey-uuid",
  name: "Webinar Registration",
  defaultPipelineId: "webinar-pipeline-uuid",  // Optional
  configuration: { ... }
}
```

### API

```typescript
// Create journey with default pipeline
POST /api/journeys
{
  name: "Webinar Registration",
  configuration: { ... },
  defaultPipelineId: "webinar-pipeline-uuid"
}

// Update journey's default pipeline
PUT /api/journeys/:id
{
  defaultPipelineId: "new-pipeline-uuid"
}
```

### Engine Integration

The `SessionEngine` receives the journey's `defaultPipelineId` via config:

```typescript
// apps/api/src/services/session-engine-factory.ts
const engine = new SessionEngine(session, journeyConfig, adapter, {
  crmService: createCrmEngineAdapter(organizationId),
  defaultPipelineId: journey.defaultPipelineId,
  // ... other config
});
```

The engine wraps the CRM service to inject the default pipeline:

```typescript
// packages/engine/src/session-engine.ts
private createCrmServiceWrapper(crmService: CrmService): CrmService {
  return {
    addToPipeline: async (clientId, pipelineId, stageId, notes) => {
      // Use journey's default pipeline if node doesn't specify one
      const resolvedPipelineId = pipelineId || this.defaultPipelineId || undefined;
      return crmService.addToPipeline(clientId, resolvedPipelineId, stageId, notes);
    },
    // ... other methods pass through unchanged
  };
}
```

---

## Future Enhancements

### Planned Features

1. **CRM-triggered Journeys**: Start journeys when CRM stage changes
2. **Pipeline-linked Journeys**: Associate journeys with specific pipelines
3. **CRM Automations**: Rules like "move to Qualified after 3 interactions"
4. **Custom Fields**: Per-pipeline custom data on client cards
5. **Deal/Value Tracking**: Revenue tracking per pipeline

### Event-Driven Architecture

For CRM → Journey direction (future):

```typescript
// When CRM stage changes, emit event
storeEventBus.emit({
  type: "crm:stageChanged",
  payload: {
    clientId,
    pipelineId,
    fromStageId,
    toStageId,
  },
});

// Automation handler can listen and trigger journeys
automationEventService.subscribe("crm:stageChanged", async (event) => {
  const triggers = await findTriggersForCrmEvent(event);
  for (const trigger of triggers) {
    await startJourneySession(trigger.journeyId, event.clientId);
  }
});
```

---

## Related Documentation

- [Engine Architecture](../diagrams/05-engine-architecture.md)
- [Node Plugin Architecture](../diagrams/04-node-plugin-architecture.md)
- [Adding New Node Type](./adding-new-node-type.md)
- [State Management](../diagrams/08-state-management.md)
