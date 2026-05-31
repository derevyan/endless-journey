# System Architecture Overview

> Comprehensive architecture documentation for the Journey Builder platform.

## Executive Summary

**Journey Builder** is a visual state machine builder for messaging platforms. It enables users to design, test, and deploy automated conversational journeys across Telegram and the backend simulator, with pluggable channel adapters for future platforms.

### Key Capabilities

- **Visual Journey Editor** - Drag-and-drop canvas for designing conversation flows
- **Multi-Channel Support** - Telegram today, extensible adapters for future channels
- **AI Agent Nodes** - LLM-powered tool calling with variable access policies, conversation persistence, and token tracking
- **CRM Integration** - Pipeline management, custom fields, client tracking
- **MindState Analysis** - Real-time psychological state tracking (ECS-based)
- **Automation System** - Event-driven triggers and actions
- **Real-time Simulator** - Test journeys before deployment
- **Resilient Engine** - Durable timers, Redis-backed session caching, distributed locks
- **Validation + Testing Tooling** - Journey Analyzer + Variation Tester for fast preflight checks

---

## Technology Stack

### Frontend

| Technology          | Version | Purpose                 |
| ------------------- | ------- | ----------------------- |
| React               | 19      | UI framework            |
| TanStack Router     | -       | File-based routing      |
| TanStack Query      | -       | Server state management |
| TanStack Store      | -       | Client state management |
| TanStack Form       | -       | Form handling           |
| React Flow (XYFlow) | v12     | Node/edge canvas        |
| Tailwind CSS        | v4      | Styling                 |
| Radix UI            | -       | Accessible primitives   |
| Vite                | -       | Build tool              |

### Backend

| Technology  | Version | Purpose                        |
| ----------- | ------- | ------------------------------ |
| Hono.js     | -       | API framework                  |
| Better Auth | -       | Authentication + Organizations |
| BullMQ      | -       | Job queues                     |
| Drizzle ORM | -       | Database access                |
| PostgreSQL  | -       | Primary database               |
| Redis       | -       | Caching, pub/sub, queues       |
| S3-compatible (MinIO default) | - | Media storage                 |

### AI/LLM

| Technology | Purpose                          |
| ---------- | -------------------------------- |
| LangChain  | LLM orchestration & tool calling |
| OpenAI     | GPT-4o, GPT-4 Turbo models       |
| Anthropic  | Claude 3.5, Claude 3 models      |
| Google     | Gemini 1.5, Gemini 2.0 models    |
| GROQ       | Llama models (fast inference)    |

### MCP Service

- `apps/mcp` runs as a standalone service (default `:3002`) to isolate external tool execution.
- `@journey/llm` loads MCP tools through the `@journey/mcp` client.
- See `docs/llm/mcp-architecture.md` for endpoints and configuration.

### Infrastructure

| Technology | Purpose             |
| ---------- | ------------------- |
| Turborepo  | Monorepo management |
| pnpm       | Package management  |
| Docker     | Containerization    |
| TypeScript | Type safety         |

---

## Developer Quick Start

Common entry points for engine work:

- `docs/engine/README.md` for architecture, services, and node handlers
- `docs/engine/bindings-system.md` for templates/expressions and namespaces
- `pnpm journey:analyze <journey.json>` for fast structural checks
- `pnpm journey:test <journey.json>` for path/input/race coverage

---

## High-Level Architecture

### ASCII Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   Web App   │  Telegram   │  Simulator  │ API Clients │  Webhooks   │
│  (React 19) │    Bot      │  (Web UI)   │  (REST)     │  (External) │
│   :3000     │             │             │             │             │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       │    ┌────────┴─────────────┴─────────────┴─────────────┘
       │    │
       ▼    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API LAYER (Hono.js :3001)                       │
├─────────────────────────────────────────────────────────────────────┤
│  Authentication: Better Auth (Sessions + Organizations)              │
│  Routes: /journeys, /sessions, /variables, /crm, /simulator, etc.   │
│  Real-time: SSE (Server-Sent Events) → Redis Pub/Sub                │
│  Webhooks: /webhook/telegram/:channelId                             │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                   │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   Journey   │   Session   │     CRM     │    Timer    │  Automation │
│   Service   │   Service   │   Service   │   Service   │   Handler   │
│             │             │             │  (BullMQ)   │             │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│   Variable  │    Tag      │   Client    │   Audio     │  MindState  │
│   Service   │   Service   │   Service   │   Service   │   Service   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       ▼             ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│           ENGINE INTEGRATIONS (@journey/engine-integrations)         │
├─────────────────────────────────────────────────────────────────────┤
│  DB/LLM-backed services for agent workflows, memory, and summaries   │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ENGINE LAYER (@journey/engine)                    │
├─────────────────────────────────────────────────────────────────────┤
│  SessionEngine                                                       │
│    ├── Event Queue + Event Router                                   │
│    ├── Handler Registry (strategy pattern per node type)            │
│    ├── Middleware Pipeline (tags, variables, CRM)                   │
│    └── Service Factory (messenger, timer, webhook, etc.)            │
│                                                                      │
│  Node Handlers:                                                      │
│    start │ message │ condition │ wait │ webhook │ crm │             │
│    teleport │ questionnaire │ agent │ end                           │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                               │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│  PostgreSQL │    Redis    │   BullMQ    │ S3-compatible│    LLM      │
│  (Drizzle)  │  (Pub/Sub)  │  (Queues)   │  (Media)    │  Providers  │
│             │  (Cache)    │  (Timers)   │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

