# Architecture Diagrams

> Visual documentation of Journey Builder's architecture and module relationships.

## Diagram Index

| Diagram                                           | Description                                    |
| ------------------------------------------------- | ---------------------------------------------- |
| [System Overview](./system-overview.md)           | High-level architecture, all layers, data flow |
| [Package Dependencies](./package-dependencies.md) | Monorepo package relationships                 |
| [Engine Architecture](./engine-architecture.md)   | Session engine, handlers, middleware           |
| [Web App Architecture](./web-app-architecture.md) | Frontend structure, features, routing          |
| [Agent Workflow Builder](./agent-workflow-builder.md) | Agent workflow builder UI, state, and API flow |
| [Auth Flow](./auth-flow.md)                       | Session, login, and organization flow          |
| [Store Architecture](./store-architecture.md)     | TanStack stores, event bus, coordination       |
| [Node System](./node-system.md)                   | Node types, handlers, editors                  |
| [LLM Architecture](./llm-architecture.md)         | AI services, tools, middleware, workflows      |
| [API Architecture](./api-architecture.md)         | Routes, services, adapters                     |
| [Data Model](./data-model.md)                     | Database schema relationships                  |
| [Mindstate Pipeline](./mindstate-pipeline.md)     | Mindstate pipeline steps + persistence flow    |

---

## Quick Reference

### Layer Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JOURNEY BUILDER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PRESENTATION        apps/web (React 19 + TanStack + React Flow)    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  API LAYER           apps/api (Hono.js + Better Auth + BullMQ)      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌──────────────┐  ┌────────────────────┐  ┌──────────────┐               │
│  │   engine     │  │ engine-integrations│  │     llm      │               │
│  │ (execution)  │  │ (DB/LLM adapters)  │  │ (AI/tools)   │               │
│  └──────────────┘  └────────────────────┘  └──────────────┘               │
│  ┌──────────────┐  ┌──────────────┐                                       │
│  │  mindstate   │  │     mcp      │                                       │
│  │ (ECS psych)  │  │ (protocol)   │                                       │
│  └──────────────┘  └──────────────┘                                       │
│                                      │                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │      db      │  │    logger    │  │    infra     │                       │
│  │  (Drizzle)   │  │   (Pino)     │  │ (resilience) │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  FOUNDATION          packages/schemas (Zod - Single Source of Truth) │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer          | Technologies                                                              |
| -------------- | ------------------------------------------------------------------------- |
| Frontend       | React 19, TanStack (Router/Query/Store/Form), React Flow v12, Tailwind v4 |
| API            | Hono.js, Better Auth, BullMQ, Drizzle ORM                                 |
| AI             | LangChain, OpenAI, Anthropic, Google GenAI, Groq                           |
| Database       | PostgreSQL, Redis                                                         |
| Infrastructure | Turborepo, pnpm, Docker, TypeScript                                       |

---

## Diagram Conventions

### Shapes

```
┌─────────────┐
│  Component  │   Rectangle = Module/Component
└─────────────┘

╔═════════════╗
║   Package   ║   Double-line = Package boundary
╚═════════════╝

┌─────────────┐
│  ┌───────┐  │
│  │ Inner │  │   Nested = Contains
│  └───────┘  │
└─────────────┘

    ─────►        Arrow = Data/control flow
    ─ ─ ─►        Dashed = Optional/async
```

### Colors (in Mermaid)

| Color  | Meaning            |
| ------ | ------------------ |
| Blue   | Presentation layer |
| Green  | Business logic     |
| Orange | Infrastructure     |
| Purple | AI/LLM             |
| Gray   | Foundation         |

---

## Related Documentation

- [System Overview](../system-overview.md) - Detailed architecture docs
- [Unified Services](../unified-services/README.md) - Service layer architecture
- [Data Flows](../data-flows.md) - Runtime data flows
- [Packages](../packages.md) - Package details
