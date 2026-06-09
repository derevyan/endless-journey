# @journey/logger

Structured logging built on **Pino** — pretty output in dev, JSON in production, with file rotation and a separate error-only log in Node. The same API works in the browser (used by the web app).

## Usage

```typescript
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("my-service");

log.info({ userId, journeyId }, "service:actionCompleted");
log.error({ err: serializeError(error), userId }, "service:actionFailed");
```

Log level is controlled by `LOG_LEVEL` (Node) or `VITE_LOG_LEVEL` (browser) — one of `trace`, `debug`, `info`, `warn`, `error`, or `silent`. Defaults to `info`.

**Documentation:** See [docs/logger/README.md](/docs/logger/README.md)