### Mermaid Diagram

```mermaid
flowchart TB
    subgraph Clients["Client Layer"]
        WEB[Web App<br/>React 19 :3000]
        TG[Telegram Bot]
        SIM[Simulator UI]
        API_CLIENTS[API Clients]
        WH[External Webhooks]
    end

    subgraph API["API Layer (Hono.js :3001)"]
        AUTH[Better Auth]
        ROUTES[REST Routes]
        SSE[SSE Events]
        WEBHOOKS[Webhook Handlers]
    end

    subgraph Services["Service Layer"]
        JS[Journey Service]
        SS[Session Service]
        CRM[CRM Service]
        TS[Timer Service]
        AS[Automation Handler]
        VS[Variable Service]
        TGS[Tag Service]
        MS[MindState Service]
    end

    subgraph EngineInt["Engine Integrations"]
        EI[@journey/engine-integrations]
    end

    subgraph Engine["Engine Layer (@journey/engine)"]
        SE[Session Engine]
        HR[Handler Registry]
        MW[Middleware Pipeline]
        SF[Service Factory]
    end

    subgraph Infra["Infrastructure"]
        PG[(PostgreSQL)]
        RD[(Redis)]
        BQ[BullMQ]
        S3[(S3-compatible Storage<br/>MinIO default)]
        LLM[LLM Providers]
    end

    WEB --> API
    TG --> WEBHOOKS
    SIM --> API
    API_CLIENTS --> API
    WH --> WEBHOOKS

    API --> Services
    Services --> EngineInt
    EngineInt --> Engine
    Engine --> Infra

    SE --> HR
    SE --> MW
    SE --> SF
```

---

## Package Structure

### Monorepo Organization

```
journey/
├── apps/
│   ├── api/                 # REST API server (Hono.js)
│   ├── mcp/                 # MCP service (Hono.js)
│   └── web/                 # React 19 web application
│
├── packages/
│   ├── schemas/             # Zod schemas (single source of truth)
│   ├── logger/              # Structured logging (Pino)
│   ├── db/                  # Database schema (Drizzle ORM)
│   ├── infra/               # Infra primitives (circuit breaker, etc.)
│   ├── llm/                 # LLM abstractions (LangChain)
│   ├── mcp/                 # MCP client + types
│   ├── engine-integrations/ # Engine adapters (DB/LLM)
│   ├── mindstate/           # ECS psychology tracking
│   └── engine/              # Journey execution engine (core runtime)
│
├── docs/                    # Documentation
├── turbo.json               # Turborepo config
└── package.json             # Root package
```

### Package Dependency Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Level 5: APPS                                                   │
│  ├── @journey/web (→ engine, logger, schemas)                   │
│  ├── @journey/api (→ all packages)                              │
│  └── @journey/mcp-service (→ mcp, logger)                       │
├─────────────────────────────────────────────────────────────────┤
│  Level 4: BUSINESS LOGIC                                         │
│  ├── @journey/engine (→ infra, logger, schemas)                  │
│  └── @journey/mindstate (→ llm, logger, schemas)                 │
├─────────────────────────────────────────────────────────────────┤
│  Level 3: INTEGRATIONS                                           │
│  ├── @journey/llm (→ db, infra, mcp, logger, schemas)            │
│  ├── @journey/mcp (→ infra, logger)                              │
│  └── @journey/engine-integrations (→ db, llm, engine, logger, schemas) │
├─────────────────────────────────────────────────────────────────┤
│  Level 2: INFRASTRUCTURE                                         │
│  ├── @journey/db (→ schemas, logger)                             │
│  └── @journey/infra (→ schemas, logger)                          │
├─────────────────────────────────────────────────────────────────┤
│  Level 1: FOUNDATION                                             │
│  └── @journey/schemas (→ none)                                   │
├─────────────────────────────────────────────────────────────────┤
│  Level 0: CORE UTILS                                             │
│  └── @journey/logger (0 dependencies)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Patterns

### 1. Unified Service Layer (SharedServiceContext)

All execution contexts access services through a unified interface:

