# Quick Start Guide

This guide will help you get the Journey Builder running locally for development and testing.

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+
- **Docker** (for PostgreSQL, Redis, and MinIO)

> Journey runs on Node.js — the API and MCP services execute TypeScript directly with `tsx`, so there's no separate build step in dev.

## 1. Start Infrastructure

Start PostgreSQL, Redis, and MinIO using Docker Compose:

```bash
docker compose -f service/docker/docker-compose.yml up -d
```

Verify containers are running:

```bash
docker compose -f service/docker/docker-compose.yml ps
```

You should see:

- `journey-postgres` on port 5432 (PostgreSQL 18 + pgvector)
- `journey-redis` on port 6379
- `journey-minio` on port 9000 (S3-compatible object storage)

## 2. Install Dependencies

From the project root:

```bash
pnpm install
```

## 3. Configure Environment

Each app/package that needs config ships a `.env.example` with inline hints. Copy them and fill in the blanks:

```bash
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env
cp apps/mcp/.env.example apps/mcp/.env   # optional — only if customizing the MCP service
```

The defaults work out-of-the-box against the Docker services above. The values you'll most likely need to set:

| File               | Variable                                                                                    | Notes                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/api/.env`    | `BETTER_AUTH_SECRET`                                                                        | 32+ chars. Generate: `openssl rand -base64 32`. Required to start.          |
| `apps/api/.env`    | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY` | LLM providers — set the ones you plan to use.                               |
| `apps/api/.env`    | `ELEVENLABS_API_KEY`                                                                        | Optional — for voice / text-to-speech.                                      |
| `apps/api/.env`    | `TAVILY_API_KEY`                                                                            | Optional — for the agent web-search tool.                                   |
| `apps/api/.env`    | `WEBHOOK_BASE_URL`                                                                          | Public HTTPS URL for Telegram webhooks (see ngrok below).                   |
| `apps/api/.env`    | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`                    | Media storage — defaults match the Docker MinIO service.                    |
| `packages/db/.env` | `ENCRYPTION_KEY`                                                                            | 32-byte key for encrypting stored secrets (e.g. bot tokens). See file hint. |
| `apps/web/.env`    | `VITE_API_URL`                                                                              | Backend API URL (default `http://localhost:3001`).                          |

> `apps/api/.env` also has an `ALLOW_MOCK_AUTH` flag for bypassing auth in local dev via an `X-Mock-User-Id` header. **Never enable it in production or staging.**

## 4. Setup Database

Reset the schema and seed demo data (mock users + default journeys) in one step:

```bash
pnpm db:reset-full
```

> Prefer `db:reset-full` over manual migrations during development — it drops, recreates, and reseeds a clean database. For a non-destructive schema push you can use `pnpm db:push` followed by `pnpm db:seed`.

## 5. Start Development Servers

Start everything (web, API, and MCP service) with Turborepo:

```bash
pnpm dev
```

Or start them separately:

```bash
pnpm dev:api   # API       (port 3001)
pnpm dev:web   # Frontend  (port 3000)
pnpm dev:mcp   # MCP tools (port 3002)
```

## 6. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **MCP Service**: http://localhost:3002
- **Settings Page**: http://localhost:3000/settings

**Note**: Both development (`pnpm dev`) and production preview (`pnpm preview`) modes use port 3000 for the web app, 3001 for the API, and 3002 for the MCP service.

## Demo Users

`pnpm db:reset-full` seeds the demo users below. If you need to (re)create them manually, sign up through the web UI at http://localhost:3000, or call the API:

```bash
# Create Demo User
curl -X POST http://localhost:3001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@journey.app", "password": "demo1234", "name": "Demo User"}'

# Create Arina User (optional)
curl -X POST http://localhost:3001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "arina@journey.app", "password": "arina1234", "name": "Arina"}'
```

| User      | Email             | Password  |
| --------- | ----------------- | --------- |
| Demo User | demo@journey.app  | demo1234  |
| Arina     | arina@journey.app | arina1234 |

The app includes a user switcher in the header for testing multi-tenant features (when in mock mode).

---

## Telegram Bot Setup

### 1. Create a Bot on Telegram

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `8571453990:AAEgTA1Kj-H4Z8TYH4IVwKXzATWQmV3TYR0`)

### 2. Connect Bot via Web UI

1. Log in to the app at http://localhost:3000
2. Click your user menu → **Settings**
3. Go to the **Channels** section
4. Click **Connect** on Telegram
5. Paste your bot token
6. Select a default journey for the bot

The app will automatically:

- Validate your token with Telegram
- Register the webhook URL

### 3. Expose API with ngrok (for local development)

