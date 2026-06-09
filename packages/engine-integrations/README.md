# @journey/engine-integrations

Production implementations of the service interfaces declared by [`@journey/engine`](../engine), backed by PostgreSQL and the LLM stack. The engine stays pure; this package wires it to the real database and AI services.

Provides:

- **AgentWorkflowService** — load and execute agent workflows from the database
- **MemoryService** — long-term semantic memory with pgvector
- **buildAgentMiddleware** — convert agent config into a middleware pipeline

## Usage

```typescript
import { createEngineIntegrations } from "@journey/engine-integrations";

const integrations = createEngineIntegrations({
  clientId: "user-123",
  organizationId: "org-456",
  journeyId: "journey-789", // optional
});

const engine = new SessionEngine(session, journey, adapter, {
  agentWorkflowService: integrations.agentWorkflowService,
  memoryService: integrations.memoryService,
});
```

**Documentation:** See [docs/engine-integrations/README.md](/docs/engine-integrations/README.md)
