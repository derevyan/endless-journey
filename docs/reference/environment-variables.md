# Environment Variables Reference

Complete reference for all environment variables used across the Journey Builder monorepo.

## Quick Reference by Package

| Package       | Config File | Required Vars                                     |
| ------------- | ----------- | ------------------------------------------------- |
| `apps/api`    | `.env`      | `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` |
| `apps/web`    | `.env`      | None (all have defaults)                          |
| `packages/db` | `.env`      | `DATABASE_URL`                                    |

---

## API Server (`apps/api/.env`)

### Core Configuration

| Variable    | Required | Default       | Description                                                     |
| ----------- | -------- | ------------- | --------------------------------------------------------------- |
| `NODE_ENV`  | No       | `development` | Environment mode (`development`, `production`, `test`)          |
| `PORT`      | No       | `3001`        | API server port                                                 |
| `LOG_LEVEL` | No       | `20` (info)   | Logging level (0=silent, 10=error, 20=info, 30=debug, 40=trace) |

### Database

| Variable             | Required | Default | Description                                 |
| -------------------- | -------- | ------- | ------------------------------------------- |
| `DATABASE_URL`       | **Yes**  | -       | PostgreSQL connection string                |
| `DB_POOL_MAX`        | No       | `20`    | Maximum connections in pool                 |
| `DB_IDLE_TIMEOUT`    | No       | `30`    | Close idle connections after N seconds      |
| `DB_CONNECT_TIMEOUT` | No       | `10`    | Connection timeout in seconds               |
| `DB_MAX_LIFETIME`    | No       | `1800`  | Max connection lifetime in seconds (30 min) |

**Example connection string:**

```
DATABASE_URL=postgres://journey:journey_dev@localhost:5432/journey
```

### Redis

| Variable    | Required | Default | Description                                                                    |
| ----------- | -------- | ------- | ------------------------------------------------------------------------------ |
| `REDIS_URL` | **Yes**  | -       | Redis connection string for BullMQ timer service, session cache, rate limiting |

**Example:**

```
REDIS_URL=redis://localhost:6379
```

### Authentication

| Variable             | Required | Default | Description                                                                              |
| -------------------- | -------- | ------- | ---------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | **Yes**  | -       | Session encryption key (minimum 32 characters). Generate with: `openssl rand -base64 32` |
| `ALLOW_MOCK_AUTH`    | No       | `false` | Enable mock auth via `X-Mock-User-Id` header (dev only - **never enable in production**) |

### URLs

| Variable           | Required | Default                 | Description                                                              |
| ------------------ | -------- | ----------------------- | ------------------------------------------------------------------------ |
| `FRONTEND_URL`     | No       | `http://localhost:3000` | Frontend URL for CORS configuration                                      |
| `WEBHOOK_BASE_URL` | No       | -                       | Base URL for Telegram webhook callbacks. Use ngrok for local development |

### Storage (MinIO/S3)

| Variable           | Required | Default                 | Description                   |
| ------------------ | -------- | ----------------------- | ----------------------------- |
| `MINIO_ENDPOINT`   | No       | `http://localhost:9000` | MinIO/S3 endpoint URL         |
| `MINIO_ACCESS_KEY` | No       | `minioadmin`            | S3 access key                 |
| `MINIO_SECRET_KEY` | No       | `minioadmin`            | S3 secret key                 |
| `MINIO_BUCKET`     | No       | `journey-media`         | Bucket name for media uploads |

### LLM Provider API Keys

| Variable            | Required | Default | Description                         |
| ------------------- | -------- | ------- | ----------------------------------- |
| `OPENAI_API_KEY`    | No       | -       | OpenAI API key for GPT models       |
| `GEMINI_API_KEY`    | No       | -       | Google Gemini API key               |
| `ANTHROPIC_API_KEY` | No       | -       | Anthropic API key for Claude models |
| `GROQ_API_KEY`      | No       | -       | GROQ API key for fast inference     |

### MCP (Model Context Protocol)

| Variable            | Required | Default | Description                                                   |
| ------------------- | -------- | ------- | ------------------------------------------------------------- |
| `MCP_FETCH_ENABLED` | No       | `true`  | Enable/disable the MCP fetch server for web content retrieval |

### Rate Limiting

Rate limiting is **disabled** when `ALLOW_MOCK_AUTH=true` (dev/test mode).

| Variable                         | Required | Default | Description                                  |
| -------------------------------- | -------- | ------- | -------------------------------------------- |
| `RATE_LIMIT_GLOBAL`              | No       | `100`   | Global requests per minute per user/IP       |
| `RATE_LIMIT_AUTH`                | No       | `10`    | Auth endpoint requests per 15 minutes per IP |
| `RATE_LIMIT_WEBHOOK`             | No       | `200`   | Webhook requests per minute per channel      |
| `RATE_LIMIT_EVENTS_MAX_TOKENS`   | No       | `1000`  | Max tokens in bucket per org                 |
| `RATE_LIMIT_EVENTS_REFILL_RATE`  | No       | `1000`  | Tokens added per interval                    |
| `RATE_LIMIT_EVENTS_INTERVAL`     | No       | `60`    | Refill interval in seconds                   |
| `RATE_LIMIT_SSE_MAX_CONNECTIONS` | No       | `10`    | Max SSE connections per user                 |

### Circuit Breakers

Circuit breakers protect against cascading failures. States: `closed` (normal) → `open` (failing fast) → `half-open` (testing recovery).

#### LLM Service

