# API Architecture

This document describes the `apps/api` backend at a high level, focusing on the primary request paths and background services.

## Overview

The API is responsible for:

- HTTP routes for journeys, sessions, CRM, simulator, workflows, uploads, audio, mindstates
- Agent tools + model registry endpoints
- Auth + org context via Better Auth
- Unified event bus (log/SSE/automation consumers)
- Timers, approvals, automation processing, data retention (BullMQ)
- Telegram + simulator adapters
- Tool discovery via MCP service

---

## High-Level Diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              API SERVER (Hono)                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  HTTP Layer                                                                   │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────────┐   │
│  │  Routes  │ │ Auth + Org │ │ Validation │ │ Rate Limit│ │ Tracing      │   │
│  │ /api/*   │ │ BetterAuth │ │   (Zod)    │ │  (Redis)  │ │ (ALS)        │   │
│  └──────────┘ └────────────┘ └────────────┘ └───────────┘ └──────────────┘   │
│          │                                                                    │
│          ▼                                                                    │
│  Service Layer                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐        │
│  │ Journey  │ │ Session  │ │  CRM     │ │ Workflow │ │  Simulator   │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐        │
│  │ Channel  │ │ Mindstate│ │ Variables│ │ Uploads  │ │ Agent Tools  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘        │
│          │                                                                    │
│          ▼                                                                    │
│  Event Bus                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐                                    │
│  │ Log      │ │ SSE      │ │ Automation │                                    │
│  │ Consumer │ │ Consumer │ │ Consumer   │                                    │
│  └──────────┘ └──────────┘ └────────────┘                                    │
│          │            │              │                                       │
│          ▼            ▼              ▼                                       │
│      events +     Redis Pub/Sub   BullMQ queue                               │
│     interactions      (SSE)       (journey-events)                           │
│                                                                              │
│  Background Services                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────────┐             │
│  │ Timers   │ │ Approvals│ │ Retention    │ │ LLM Usage Track │             │
│  │ (BullMQ) │ │ (BullMQ) │ │ (BullMQ)     │ │ (DB)            │             │
│  └──────────┘ └──────────┘ └──────────────┘ └─────────────────┘             │
│  ┌──────────────────────────┐                                                │
│  │ Model Registry (models.dev)│                                               │
│  └──────────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────────┘
     │             │            │              │               │
     ▼             ▼            ▼              ▼               ▼
 PostgreSQL      Redis        BullMQ         MinIO           MCP Service
```

---

## Mermaid Diagram

```mermaid
flowchart TB
  subgraph API[API Layer - apps/api]
    ROUTES[Hono Routes]
    AUTH[Auth + Org Context]
    VALID[Zod Validation]
    TRACE[Tracing]

    ROUTES --> SERVICES
    AUTH --> ROUTES
    VALID --> ROUTES
    TRACE --> ROUTES

    subgraph SERVICES[Services]
      JOURNEY[Journey]
      SESSION[Session]
      CRM[CRM]
      WORKFLOW[Workflows]
      SIM[Simulator]
      UPLOADS[Uploads]
      AUDIO[Audio]
      MIND[Mindstates]
      CHANNELS[Channels]
      VARIABLES[Variables]
      AGENTTOOLS[Agent Tools]
      MODELS[Models]
    end

    subgraph EVENTS[Event Bus]
      LOG[log-consumer]
      SSE[sse-consumer]
      AUTO[automation-consumer]
    end

    SERVICES --> EVENTS
  end

  LOG --> EVENTS_TABLE[(events)]
  LOG --> INTERACTIONS[(interactions)]
  SSE --> REDIS[(Redis Pub/Sub)]
  AUTO --> QUEUE[(BullMQ - journey-events)]

  SERVICES --> DB[(PostgreSQL)]
  SERVICES --> STORAGE[(MinIO/S3)]
  SERVICES --> MCP[(MCP service)]
  SERVICES --> ENGINE[@journey/engine]
  SERVICES --> LLM[@journey/llm]
```

---

## Key Directories (Representative)

```
apps/api/src/
├── app.ts                  # Hono app config (CORS, limits, auth)
├── index.ts                # Service initialization + shutdown
├── modules/                # Domain routes + services (vertical slices)
├── services/               # Cross-cutting services (timers, cache, runtime)
├── events/                 # Event bus, consumers, publishers
├── adapters/               # Telegram + simulator adapters
└── lib/                    # Auth, rate limit, Redis, errors, tracing
```

---

## Runtime Services (Initialized in index.ts)

- Model registry + usage tracking (`@journey/llm`)
- MCP service client
- Event bus + consumers
- Timer service + recovery
- Automation event service
- Data retention service
- Workflow approval service

---

## Related Docs

- `docs/api/README.md` - API overview
- `docs/api/routes.md` - endpoint map
- `docs/dev/architecture/event-pipeline.md` - event bus details
