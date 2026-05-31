# API Routes Reference

> Canonical endpoint reference for `apps/api`.

## Overview

- All routes are prefixed with `/api` except `/health` and `/webhook/*`.
- Authentication is required for all `/api/*` routes except:
  - `/api/auth/*` (Better Auth)
  - `/api/models/*` (public model registry)
  - `/api/me` (returns nulls when unauthenticated)

---

## Route Map

| Base Path | Router File | Auth | Notes |
| --- | --- | --- | --- |
| `/health` | `app.ts` | No | Basic health check |
| `/health/detailed` | `app.ts` | No | Full system health |
| `/api/auth/*` | Better Auth | No | Auth + org endpoints |
| `/api/me` | `app.ts` | No | Current user + org (or null) |
| `/api/journeys` | `journeys.ts` + `journey-versions.ts` | Yes | Journey CRUD + versions |
| `/api/channels` | `channels.ts` | Yes | Telegram channel management |
| `/api/uploads` | `uploads.ts` | Yes | Media + avatar uploads |
| `/api` | `sessions.ts` | Yes | Sessions + journey session resets |
| `/api/users` | `users.ts` | Yes | Channel users + activity |
| `/api/variables` | `variables.ts` | Yes | Global/journey variables |
| `/api/tags` | `tag-definitions.ts` | Yes | Tag registry |
| `/api/user-tags` | `tags.ts` | Yes | Tag assignments |
| `/api/events` | `modules/event-api/routes/` | Yes | Logs, SSE, replay, CRM + LLM usage |
| `/api/crm/*` | `modules/crm/routes/` | Yes | Pipelines, stages, fields, clients |
| `/api/mindstates` | `modules/mindstates/routes/` | Yes | Definitions + analysis |
| `/api/audio` | `modules/audio/routes/` | Yes | STT + TTS |
| `/api/simulator` | `modules/simulator/routes/` | Yes | Engine-backed simulator |
| `/api/models` | `modules/llm-registry/routes/` | No | LLM registry (public) |
| `/api/agent-tools` | `agent-tools.ts` | Yes | Tool discovery |
| `/api/workflows` | `workflows.ts` + `workflow-versions.ts` | Yes | Workflow CRUD + versions |
| `/api/workflows/approvals` | `workflow-approvals.ts` | Yes | Human approvals |
| `/webhook/telegram/:channelId` | `modules/channels/webhooks/telegram.ts` | No* | Telegram webhook |

> *Telegram webhooks are authenticated via `X-Telegram-Bot-Api-Secret-Token` header.

---

## Tag Endpoints (Common Confusion)

### 1) Tag Definitions (`/api/tags`) - Organization Registry

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/tags/global` | List tag definitions |
| POST | `/api/tags/global` | Create tag definition |
| PUT | `/api/tags/global/:tag` | Update tag definition |
| DELETE | `/api/tags/global/:tag` | Delete tag definition |

### 2) User Tags (`/api/user-tags`) - Assignments

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/user-tags/global/:clientId` | List client tags |
| POST | `/api/user-tags/global/:clientId` | Add tag to client |
| DELETE | `/api/user-tags/global/:clientId/:tag` | Remove tag |
| POST | `/api/user-tags/execute` | Batch tag operations |

### 3) CRM Tags (`/api/crm/clients/:clientId/tags`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/crm/clients/:clientId/tags` | Add tag via CRM |
| DELETE | `/api/crm/clients/:clientId/tags/:tag` | Remove tag via CRM |

---

## Detailed Endpoints

### Journeys (`/api/journeys`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/journeys` | List journeys |
| GET | `/api/journeys/:idOrSlug` | Get journey |
| GET | `/api/journeys/:id/active-sessions-count` | Active session count |
| POST | `/api/journeys` | Create journey |
| PUT | `/api/journeys/:idOrSlug` | Update journey (supports status changes) |
| DELETE | `/api/journeys/:idOrSlug` | Delete journey |

### Journey Versions

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/journeys/:id/versions` | List versions |
| POST | `/api/journeys/:id/versions` | Save version |
| GET | `/api/journeys/:id/versions/:versionId` | Get version |
| DELETE | `/api/journeys/:id/versions/:versionId` | Delete version |

### Sessions (`/api`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/journeys/:journeyId/sessions` | List sessions (query `status`, `limit`, `offset`) |
| GET | `/api/sessions/:sessionId` | Session detail + interactions |
| DELETE | `/api/sessions/:sessionId` | Delete session |
| DELETE | `/api/journeys/:journeyId/sessions` | Reset journey sessions (dev only) |

