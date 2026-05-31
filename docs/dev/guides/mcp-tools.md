# MCP Servers: Setup and Frontend Usage

This guide explains how to add a new MCP server to `apps/mcp`, configure it, and use its tools in the frontend through the API and `@journey/llm`.

## Architecture Summary

- `apps/mcp` is a standalone Hono service that runs MCP servers via `@langchain/mcp-adapters`.
- The MCP manager prefixes tool names with the server name (`prefixToolNameWithServerName: true`), so tools look like `server_tool`.
- `apps/api` initializes the MCP HTTP client from `@journey/mcp` and exposes `/api/agent-tools` via `@journey/llm`'s unified tool registry.
- `apps/web` uses the agent-tools endpoint to show MCP tools under the External (MCP) category.

## Step-by-Step: Add a New MCP Server (apps/mcp)

### 1) Pick a server name and transport

- Use a lowercase name without underscores. The server name becomes the prefix used in tool names.
- Supported transports: `stdio` (local subprocess), `http`, `sse` (remote).
- `streamable_http` is normalized to `http` by the MCP config loader.

### 2) Configure the server

Option A: local stdio server (edit code)

`apps/mcp/src/config/mcp-servers.ts`:

```ts
if (process.env.MCP_GITHUB_ENABLED === "true") {
  servers.github = {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
    },
    restart: {
      enabled: true,
      maxAttempts: 3,
      delayMs: 1000,
    },
  };
}
```

Option B: remote HTTP/SSE server (no code change)

Set `MCP_REMOTE_SERVERS` to JSON (array or map):

```bash
MCP_REMOTE_SERVERS='[
  {
    "name": "calendar",
    "transport": "http",
    "url": "https://mcp.example.com/mcp",
    "headers": { "Authorization": "Bearer YOUR_TOKEN" }
  }
]'
```

or

```bash
MCP_REMOTE_SERVERS='{
  "calendar": {
    "transport": "sse",
    "url": "https://mcp.example.com/mcp",
    "headers": { "Authorization": "Bearer YOUR_TOKEN" }
  }
}'
```

### 3) Set environment variables for apps/mcp

Common variables:

- `PORT` (default `3002`)
- `MCP_<SERVER>_ENABLED=true` for stdio servers you add
- Server-specific secrets (example: `GITHUB_TOKEN`)
- `MCP_FILESYSTEM_ENABLED=true` and `MCP_FILESYSTEM_PATHS=/allowed/path`
- `MCP_REMOTE_SERVERS=...` for HTTP/SSE servers

If you add new env vars, update `docs/reference/environment-variables.md`.

### 4) Start and verify

```bash
pnpm dev:mcp
```

Verify:

- `GET http://localhost:3002/servers`
- `GET http://localhost:3002/tools`
- `GET http://localhost:3002/health`

If a server is configured but returns no tools, you will see `mcpManager:serverNoTools` in the MCP logs.

## Step-by-Step: Expose Tools to the Frontend

### 5) Ensure the API can reach the MCP service

`apps/api` initializes `MCPServiceClient` on boot. Configure:

- `MCP_SERVICE_URL` (default `http://localhost:3002`)
- `MCP_SERVICE_TIMEOUT` (default `30000` ms)

### 6) Tool discovery in the frontend (agent workflows)

The workflow builder UI fetches tools from `/api/agent-tools`:

- Use `useToolDefinitions()` or `useToolDefinitionsWithUtils()` in `apps/web/src/features/agent-workflows/hooks/use-tool-definitions.ts`.
- MCP tools appear under the External (MCP) category automatically. No manual tool list is needed.

Tool ID format:

- `mcp:<server>:<tool>` (example: `mcp:fetch:fetch`)
- Raw MCP tool names remain `server_tool` (example: `fetch_fetch`)

### 7) MCP node configuration (workflow execution)

For MCP workflow nodes, set:

- `server`: server key (example: `github`)
- `tool`: tool name without prefix (example: `create_issue`)
- `params`: JSON object of tool args

The MCP node executor builds `github_create_issue` and calls the MCP service.

### 8) Optional: restrict MCP servers per agent

If you need to limit which MCP servers are allowed, use `UnifiedToolsConfig.mcpServers` (see `packages/llm/src/tools/unified/types.ts`).

## Legacy UI Note

`apps/web/src/features/nodes/journey/hooks/use-available-tools.ts` is a static list used by the legacy journey editor. If you need MCP tools there, add them manually.

## Troubleshooting

- MCP service not reachable: check `apps/mcp/logs/journey.log` and `apps/api/logs/journey.log`.
- Tools missing in UI: refresh `/api/agent-tools?refresh=true` (MCP tools cache for 5s in `@journey/llm`).
- Server name issues: avoid underscores in server names. Server names are parsed from the `server_tool` prefix.
