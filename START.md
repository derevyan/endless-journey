# Quick Start Guide

This guide will help you get the Journey Builder running locally for development and testing.

## Prerequisites

- **Node.js** 18+
- **pnpm** 9+
- **Docker** (for PostgreSQL and Redis)

## 1. Start Infrastructure

Start PostgreSQL and Redis using Docker Compose:

```bash
cd service/docker
docker-compose up -d
```

Verify containers are running:

```bash
docker-compose ps
```

You should see:

- `journey-postgres` on port 5432
- `journey-redis` on port 6379

## 2. Install Dependencies

From the project root:

```bash
pnpm install
```

## 3. Configure Environment

Create environment files for each package that needs them:

### API (`apps/api/.env`)

```env
# Database
DATABASE_URL=postgres://journey:journey_dev@localhost:5432/journey

# Redis (for BullMQ timer service)
REDIS_URL=redis://localhost:6379

# Better Auth - Secret key for session encryption (minimum 32 characters)
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=journey-dev-secret-change-in-production-min-32-chars

# URLs
FRONTEND_URL=http://localhost:3000
PORT=3001

# Environment
NODE_ENV=development
LOG_LEVEL=trace
```

### Database (`packages/db/.env`)

```env
# PostgreSQL Connection
DATABASE_URL=postgres://journey:journey_dev@localhost:5432/journey
```

### Web Frontend (`apps/web/.env`)

```env
# Backend API URL
VITE_API_URL=http://localhost:3001

# Logging (optional)
VITE_LOG_LEVEL=debug
```

## 4. Setup Database

Push the database schema:

```bash
pnpm --filter @journey/db push
```

Seed with demo data (mock users + default journeys):

```bash
pnpm --filter @journey/db seed
```

## 5. Start Development Servers

Start both frontend and API:

```bash
pnpm dev
```

Or start them separately:

```bash
# Terminal 1: API (port 3001)
pnpm --filter @journey/api dev

# Terminal 2: Frontend (port 3000)
pnpm --filter @journey/web dev
```

## 6. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **Settings Page**: http://localhost:3000/settings

**Note**: Both development (`pnpm dev`) and production preview (`pnpm preview`) modes use port 3000 for the web app and 3001 for the API.

## Demo Users

After seeding the database with journeys, create demo users via the API:

```bash
# Start the API server first
pnpm dev

# Create Demo User
curl -X POST http://localhost:3001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@journey.app", "password": "demo1234", "name": "Demo User"}'

# Create Arina User (optional)
curl -X POST http://localhost:3001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "arina@journey.app", "password": "arina1234", "name": "Arina"}'
```

Or simply sign up through the web UI at http://localhost:3000.

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
3. Go to **Connected Accounts** section
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

# Run tests
pnpm test

# Run only unit tests
pnpm test:unit

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
docker-compose -f service/docker/docker-compose.yml ps
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

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Find process using port 3001
lsof -i :3001
```

### Reset Database

```bash
# Stop containers and remove volumes
cd service/docker
docker-compose down -v

# Start fresh
docker-compose up -d

# Re-push schema and seed
pnpm --filter @journey/db push
pnpm --filter @journey/db seed
```

---

## Environment Variables Reference

### API (`apps/api/.env`)

| Variable             | Required | Default                  | Description                        |
| -------------------- | -------- | ------------------------ | ---------------------------------- |
| `DATABASE_URL`       | Yes      | -                        | PostgreSQL connection string       |
| `REDIS_URL`          | Yes      | `redis://localhost:6379` | Redis connection for BullMQ        |
| `BETTER_AUTH_SECRET` | Yes      | -                        | Session encryption key (32+ chars) |
| `FRONTEND_URL`       | No       | `http://localhost:3000`  | Frontend URL for CORS              |
| `PORT`               | No       | `3001`                   | API server port                    |
| `NODE_ENV`           | No       | `development`            | Environment mode                   |
| `LOG_LEVEL`          | No       | `20`                     | Log level (0-5)                    |

### Database (`packages/db/.env`)

| Variable       | Required | Default | Description                  |
| -------------- | -------- | ------- | ---------------------------- |
| `DATABASE_URL` | Yes      | -       | PostgreSQL connection string |

### Web (`apps/web/.env`)

| Variable         | Required | Default                 | Description                     |
| ---------------- | -------- | ----------------------- | ------------------------------- |
| `VITE_API_URL`   | No       | `http://localhost:3001` | Backend API URL                 |
| `VITE_LOG_LEVEL` | No       | `4` (dev) / `3` (prod)  | Log level (0=silent, 5=verbose) |
