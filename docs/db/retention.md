# Database Retention Policy

This document defines data retention windows and cleanup strategies for high-volume tables.

## Overview

Retention policies balance storage costs with analytics and audit needs. Each table has a defined retention period after which records are eligible for deletion.

## Retention Windows

| Table | Retention | Rationale |
|-------|-----------|-----------|
| `events` | 90 days | High volume event store, analytics focus |
| `interactions` | 90 days | Session event log for debugging |
| `llm_usage_events` | 90 days | LLM cost tracking and analytics |
| `sent_messages` | 90 days | Message tracking for debugging |
| `agent_conversations` | 30 days | Recoverable from `nodeOutputs` |
| `mindstate_analysis_log` | 60 days | Audit trail for mindstate changes |
| `crm_stage_history` | 365 days | CRM pipeline analytics |
| `failed_events` | 30 days | Dead letter queue for investigation |

## Implementation

### Retention Service

The retention service (`apps/api/src/services/data-retention.ts`) uses BullMQ to run cleanup operations on a schedule. It:

- Runs daily at 3:00 AM UTC
- Deletes in batches to avoid table locks
- Logs statistics for monitoring
- Supports `0` (forever) to disable retention for any table

```typescript
import { runRetentionNow } from "@/services/data-retention";

// Manual trigger for testing or on-demand cleanup
await runRetentionNow();
```

The service reads retention settings from `appConfig.retention` which is configured via environment variables.

## Configuration

Retention windows are defined in environment variables (0 = forever, no deletion):

| Variable | Default | Description |
|----------|---------|-------------|
| `EVENT_RETENTION_DAYS` | 90 | Days to keep events |
| `INTERACTIONS_RETENTION_DAYS` | 90 | Days to keep interactions |
| `LLM_USAGE_RETENTION_DAYS` | 90 | Days to keep LLM usage events |
| `SENT_MESSAGES_RETENTION_DAYS` | 90 | Days to keep sent messages |
| `AGENT_CONVERSATIONS_RETENTION_DAYS` | 30 | Days to keep agent conversations |
| `MINDSTATE_LOG_RETENTION_DAYS` | 60 | Days to keep mindstate analysis logs |
| `FAILED_EVENTS_RETENTION_DAYS` | 30 | Days to keep failed events |
| `CRM_STAGE_HISTORY_RETENTION_DAYS` | 365 | Days to keep CRM stage history |

## Monitoring

The retention job logs cleanup statistics:

```
retention:events - Deleted 1,234 records older than 90 days
retention:interactions - Deleted 5,678 records older than 90 days
```

Monitor for:
- Job failures (check BullMQ queue)
- Unexpectedly low deletion counts (may indicate schema changes)
- Unexpectedly high deletion counts (may indicate data issues)

## Archival (Future)

For compliance or long-term analytics, consider:
1. **Export before delete**: Archive to S3/GCS before cleanup
2. **Partitioning**: Split tables by time for faster archival
3. **Cold storage**: Move old data to cheaper storage tiers

## See Also

- `docs/db/README.md` - Package overview
- `docs/db/schema-conventions.md` - Schema patterns
- `apps/api/src/services/data-retention.ts` - Retention implementation (BullMQ service + worker)
- `apps/api/src/config/app-config.ts` - Retention configuration defaults