```
┌─────────────────────────────────────────────────────────────────────┐
│                   SharedServiceContext                               │
│  (Single interface for all service access - @journey/schemas)       │
│                                                                      │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│   │ variable │ │messenger │ │  memory  │ │mindstate │ │   crm    │ │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│   │   tag    │ │ template │ │   dlq    │ │expression│ │  cache   │ │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────────┘
              │                    │                    │
              ▼                    ▼                    ▼
     ExecutionContext      WorkflowContext      BuiltinToolContext
     (Journey Engine)      (LLM Workflows)        (LLM Tools)
```

**Benefits:**

- Same API everywhere (engine, workflows, tools)
- Easy to add new services (modify only schemas + factory)
- No-op factory enables effortless testing
- Permission system with capability-based access control

See [Unified Services Architecture](./unified-services/README.md) for details.

### 2. Single Source of Truth for Types

All types defined in `@journey/schemas`:

- Zod schemas with automatic type inference
- Web app re-exports + React Flow extensions
- No type duplication across packages

### 3. Strategy Pattern for Node Handlers

```typescript
// Handler Registry
const handlers = {
  start: StartHandler,
  message: MessageHandler,
  condition: ConditionHandler,
  agent: AgentHandler,
  // ... etc
};

// Usage in engine
const handler = handlers[node.type];
const result = await handler.execute(context);
```

### 4. Event-Driven Store Communication

```typescript
// Store emits event
storeEventBus.emit({ type: "node:updated", payload: { nodeId, updates } });

// Other stores subscribe
storeEventBus.on("node:updated", (event) => {
  // React to change
});
```

### 5. Middleware Pipeline

```
User Input → Engine → Handler → Middleware Pipeline → Response
                                      │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             ▼
                   Tag Middleware  Variable MW   CRM MW
```

### 6. Adapter Pattern for Messaging

```typescript
interface MessagingAdapter {
  adapterType: "telegram" | "whatsapp" | "simulator" | "mock";
  sendMessage(userId: string, message: JourneyMessage): Promise<SendResult>;
  scheduleTimer(sessionId: string, durationMs: number): Promise<string>;
  cancelTimer(timerId: string): Promise<boolean>;
}
```

### 7. EventQueue FIFO Processing

Serializes all incoming events through a single processing chain, preventing race conditions:

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT QUEUE PATTERN                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Message ──┐                                            │
│                 ├──► [ Event Queue ] ──► Process One-by-One  │
│  Timer Fire ────┘        (FIFO)                              │
│                                                              │
│  Prevents: Race conditions when timer fires during message   │
│  Location: packages/engine/src/event-queue.ts                │
└─────────────────────────────────────────────────────────────┘
```

### 8. Dead Letter Queue (DLQ)

Failed events are captured for debugging and potential replay:

```typescript
// packages/engine/src/services/dlq-service.ts
interface DeadLetterEntry {
  event: SessionEvent;
  error: Error;
  sessionId: string;
  journeyId: string;
  timestamp: Date;
}
```

### 9. Atomic Timer Guards

Uses PostgreSQL `UPDATE ... RETURNING` to prevent double-processing of timers:

```typescript
// Atomic update - only one process can fire the timer
const updated = await db
  .update(timers)
  .set({ status: "fired" })
  .where(and(eq(id, timerId), eq(status, "active")))
  .returning();
// If updated.length === 0, timer was already handled by another process
```

---

## Development Environment

### Running Locally

```bash
# Start all services
pnpm dev

# Individual services
pnpm --filter @journey/api dev     # API on :3001
pnpm --filter @journey/web dev     # Web on :3000
```

### Key Environment Variables

```bash
# Database
DATABASE_URL=postgres://journey:journey_dev@localhost:5432/journey

# Redis (timers, events, cache)
REDIS_URL=redis://localhost:6379

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# S3-compatible storage (MinIO default)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=journey-media
```

### Ports

| Service    | Port | Purpose                  |
| ---------- | ---- | ------------------------ |
| Web App    | 3000 | React frontend           |
| API        | 3001 | REST API + webhooks      |
| PostgreSQL | 5432 | Primary database         |
| Redis      | 6379 | Cache + pub/sub + queues |

---

## Related Documentation

### Architecture

- [Unified Services Architecture](./unified-services/README.md) - SharedServiceContext and service layer
- [Package Architecture](./packages.md) - Detailed package documentation
- [Data Flows](./data-flows.md) - Key data flow diagrams
- [Database Schema](./database-schema.md) - ERD and relationships
- [API Reference](./api-reference.md) - Endpoint documentation

### Unified Services Deep Dives

- [Service Interfaces](./unified-services/service-interfaces.md) - All service interface specifications
- [Variable Namespaces](./unified-services/variable-namespaces.md) - `{{vars.scope.key}}` syntax
- [Event Bridge](./unified-services/event-bridge.md) - SSE to store event sync
- [Permission Model](./unified-services/permission-model.md) - Capability-based access control
- [Type Conversion](./unified-services/type-conversion.md) - Type coercion utilities
- [Testing Patterns](./unified-services/testing-patterns.md) - No-op factories and mocking