Since Telegram needs to reach your local API, use ngrok:

```bash
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

Then set the `WEBHOOK_BASE_URL` environment variable:

```env
# In apps/api/.env
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

Restart the API and reconnect your bot (or click "Refresh Webhook" in settings).

### 4. Test

Message your bot on Telegram - it should respond with the journey!

### Timer / Wait Nodes

Wait nodes require Redis for the timer service. If Redis is running, wait nodes will automatically fire after the configured delay and continue the journey.

Check timer service status in API logs:

```
✅ api:timerService:initialized
```

If you see "Timer service failed to initialize", check your Redis connection.

---

## Useful Commands

```bash
# Type checking
pnpm typecheck

# Lint the web app (CI enforces --max-warnings 0)
pnpm --filter @journey/web lint

# Run tests
pnpm test

# Run only unit tests
pnpm test:unit

# Test journey paths against real flow files (fast)
pnpm blade-runner apps/web/src/data/journeys/saas-onboarding/journey.json --thorough

# View Drizzle Studio (database GUI)
pnpm --filter @journey/db studio

# Generate database migrations
pnpm --filter @journey/db generate

# Build all packages
pnpm build
```

## Troubleshooting

### Database Connection Error

Make sure PostgreSQL is running:

```bash
docker compose -f service/docker/docker-compose.yml ps
```

Check connection:

```bash
docker exec -it journey-postgres psql -U journey -d journey -c "SELECT 1"
```

### Redis Connection Error

Make sure Redis is running:

```bash
docker exec -it journey-redis redis-cli ping
```

Should return `PONG`.

### MinIO / Media Uploads Not Working

Make sure MinIO is running and reachable:

```bash
curl -f http://localhost:9000/minio/health/live
```

### Port Already in Use

```bash
# Find process using a port (3000 web · 3001 api · 3002 mcp)
lsof -i :3000
```

### Reset Database

```bash
# Drop, recreate, and reseed in one step
pnpm db:reset-full
```

To wipe Docker volumes entirely and start fresh:

```bash
docker compose -f service/docker/docker-compose.yml down -v
docker compose -f service/docker/docker-compose.yml up -d
pnpm db:reset-full
```

---

## Environment Variables Reference

The authoritative reference is each `.env.example` file (with inline comments). The most important variables:

### API (`apps/api/.env`)

| Variable                                                                                        | Required | Default                  | Description                                       |
| ----------------------------------------------------------------------------------------------- | -------- | ------------------------ | ------------------------------------------------- |
| `DATABASE_URL`                                                                                  | Yes      | -                        | PostgreSQL connection string                      |
| `REDIS_URL`                                                                                     | Yes      | `redis://localhost:6379` | Redis for BullMQ, session cache, rate limiting    |
| `BETTER_AUTH_SECRET`                                                                            | Yes      | -                        | Session encryption key (32+ chars)                |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` / `CEREBRAS_API_KEY` | No       | -                        | LLM provider keys (set the ones you use)          |
| `ELEVENLABS_API_KEY`                                                                            | No       | -                        | Voice / text-to-speech                            |
| `TAVILY_API_KEY`                                                                                | No       | -                        | Agent web-search tool                             |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET`                     | No       | MinIO Docker defaults    | Media storage (S3-compatible)                     |
| `WEBHOOK_BASE_URL`                                                                              | No       | -                        | Public HTTPS base for Telegram webhooks           |
| `FRONTEND_URL`                                                                                  | No       | `http://localhost:3000`  | Frontend URL for CORS                             |
| `PORT`                                                                                          | No       | `3001`                   | API server port                                   |
| `NODE_ENV`                                                                                      | No       | `development`            | Environment mode                                  |
| `LOG_LEVEL`                                                                                     | No       | `info`                   | Pino level: `trace`/`debug`/`info`/`warn`/`error` |
| `ALLOW_MOCK_AUTH`                                                                               | No       | `false`                  | Dev-only auth bypass — never enable in production |

### Database (`packages/db/.env`)

| Variable         | Required | Default | Description                               |
| ---------------- | -------- | ------- | ----------------------------------------- |
| `DATABASE_URL`   | Yes      | -       | PostgreSQL connection string              |
| `ENCRYPTION_KEY` | Yes      | -       | 32-byte key for encrypting stored secrets |

### Web (`apps/web/.env`)

| Variable         | Required | Default                 | Description                        |
| ---------------- | -------- | ----------------------- | ---------------------------------- |
| `VITE_API_URL`   | No       | `http://localhost:3001` | Backend API URL                    |
| `VITE_LOG_LEVEL` | No       | `info`                  | Client log level (`trace`…`error`) |