### Channels (`/api/channels`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/channels` | List channels |
| GET | `/api/channels/:id` | Get channel |
| POST | `/api/channels` | Create channel |
| PUT | `/api/channels/:id` | Update channel |
| DELETE | `/api/channels/:id` | Delete channel |
| POST | `/api/channels/:id/webhook` | Re-register webhook |

### Uploads (`/api/uploads`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/uploads?journeyId=...` | Upload media |
| GET | `/api/uploads?journeyId=...` | List media |
| GET | `/api/uploads/:id/usage` | Check usage |
| DELETE | `/api/uploads/:id?force=true` | Delete media |
| GET | `/api/uploads/config` | Upload limits + types |
| POST | `/api/uploads/avatar` | Upload avatar |

### Users (`/api/users`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/users/tags` | List unique tags |
| GET | `/api/users` | List channel users |
| GET | `/api/users/:userId/sessions` | User sessions |
| GET | `/api/users/:userId/activity` | User activity timeline |
| DELETE | `/api/users/:userId` | Delete user + data |

### Variables (`/api/variables`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/variables/global` | List global variables |
| GET | `/api/variables/global/:key` | Get global variable |
| PUT | `/api/variables/global/:key` | Set global variable |
| DELETE | `/api/variables/global/:key` | Delete global variable |
| GET | `/api/variables/journey/:journeyId` | List journey variables |
| GET | `/api/variables/journey/:journeyId/:key` | Get journey variable |
| PUT | `/api/variables/journey/:journeyId/:key` | Set journey variable |
| DELETE | `/api/variables/journey/:journeyId/:key` | Delete journey variable |
| POST | `/api/variables/execute` | Batch variable operations |

### Events (`/api/events`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/events` | List interactions (filters) |
| GET | `/api/events/stats` | Interaction stats |
| GET | `/api/events/types` | Available types |
| GET | `/api/events/stream` | SSE stream |
| GET | `/api/events/health` | Event system health |
| GET | `/api/events/crm` | CRM activity events |
| GET | `/api/events/llm` | LLM usage events |
| GET | `/api/events/llm/stats` | LLM usage statistics |
| GET | `/api/events/replay` | Replay from events table |
| GET | `/api/events/replay/latest` | Latest sequence |

### CRM (`/api/crm`)

#### Clients

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/crm/clients` | List clients (filters) |
| GET | `/api/crm/clients/:clientId` | Client profile |
| PUT | `/api/crm/clients/:clientId/stage` | Assign stage |
| GET | `/api/crm/clients/:clientId/stage-history` | Stage history |
| GET | `/api/crm/clients/:clientId/fields` | Client fields |
| PUT | `/api/crm/clients/:clientId/fields` | Update fields |
| GET | `/api/crm/clients/:clientId/timeline` | Client timeline |
| POST | `/api/crm/clients/:clientId/tags` | Add tag |
| DELETE | `/api/crm/clients/:clientId/tags/:tag` | Remove tag |

#### Pipelines

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/crm/pipelines` | List pipelines |
| GET | `/api/crm/pipelines/:pipelineId` | Get pipeline |
| POST | `/api/crm/pipelines` | Create pipeline |
| PUT | `/api/crm/pipelines/reorder` | Reorder pipelines |
| PUT | `/api/crm/pipelines/:pipelineId` | Update pipeline |
| PUT | `/api/crm/pipelines/:pipelineId/default` | Set default |
| DELETE | `/api/crm/pipelines/:pipelineId` | Delete pipeline |

#### Stages

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/crm/stages` | List stages |
| POST | `/api/crm/stages` | Create stage |
| PUT | `/api/crm/stages/reorder` | Reorder stages |
| PUT | `/api/crm/stages/:stageId` | Update stage |
| DELETE | `/api/crm/stages/:stageId` | Delete stage |

#### Fields

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/crm/fields` | List fields |
| POST | `/api/crm/fields` | Create field |
| PUT | `/api/crm/fields/reorder` | Reorder fields |
| PUT | `/api/crm/fields/:fieldId` | Update field |
| DELETE | `/api/crm/fields/:fieldId` | Delete field |

#### Messages

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/crm/clients/:clientId/messages` | Send direct message |
| GET | `/api/crm/clients/:clientId/messages` | Message history |

### Mindstates (`/api/mindstates`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/mindstates/definitions` | List definitions |
| POST | `/api/mindstates/definitions` | Create definition |
| GET | `/api/mindstates/definitions/:keyOrId` | Get definition |
| PUT | `/api/mindstates/definitions/:key` | Update definition |
| DELETE | `/api/mindstates/definitions/:key` | Delete definition |
| POST | `/api/mindstates/definitions/:key/preview` | Preview analysis |
| GET | `/api/mindstates/clients/:clientId` | List client mindstates |
| GET | `/api/mindstates/clients/:clientId/:key` | Get client mindstate |
| POST | `/api/mindstates/clients/:clientId/:key/analyze` | Run analysis |
| GET | `/api/mindstates/clients/:clientId/:key/history` | Analysis history |

