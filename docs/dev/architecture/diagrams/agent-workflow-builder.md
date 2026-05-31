# Agent Workflow Builder Diagram

> Focused architecture for the agent workflow builder (/agents/$agentKey).

## Builder Overview

```
+-------------------------------------------------------------------------------------------+
| Route: /agents/$agentKey                                                                    |
| apps/web/src/routes/_dashboard.agents.$agentKey.tsx                                          |
+-------------------------------------------------------------------------------------------+
| AgentWorkflowBuilderPage                                                                    |
| - loads workflow + versions (useAgentWorkflow, useAgentWorkflowVersions)                    |
| - initializes agentWorkflowStore and header controls                                        |
| - saves workflow + version snapshots                                                        |
|                                                                                             |
| +---------------------------------------------------------------------------------------+   |
| | AgentWorkflowLayout                                                                    |   |
| |  +-----------------------------------------+  +-------------------------------------+ |   |
| |  | Canvas (React Flow)                     |  | Sidebar (Simulator/Test)            | |   |
| |  | - AgentWorkflowCanvas                   |  | - WorkflowSimulatorControls         | |   |
| |  | - NodeSelectorPanel                     |  | - WorkflowChatPanel                 | |   |
| |  | - NodeConfigPanel                       |  | - WorkflowConsolePanel              | |   |
| |  +-----------------------------------------+  +-------------------------------------+ |   |
| +---------------------------------------------------------------------------------------+   |
|                                                                                             |
| Stores:                                                                                     |
| - agentWorkflowStore (nodes, edges, history, settings, simulator highlights)                |
| - agentTestStore (chat, console events, execution state)                                    |
+-------------------------------------------------------------------------------------------+
```

## Data and State Flow

```mermaid
flowchart LR
  Route["/_dashboard/agents/$agentKey"] --> Page["AgentWorkflowBuilderPage"]
  Page -->|query| Query["useAgentWorkflow + useAgentWorkflowVersions"]
  Page -->|init| WorkflowStore["agentWorkflowStore"]
  Page -->|controls| HeaderStore["agent-workflow-header-store"]

  subgraph UI["Agent workflow UI"]
    Canvas["AgentWorkflowCanvas (React Flow)"]
    Config["NodeConfigPanel"]
    Sidebar["Simulator Sidebar"]
    Chat["WorkflowChatPanel"]
    Console["WorkflowConsolePanel"]
  end

  WorkflowStore <--> Canvas
  WorkflowStore <--> Config
  WorkflowStore <--> Sidebar
  Chat --> WorkflowStore

  subgraph TestStore["agentTestStore"]
    Messages["messages + conversationId"]
    Events["console events"]
  end

  TestStore <--> Chat
  TestStore <--> Console

  subgraph WebAPI["apps/web shared/lib/api"]
    Workflows["workflowsApi"]
    Versions["workflowVersionsApi"]
  end

  Query --> Workflows
  Query --> Versions
  Page -->|save| Workflows
  Page -->|save version| Versions
  Chat -->|execute| Workflows

  subgraph Backend["apps/api routes"]
    WorkflowsRoute["/api/workflows"]
    VersionsRoute["/api/workflow-versions"]
  end

  Workflows --> WorkflowsRoute
  Versions --> VersionsRoute
```

## Simulator Execution Flow

```mermaid
sequenceDiagram
  participant User
  participant Chat as WorkflowChatPanel
  participant WorkflowStore as agentWorkflowStore
  participant TestStore as agentTestStore
  participant API as workflowsApi.execute
  participant Backend as apps/api /api/workflows/:key/execute

  User->>Chat: send message
  Chat->>TestStore: addUserMessage + console events
  Chat->>WorkflowStore: clearVisitedNodes
  Chat->>API: execute workflow
  API->>Backend: POST /api/workflows/:key/execute
  Backend-->>API: execution trace + message
  API-->>Chat: result
  Chat->>TestStore: addAssistantMessage + console events
  Chat->>WorkflowStore: highlight path (nodes/edges)
```

## Key Files

- `apps/web/src/routes/_dashboard.agents.$agentKey.tsx`
- `apps/web/src/features/agent-workflows/pages/agent-workflow-builder-page.tsx`
- `apps/web/src/features/agent-workflows/components/layout/agent-workflow-layout.tsx`
- `apps/web/src/features/agent-workflows/components/canvas/agent-workflow-canvas.tsx`
- `apps/web/src/features/agent-workflows/components/test-panel/workflow-chat-panel.tsx`
- `apps/web/src/features/agent-workflows/components/console/workflow-console-panel.tsx`
- `apps/web/src/features/agent-workflows/components/version-panel/agent-workflow-version-panel.tsx`
- `apps/web/src/features/dashboard/store/agent-workflow-header-store.ts`
- `apps/web/src/features/agent-workflows/stores/agent-workflow-store.ts`
- `apps/web/src/features/agent-workflows/stores/agent-test-store.ts`
- `apps/web/src/shared/lib/api/workflows.ts`
- `apps/web/src/shared/lib/api/workflow-versions.ts`
- `apps/api/src/modules/workflows/routes/index.ts`
- `apps/api/src/modules/workflows/versions.ts`
