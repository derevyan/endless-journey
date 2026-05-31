# @journey/mcp

Shared MCP (Model Context Protocol) library providing types and an HTTP client for communicating with the standalone MCP service.

## Overview

This package is used by:

- `apps/mcp` (server): uses MCP server configuration types
- `apps/api` + `packages/llm` (clients): use `MCPServiceClient` to fetch tools/resources/prompts and execute tool calls

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         apps/api                                 │
│                                                                  │
│  Uses MCPServiceClient to fetch tools/resources/prompts          │
│  and execute tool calls                                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                │ HTTP (with circuit breaker)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         apps/mcp                                 │
│                                                                  │
│  Standalone MCP service managing tool servers                    │
│  Uses types from @journey/mcp                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

Workspace package:

```json
{
  "dependencies": {
    "@journey/mcp": "workspace:*"
  }
}
```

## Entry Points

- `@journey/mcp` - client + types
- `@journey/mcp/client` - client only
- `@journey/mcp/types` - types only

## Runtime Configuration

**apps/api** (client):

- `MCP_SERVICE_URL` (default: `http://localhost:3002`)
- `MCP_SERVICE_TIMEOUT` (default: `30000` ms)

**apps/mcp** (server):

- `MCP_FETCH_ENABLED=true` to enable the fetch server
- `MCP_FILESYSTEM_ENABLED=true` to enable filesystem tools
- `MCP_FILESYSTEM_PATHS` to restrict filesystem access (default: `process.cwd()`)
- `MCP_REMOTE_SERVERS` JSON config for remote MCP servers (array or map)

## Client Usage

### Initialize the Singleton

```typescript
import { initMCPServiceClient, getMCPServiceClient } from "@journey/mcp";

initMCPServiceClient({
  baseUrl: process.env.MCP_SERVICE_URL || "http://localhost:3002",
  timeout: 30000,
  circuitBreakerEnabled: true,
  circuitBreaker: {
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  },
});

const client = getMCPServiceClient();
```

### Fetching Tools (with optional filters)

```typescript
const tools = await client?.getTools();

const filtered = await client?.getTools(
  { headers: { Authorization: "Bearer token" } },
  ["fetch", "filesystem"]
);
```

### Executing Tools

```typescript
const result = await client?.callTool({
  toolName: "fetch_fetch",
  args: { url: "https://example.com" },
});

if (result?.success) {
  console.log(result.result);
} else {
  console.error(result?.error?.code, result?.error?.message);
}
```

### Resources

```typescript
const resources = await client?.listResources();
const templates = await client?.listResourceTemplates();

const contents = await client?.readResource("filesystem", "file:///tmp/report.txt");
```

### Prompts

```typescript
const prompts = await client?.listPrompts();
const prompt = await client?.getPrompt("fetch", "summary", { url: "https://example.com" });
```

### Health

```typescript
const health = await client?.getHealth();
const isAvailable = await client?.isAvailable();
```

## Error Handling

- `callTool()` returns an `MCPToolCallResponse` and **never throws**.
- `getTools()`, `listResources()`, `listResourceTemplates()`, `readResource()`, `listPrompts()` return empty arrays on failure.
- `getPrompt()` returns `null` on failure.
- `getHealth()` returns `null` if the service is unavailable.

### Error Codes

| Code                   | Description                                 |
| ---------------------- | ------------------------------------------- |
| `MCP_HTTP_ERROR`       | HTTP request failed (4xx, 5xx responses)    |
| `MCP_UNAVAILABLE`      | Service unreachable or circuit breaker open |
| `MCP_TIMEOUT`          | Request exceeded timeout                    |
| `MCP_NOT_INITIALIZED`  | Client used before initialization           |
| `TOOL_NOT_FOUND`       | Requested tool doesn't exist                |
| `TOOL_EXECUTION_ERROR` | Tool failed during execution                |
| `INVALID_REQUEST`      | Malformed request body                      |
| `INVALID_JSON`         | Invalid JSON in request body                |

## Types

### Server Configuration

Used by `apps/mcp` to configure MCP servers:

```typescript
import type { MCPServersConfig } from "@journey/mcp";

const servers: MCPServersConfig = {
  fetch: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-fetch"],
  },
  custom: {
    transport: "http",
    url: "http://localhost:8080/mcp",
    headers: { Authorization: "Bearer token" },
  },
};
```

Supported transports: `stdio`, `http`, `sse`, `streamable_http`.

### Client Types

```typescript
import type {
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptResult,
  MCPHealthStatus,
  MCPServiceClientOptions,
} from "@journey/mcp";
```

## Circuit Breaker

The client wraps `fetch` with the `@journey/infra` circuit breaker by default. Disable for tests or local debugging:

```typescript
initMCPServiceClient({
  baseUrl: "http://localhost:3002",
  circuitBreakerEnabled: false,
});
```

## Testing

```typescript
import { resetMCPServiceClient, initMCPServiceClient } from "@journey/mcp";

beforeEach(() => {
  resetMCPServiceClient();
});

it("initializes", () => {
  const client = initMCPServiceClient({
    baseUrl: "http://localhost:3002",
    circuitBreakerEnabled: false,
  });
  expect(client).toBeDefined();
});
```

## Related Packages

- `apps/mcp` - Standalone MCP service (port 3002)
- `packages/llm` - LLM integration using MCP tools
- `packages/infra` - Circuit breaker implementation
