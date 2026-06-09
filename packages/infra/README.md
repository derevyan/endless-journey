# @journey/infra

Shared infrastructure utilities for the Journey platform. Currently provides a **circuit breaker** (built on [Opossum](https://github.com/nodeshift/opossum)) used to isolate flaky external calls — webhooks, CRM APIs, and the MCP service — so failures degrade gracefully instead of cascading.

## Entry points

- `@journey/infra` — all exports
- `@journey/infra/circuit-breaker` — circuit-breaker helpers

## Usage

```typescript
import { createCircuitBreaker, getCircuitMetrics } from "@journey/infra/circuit-breaker";

const breaker = createCircuitBreaker(callExternalApi, { serviceType: "webhook" });
const result = await breaker.fire(payload);

const metrics = getCircuitMetrics("webhook"); // failure/success counts, open/closed state
```