| Variable                  | Default | Description                                |
| ------------------------- | ------- | ------------------------------------------ |
| `CB_LLM_ENABLED`          | `true`  | Enable/disable circuit breaker             |
| `CB_LLM_TIMEOUT`          | `30000` | Request timeout in ms                      |
| `CB_LLM_ERROR_THRESHOLD`  | `50`    | Error percentage to trip circuit           |
| `CB_LLM_VOLUME_THRESHOLD` | `10`    | Min requests before calculating error rate |
| `CB_LLM_RESET_TIMEOUT`    | `60000` | Time before attempting reset in ms         |

#### Webhook Service

| Variable                      | Default | Description                                |
| ----------------------------- | ------- | ------------------------------------------ |
| `CB_WEBHOOK_ENABLED`          | `true`  | Enable/disable circuit breaker             |
| `CB_WEBHOOK_TIMEOUT`          | `30000` | Request timeout in ms                      |
| `CB_WEBHOOK_ERROR_THRESHOLD`  | `60`    | Error percentage to trip circuit           |
| `CB_WEBHOOK_VOLUME_THRESHOLD` | `10`    | Min requests before calculating error rate |
| `CB_WEBHOOK_RESET_TIMEOUT`    | `30000` | Time before attempting reset in ms         |

#### Telegram API

| Variable                       | Default | Description                                |
| ------------------------------ | ------- | ------------------------------------------ |
| `CB_TELEGRAM_ENABLED`          | `true`  | Enable/disable circuit breaker             |
| `CB_TELEGRAM_TIMEOUT`          | `15000` | Request timeout in ms                      |
| `CB_TELEGRAM_ERROR_THRESHOLD`  | `50`    | Error percentage to trip circuit           |
| `CB_TELEGRAM_VOLUME_THRESHOLD` | `10`    | Min requests before calculating error rate |
| `CB_TELEGRAM_RESET_TIMEOUT`    | `45000` | Time before attempting reset in ms         |

#### CRM/Other Services

| Variable                  | Default | Description                                |
| ------------------------- | ------- | ------------------------------------------ |
| `CB_CRM_ENABLED`          | `true`  | Enable/disable circuit breaker             |
| `CB_CRM_TIMEOUT`          | `15000` | Request timeout in ms                      |
| `CB_CRM_ERROR_THRESHOLD`  | `50`    | Error percentage to trip circuit           |
| `CB_CRM_VOLUME_THRESHOLD` | `10`    | Min requests before calculating error rate |
| `CB_CRM_RESET_TIMEOUT`    | `30000` | Time before attempting reset in ms         |

---

## Web Frontend (`apps/web/.env`)

| Variable         | Required | Default                 | Description                     |
| ---------------- | -------- | ----------------------- | ------------------------------- |
| `VITE_API_URL`   | No       | `http://localhost:3001` | Backend API URL                 |
| `VITE_LOG_LEVEL` | No       | `4` (dev) / `3` (prod)  | Log level (0=silent, 5=verbose) |

**Note:** All web environment variables must be prefixed with `VITE_` to be exposed to the browser.

---

## Database Package (`packages/db/.env`)

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string (same as API) |
| `DB_POOL_MAX` | No | `20` | Max pool size |
| `DB_IDLE_TIMEOUT` | No | `30` | Idle timeout (seconds) |
| `DB_CONNECT_TIMEOUT` | No | `10` | Connection timeout (seconds) |
| `DB_MAX_LIFETIME` | No | `1800` | Max connection lifetime (seconds) |
| `ENCRYPTION_KEY` | **Yes** (for secrets) | - | 32-byte hex key for AES-256-GCM |
| `API_URL` | No | `http://localhost:3001` | Used by seed users via Better Auth |

---

## Example Configurations

### Development

```bash
# apps/api/.env
NODE_ENV=development
LOG_LEVEL=trace
DATABASE_URL=postgres://journey:journey_dev@localhost:5432/journey
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=journey-dev-secret-change-in-production-min-32-chars
ALLOW_MOCK_AUTH=true
FRONTEND_URL=http://localhost:3000
PORT=3001

# apps/web/.env
VITE_API_URL=http://localhost:3001
VITE_LOG_LEVEL=debug

# packages/db/.env
DATABASE_URL=postgres://journey:journey_dev@localhost:5432/journey
ENCRYPTION_KEY=<64-hex-chars>
API_URL=http://localhost:3001
```

### Production

```bash
# apps/api/.env
NODE_ENV=production
LOG_LEVEL=20
DATABASE_URL=postgres://user:password@prod-db.example.com:5432/journey
REDIS_URL=redis://prod-redis.example.com:6379
BETTER_AUTH_SECRET=<your-production-secret-32-chars-min>
ALLOW_MOCK_AUTH=false
FRONTEND_URL=https://app.journey.example.com
PORT=3001
WEBHOOK_BASE_URL=https://api.journey.example.com

# LLM Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# apps/web/.env
VITE_API_URL=https://api.journey.example.com
VITE_LOG_LEVEL=3
```

### Testing

```bash
# apps/api/.env (test)
NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=postgres://journey:journey_test@localhost:5432/journey_test
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=test-secret-for-testing-only-32-chars
ALLOW_MOCK_AUTH=true
```

---

## Security Notes

1. **Never commit `.env` files** - They contain secrets
2. **Use `.env.example`** - Provide templates without real values
3. **Rotate secrets regularly** - Especially `BETTER_AUTH_SECRET` in production
4. **Never enable `ALLOW_MOCK_AUTH` in production** - It bypasses all authentication
5. **Use strong `BETTER_AUTH_SECRET`** - Generate with `openssl rand -base64 32`

---

## See Also

- [Quick Start Guide](/START.md) - Initial setup instructions
- [Deployment Guide](/docs/deploy/production-deployment.md) - Production deployment
- [API Documentation](/docs/api/README.md) - API reference
