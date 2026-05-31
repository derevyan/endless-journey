# Journey

> ## ⚠️ Heads up — read before using
>
> I built this **for my wife, for fun**. It's heavily _vibe-coded_ (AI-assisted,
> fast-and-loose) and shared **as-is** under the MIT license. It is **not**
> production-hardened: expect rough edges, sharp corners, and missing safeguards.
>
> **Use at your own risk.** Don't point it at real user data or secrets you care
> about, and review the code before deploying anything. No warranty, no support.
> Made with 💛.

Journey is a no-code platform for building, simulating, and running **automated chat flows** — drag-and-drop conversations powered by AI agents and delivered over messaging channels like Telegram. Design a flow visually, test it in a live simulator, then let the runtime engine execute it for real users.

## What it solves

Building a conversational product — an onboarding sequence, a support bot, a survey, a lead-nurture flow — usually means writing and wiring up a lot of custom code. Journey turns that into something you can **draw**: lay the conversation out as a flowchart, drop in AI agents where you need intelligence, branch on user input or logic, and connect it to messaging, webhooks, and a CRM. Test the whole thing in a simulator, then publish it to run against real users on Telegram.

Typical use cases: product onboarding, support triage, questionnaires & assessments, lead qualification, and coaching / follow-up flows.

## Features

### Visual flow builder

Compose conversations on a canvas from typed, drag-and-drop nodes:

- **Message** (with quick-reply buttons), **AI Agent**, **Condition** (JS expressions for routing), **Questionnaire** (sequential Q&A with a shared timeout & progress), **Wait** (timers, e.g. "5 min" or "1 day"), **Webhook** (call any API, store the response in a variable, retry/continue on error), **Teleport** (jump between flows), **Start / End**, plus a **Follow-Up** plugin.
- Labelled branching edges and multi-path routing, undo/redo, auto-layout, and full **versioning** (publish / discard / history).

### AI agents

- Design **single- and multi-agent workflows** — intent routers, if/else branching, guardrails, and memory.
- Agents can call tools (web fetch, Wikipedia, search) and hand off to one another.
- A reusable agent library (Demo Assistant, Multi-Agent Router, Memory Agent, Question Understanding, …).

### MindState

- **Theory-of-Mind–inspired** state tracking — much like a person inferring what someone else is thinking and feeling, MindState models each user's **emotional, cognitive, and motivational state** as a conversation unfolds, so flows can adapt to how someone actually feels.
- A main companion agent plus specialized sub-agents (General Observer, Emotion Analyzer, Cognitive Analyst, Motivation Tracker).
- Configurable parameters across categories — Mood, Stress, Energy, Focus, Cognitive Load, Interest, Urgency, Rapport, Topic Familiarity — with live state values and an Insights view.

### Prompt builder

- A **versioned prompt library** (chat & text prompts) with production versions and a focused editor.
- Includes voice-director prompts that shape ElevenLabs **text-to-speech** output.

### Simulator

- Run any flow in a **live chat** without leaving the builder — pick a test user (or stay Anonymous), step through the conversation, and watch a **real-time event console** with an optional debug view.

### CRM

- Multiple **pipelines** (Sales, Support, Partner Onboarding) as kanban boards with customizable stages.
- Drag contacts between stages, tag and segment them (VIP, enterprise, churned, …), and message them directly.

### Audience & users

- A unified **user list** across all flows — platform (Telegram), session counts, last-active, tags, and per-flow filtering.

### Channels & integrations

- **Telegram** delivery (webhooks, typing indicators), **voice** via ElevenLabs TTS (voice-only and voice-to-voice modes), and multiple **LLM providers** (OpenAI, Anthropic, Gemini, Groq, Cerebras).
- Web search (Tavily), media storage (MinIO), and external tools for agents via the **Model Context Protocol (MCP)**.

### Under the hood

- A runtime **engine** executes flows for real users with durable **sessions**, scheduled **timers** (BullMQ / Redis), global & per-flow **variables**, rate limiting, and circuit breakers — plus an **Events / Logs** view for debugging live runs.

## Screenshots

**Flow builder** — drag-and-drop nodes (message, AI agent, condition, webhook, timer, questionnaire…) wired into branching conversations:

![Flow builder](docs/screenshots/journey-builder.png)

**Simulator** — test a flow in a live chat with a real-time event console:

![Simulator](docs/screenshots/simulator.png)

