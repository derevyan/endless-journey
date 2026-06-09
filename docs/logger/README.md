# @journey/logger

Structured logging using Pino with consistent formatting across all packages.

## Overview

This package provides:

- **Structured logging** with context fields
- **Log levels** (trace, debug, info, warn, error, fatal)
- **Scoped loggers** for different components
- **Error serialization** for safe error logging
- **Environment-aware** log levels

## Basic Usage

### Create Logger

```typescript
import { createLogger } from "@journey/logger";

const log = createLogger("component-name");

log.info("Component initialized");
log.debug({ userId: "user-123" }, "Processing user");
log.error({ err: serializeError(error) }, "component:operationFailed");
```

### Log Levels

```typescript
log.trace("Very detailed debugging");
log.debug({ field: value }, "Debug information");
log.info({ field: value }, "Informational message");
log.warn({ field: value }, "Warning message");
log.error({ err: serializeError(error) }, "Error occurred");
log.fatal({ err: serializeError(error) }, "Fatal error");
```

## Structured Logging

Always include context fields:

```typescript
// Good
log.info({ userId: "user-123", journeyId: "journey-1" }, "journey:started");
log.error({ err: serializeError(error), nodeId: "node-1" }, "node:executionFailed");

// Bad
log.info("Journey started"); // Missing context
log.error(error); // Not serialized
```

### Log Format

Logs follow this structure:

```
[scope] { env, version, ...contextFields } message
```

Example output:

```
[journey:api] { env: 'development', version: '1.0.0', userId: 'user-123' } journey:started
```

## Error Serialization

Always serialize errors before logging:

```typescript
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("component");

try {
  // ... operation
} catch (error) {
  log.error({ err: serializeError(error) }, "component:operationFailed");
}
```

**Why serialize?**

- Errors may contain circular references
- Stack traces are preserved
- Safe for JSON serialization
- Includes error cause chain

## Scoped Loggers

Create child loggers with additional context:

```typescript
const log = createLogger("engine");

// Child logger with session context
const sessionLog = log.child({ sessionId: "session-123" });

sessionLog.info("Session started");
// Logs: [journey:engine] { sessionId: 'session-123' } Session started
```

## Log Namespaces

Use consistent namespace patterns:

- `component:action` - Component action (e.g., `engine:start`, `api:request`)
- `component:state` - State change (e.g., `session:transition`, `node:entered`)
- `component:error` - Error occurred (e.g., `webhook:requestFailed`)

### Common Namespaces

**Engine:**

- `engine:start` - Journey started
- `engine:transition` - Node transition
- `engine:executeNode` - Node execution
- `engine:event` - Event logged

**API:**

- `api:request` - HTTP request received
- `api:response` - HTTP response sent
- `api:error` - Request error

**Webhooks:**

- `webhook:request` - HTTP request started
- `webhook:response` - Response received
- `webhook:error` - Request failed

## Environment Configuration

Log levels are controlled by environment:

- **Development**: Level 4 (info and above)
- **Production**: Level 3 (warn and above)
- **Override**: Set `LOG_LEVEL` environment variable (0-5)

```env
LOG_LEVEL=debug  # trace, debug, info, warn, error, fatal
```

## Log Rotation

Logs are automatically rotated daily at midnight UTC to prevent unbounded disk growth:

### File Output

**Main logs** (all log levels):
- Active: `./logs/journey-YYYY-MM-DD`
- Retention: 30 days (30-day retention policy)
- Estimated size: ~50 MB/day = ~1.55 GB max

**Error logs** (error level 50 + fatal level 60 only):
- Active: `./logs/journey-error-YYYY-MM-DD`
- Retention: 7 days (7-day retention policy)
- Estimated size: ~10 MB/day = ~80 MB max

Example file listing:
```
logs/
├── journey-2026-01-05          # Today's main log
├── journey-2026-01-04          # Yesterday
├── journey-2026-01-03          # 2 days ago
├── ...                          # (continues to 30 days ago)
├── journey-error-2026-01-05    # Today's errors
├── journey-error-2026-01-04    # Yesterday's errors
└── ...                          # (continues to 7 days ago)
```

**Note:** Log files have no `.log` extension by convention (pino-roll standard).

### Viewing Logs

```bash
# View today's errors
tail -f ./logs/journey-error-$(date +%Y-%m-%d)

# View all logs for a date
less ./logs/journey-2026-01-05

# Count error entries
grep -c '"level":50' ./logs/journey-error-2026-01-05
```

### Rotation Behavior

- **Frequency:** Daily at midnight UTC
- **Mechanism:** Non-blocking worker threads (no performance impact)
- **Cleanup:** Automatic deletion of files older than retention period
- **First rotation:** 24 hours after API server startup

### Disk Space Management

**Total maximum disk usage: ~1.6 GB** (bounded growth)

Before rotation was added:
- Single log file grew to 944 MB (unbounded)
- No error separation
- Difficult to find issues in verbose logs

After rotation:
- Main logs: ~1.55 GB (30-day retention)
- Error logs: ~80 MB (7-day retention)
- **Total:** ~1.6 GB (bounded, predictable growth)

## Best Practices

1. **Always include context**: `log.info({ userId, journeyId }, "message")`
2. **Serialize errors**: `log.error({ err: serializeError(error) }, "message")`
3. **Use namespaces**: `"component:action"` format
4. **Don't log sensitive data**: Passwords, tokens, etc.
5. **Use appropriate levels**: debug for development, info for important events
6. **Create scoped loggers**: Use `log.child()` for repeated context
7. **Monitor error logs**: Check `journey-error-YYYY-MM-DD` files for system issues

## File Structure

```
packages/logger/src/
└── index.ts    # createLogger, serializeError exports
```

## See Also

- [Engine Logging](../engine/README.md#logging)
- [Pino Documentation](https://github.com/pinojs/pino)
