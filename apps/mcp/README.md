# @journey/mcp-service

Standalone MCP (Model Context Protocol) service for managing AI agent tools.

## Overview

This service runs independently from the API server, providing:

- **Fault isolation**: MCP crashes don't affect the API
- **Independent lifecycle**: Can restart without affecting the API
- **Clean separation**: Each service has single responsibility

## Quick Start

```bash
# Development
pnpm dev

# Production
pnpm start

# Tests
pnpm test

# Type check
pnpm typecheck
```

## Configuration

| Variable                 | Default             | Description                          |
| ------------------------ | ------------------- | ------------------------------------ |
| `PORT`                   | `3002`              | Service port                         |
| `NODE_ENV`               | -                   | Environment (development/production) |
| `LOG_LEVEL`              | `info`              | Logging level                        |
| `CORS_ORIGINS`           | localhost:3000,3001 | Allowed CORS origins                 |
| `MCP_FETCH_ENABLED`      | `false`             | Enable fetch MCP server              |
| `MCP_FILESYSTEM_ENABLED` | `false`             | Enable filesystem MCP server         |
| `MCP_FILESYSTEM_PATHS`   | `cwd()`             | Allowed filesystem paths             |
| `MCP_REMOTE_SERVERS`     | -                   | JSON config for remote servers       |

### Remote Server Configuration

Configure remote MCP servers via `MCP_REMOTE_SERVERS` environment variable:

```bash
# Array format
MCP_REMOTE_SERVERS='[{"name": "my-server", "url": "http://localhost:4000/mcp", "transport": "http"}]'

# Object format
MCP_REMOTE_SERVERS='{"my-server": {"url": "http://localhost:4000/mcp", "transport": "sse"}}'
```

Supported transports: `http`, `sse`, `streamable_http` (alias for `http`)

## API Endpoints

| Method | Path                       | Description                 |
| ------ | -------------------------- | --------------------------- |
| GET    | `/`                        | Service info                |
| GET    | `/health`                  | Health check                |
| GET    | `/tools`                   | List all tools              |
| POST   | `/tools/list`              | List tools with filters     |
| POST   | `/tools/call`              | Execute a tool              |
| GET    | `/servers`                 | List configured servers     |
| GET    | `/resources`               | List all resources          |
| POST   | `/resources/list`          | List resources with filters |
| POST   | `/resources/read`          | Read a resource             |
| GET    | `/resource-templates`      | List resource templates     |
| POST   | `/resource-templates/list` | List templates with filters |
| GET    | `/prompts`                 | List all prompts            |
| POST   | `/prompts/list`            | List prompts with filters   |
| POST   | `/prompts/get`             | Get a prompt                |

## Request/Response Examples

### List Tools

```bash
# Get all tools
curl http://localhost:3002/tools

# Filter by server
curl -X POST http://localhost:3002/tools/list \
  -H "Content-Type: application/json" \
  -d '{"servers": ["fetch"]}'
```

### Call a Tool

```bash
curl -X POST http://localhost:3002/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "fetch_fetch",
    "args": {"url": "https://example.com"}
  }'
```

Response:
```json
{
  "success": true,
  "result": "...",
  "executionTimeMs": 1234
}
```

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'unknown_tool' not found"
  },
  "executionTimeMs": 5
}
```

Error codes:
- `INVALID_JSON` - Request body is not valid JSON
- `INVALID_REQUEST` - Missing or invalid parameters
- `TOOL_NOT_FOUND` - Requested tool doesn't exist
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `PROMPT_NOT_FOUND` - Requested prompt doesn't exist
- `MCP_NOT_INITIALIZED` - MCP manager not ready
- `MCP_TIMEOUT` - Operation timed out
- `TOOL_EXECUTION_ERROR` - Tool threw an error
- `RESOURCE_READ_ERROR` - Resource read failed
- `PROMPT_GET_ERROR` - Prompt retrieval failed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Service (Port 3002)                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Hono HTTP Server                  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ /tools  │ │/servers │ │/resources│ │ /prompts │  │   │
│  │  └────┬────┘ └────┬────┘ └────┬─────┘ └────┬─────┘  │   │
│  │       │           │           │            │        │   │
│  │  ┌────┴───────────┴───────────┴────────────┴────┐   │   │
│  │  │              MCPManager (Singleton)           │   │   │
│  │  │  - Tool caching (5s TTL)                      │   │   │
│  │  │  - Promise locking (prevents race conditions) │   │   │
│  │  │  - Timeout protection (30s)                   │   │   │
│  │  └──────────────────────┬────────────────────────┘   │   │
│  └─────────────────────────│────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────┴────────────────────────────┐   │
│  │            @langchain/mcp-adapters                    │   │
│  │            (MultiServerMCPClient)                     │   │
│  └──────────────┬─────────────────┬─────────────────────┘   │
│                 │                 │                         │
│  ┌──────────────┴──────┐ ┌────────┴─────────────┐          │
│  │  STDIO Servers      │ │  HTTP/SSE Servers    │          │
│  │  (fetch, filesystem)│ │  (remote MCP)        │          │
│  └─────────────────────┘ └──────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Development

### Project Structure

```
apps/mcp/
├── src/
│   ├── config/
│   │   └── mcp-servers.ts     # Server configuration parser
│   ├── routes/
│   │   ├── health.ts          # Health check endpoint
│   │   ├── tools.ts           # Tool operations
│   │   ├── resources.ts       # Resource operations
│   │   ├── prompts.ts         # Prompt operations
│   │   └── servers.ts         # Server status
│   ├── services/
│   │   └── mcp-manager.ts     # MCPManager singleton
│   ├── types/
│   │   └── langchain-mcp.ts   # Type definitions for MCP adapters
│   ├── utils/
│   │   ├── timeout.ts         # Timeout utility
│   │   ├── validation.ts      # Type guards
│   │   ├── http.ts            # HTTP helpers
│   │   └── request.ts         # Request parsing
│   ├── app.ts                 # Hono application
│   └── index.ts               # Entry point
├── package.json
└── tsconfig.json
```

### Adding a New MCP Server

1. **STDIO Server**: Add environment variable check in `config/mcp-servers.ts`
2. **Remote Server**: Add to `MCP_REMOTE_SERVERS` JSON configuration

### Testing

```bash
# Run all tests
pnpm test

# Run with watch mode
pnpm test:watch

# Run specific test file
pnpm test src/utils/timeout.test.ts
```

## Related

- `packages/mcp` - Shared types and HTTP client
- `docs/mcp/README.md` - Full MCP architecture documentation