| Agent builder — multi-agent workflows | MindState — mood / focus / stress tracking |
| :---: | :---: |
| ![Agent builder](docs/screenshots/agent-builder.png) | ![MindState](docs/screenshots/mindstate.png) |

| Prompt builder — versioned prompt editor | CRM — drag contacts across pipeline stages |
| :---: | :---: |
| ![Prompt builder](docs/screenshots/prompt-builder.png) | ![CRM](docs/screenshots/crm.png) |

| Dashboard — workspace overview | Users — audience & Telegram contacts |
| :---: | :---: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Users](docs/screenshots/users.png) |

| Flow library — your active flows |
| :---: |
| ![Flow library](docs/screenshots/journey-list.png) |

## Tech stack

### Frontend (apps/web)

- React 19
- Vite 6
- TanStack Router, Query, Store, Form
- Tailwind CSS v4
- Radix UI and shadcn/ui
- @xyflow/react

### Backend (apps/api)

- Hono
- Drizzle ORM + PostgreSQL
- BullMQ + Redis

### Service (apps/mcp)

- Hono-based MCP service for agent tool orchestration

### Shared packages

- Zod schemas in @journey/schemas
- Execution engine in @journey/engine
- Engine integrations in @journey/engine-integrations
- Database schema/client in @journey/db
- Structured logging in @journey/logger
- LLM utilities in @journey/llm
- Mindstate utilities in @journey/mindstate
- Infra helpers in @journey/infra
- MCP client/types in @journey/mcp

### Monorepo and testing

- Turborepo, pnpm
- Vitest, Playwright

## Project structure

```
journey/
├── apps/
│   ├── web/                       # React frontend
│   │   └── src/
│   │       ├── features/          # Feature modules
│   │       ├── shared/            # Shared components, hooks, lib
│   │       ├── stores/            # Global stores
│   │       ├── routes/            # TanStack Router pages
│   │       ├── providers/         # React context providers
│   │       ├── hooks/             # App-wide hooks
│   │       └── data/              # Sample journeys and fixtures
│   ├── api/                       # Hono API server
│   │   └── src/
│   │       ├── modules/           # Domain modules and routers
│   │       ├── services/          # Business logic
│   │       ├── adapters/          # External integrations
│   │       ├── event-bus/         # Event bus utilities
│   │       ├── config/            # Config and env handling
│   │       └── lib/               # Shared helpers
│   └── mcp/                       # MCP service
│       └── src/
│           ├── routes/            # MCP HTTP endpoints
│           ├── services/          # MCP manager and orchestration
│           └── config/            # MCP config
├── packages/
│   ├── engine/                    # Journey runtime engine
│   ├── engine-integrations/       # Engine integrations
│   ├── schemas/                   # Zod schemas and shared types
│   ├── db/                        # Database schema and client
│   ├── logger/                    # Structured logging
│   ├── llm/                       # LLM utilities
│   ├── mindstate/                 # Mindstate utilities
│   ├── infra/                     # Shared infrastructure helpers
│   └── mcp/                       # MCP client and types
├── docs/                          # Project documentation
└── scripts/                       # Repo scripts
```

## Development

Prereqs:

- Node.js 18+
- pnpm 9+
- Docker (for PostgreSQL, Redis, and MinIO)

Setup:

```bash
pnpm install

# Copy env files, then fill in secrets + LLM keys (generation hints are in the files)
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env

# Start infra, create the schema, and seed demo data
docker compose -f service/docker/docker-compose.yml up -d   # Postgres + Redis + MinIO
pnpm db:reset-full

# Run everything (web :3000 · api :3001 · mcp :3002)
pnpm dev
```

Then log in with the demo credentials below. Other useful commands:

```bash
pnpm typecheck
pnpm test
```

## Demo credentials (local dev)

See `START.md` for setup details. After seeding, use:

| User      | Email             | Password  |
| --------- | ----------------- | --------- |
| Demo User | demo@journey.app  | demo1234  |
| Arina     | arina@journey.app | arina1234 |

## Documentation

Start here:

- docs/dev/architecture/project-structure.md
- docs/dev/guides/junior-developer-guide.md
- docs/api/README.md
- docs/db/README.md
- docs/logger/README.md
- docs/mcp/README.md

## License

MIT © Andrew Derevo — see [LICENSE](./LICENSE). Provided as-is, with no warranty of any kind.