### Workflows (`/api/workflows`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/workflows` | List workflows |
| GET | `/api/workflows/:key` | Get workflow |
| POST | `/api/workflows` | Create workflow |
| PUT | `/api/workflows/:key` | Update workflow |
| DELETE | `/api/workflows/:key?force=true` | Delete/archive workflow (204 on success) |
| POST | `/api/workflows/:key/execute` | Execute workflow |
| POST | `/api/workflows/:key/validate` | Validate workflow graph |

### Workflow Versions

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/workflows/:key/versions` | List versions |
| POST | `/api/workflows/:key/versions` | Save version |
| GET | `/api/workflows/:key/versions/:versionId` | Get version |
| DELETE | `/api/workflows/:key/versions/:versionId` | Delete version |

### Workflow Approvals (`/api/workflows/approvals`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/workflows/approvals` | List approvals |
| GET | `/api/workflows/approvals/:id` | Get approval |
| POST | `/api/workflows/approvals/:id/respond` | Approve/reject |

### Agent Tools (`/api/agent-tools`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/agent-tools` | List tools (optional `refresh=true`) |
| GET | `/api/agent-tools/categories` | Tools grouped by category |
| GET | `/api/agent-tools/available` | Tools that are currently usable |

### Models (`/api/models`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/models` | List models |
| GET | `/api/models/grouped` | Group by provider |
| GET | `/api/models/:modelId` | Get model details |

### Audio (`/api/audio`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/audio/transcribe` | Speech-to-text |
| POST | `/api/audio/tts` | Text-to-speech |
| POST | `/api/audio/tts/stream` | Streaming TTS (SSE) |

### Simulator (`/api/simulator`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/simulator/sessions` | Start simulation |
| POST | `/api/simulator/execute` | Send input |
| GET | `/api/simulator/sessions/:id/timers` | List active timers |
| POST | `/api/simulator/timers/:edgeId/skip` | Skip timer |
| DELETE | `/api/simulator/sessions/:id` | Cleanup session |
| GET | `/api/simulator/personas` | List personas |
| POST | `/api/simulator/personas` | Create persona |
| GET | `/api/simulator/personas/:id` | Get persona |
| PUT | `/api/simulator/personas/:id` | Update persona |
| DELETE | `/api/simulator/personas/:id` | Delete persona |
| POST | `/api/simulator/personas/:id/reset` | Reset persona data |
| POST | `/api/simulator/cleanup` | Bulk cleanup test data |
| GET | `/api/simulator/health` | Simulator health |

### Webhooks

```
POST /webhook/telegram/:channelId
```

---

## Query Parameters

Most list endpoints accept:

- `limit` (default 50-100 depending on endpoint)
- `offset`

Event filters:

- `types` (comma-separated)
- `startDate`, `endDate` (ISO 8601)
- `sessionId`, `journeyId`, `clientId`

LLM usage filters (`/api/events/llm`):

- `services` (comma-separated)
- `models` (comma-separated)
- `providers` (comma-separated)

CRM client filters (`/api/crm/clients`):

- `stageId`, `stageIds` (comma-separated)
- `pipelineId`, `journeyId`
- `tags` (comma-separated)
- `search`, `noStage` (boolean)
- `dateFrom`, `dateTo` (ISO 8601)

Workflow list filters (`/api/workflows`):

- `status` (`draft`, `active`, `archived`)
- `search`

---

## Response Format

Responses are resource-specific. Common shapes:

```json
{ "journey": { "...": "..." } }
```

```json
{ "journeys": [ "..." ] }
```

```json
{ "success": true }
```

List endpoints typically include resource-specific arrays plus pagination:

```json
{
  "journeys": ["..."],
  "pagination": { "total": 123, "limit": 50, "offset": 0, "hasMore": true }
}
```

Errors (typical):

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "requestId": "uuid-for-tracing"
}
```

---

## Rate Limits

| Group | Default |
| --- | --- |
| Global API | 100 req/min per user/IP |
| Auth | 10 req/15min per IP |
| Webhooks | 200 req/min per channel |
| SSE connections | 10 per user |

---

## Body Limits

| Route Group | Limit |
| --- | --- |
| `/api/*` | 1MB |
| `/api/uploads/*` | 300MB |
| `/webhook/*` | 1MB |
