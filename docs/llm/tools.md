# LLM Tool System

Unified tool system for `@journey/llm` covering system tools (context-aware), utility tools (in-process), and MCP tools (external servers).

## Overview

| Source  | ID Prefix  | Runtime          | Context                     | Example                |
| ------- | ---------- | ---------------- | --------------------------- | ---------------------- |
| System  | `system:`  | In-process       | Requires services + session | `system:save_memory`   |
| Utility | `utility:` | In-process       | None                        | `utility:current_time` |
| MCP     | `mcp:`     | External service | None                        | `mcp:fetch:fetch`      |

Tool IDs are standardized as:

- `system:{toolName}`
- `utility:{toolName}`
- `mcp:{server}:{toolName}`

## Unified Tool Registry

`unifiedToolRegistry` is the single source of truth for tool discovery and resolution.

```typescript
import { unifiedToolRegistry } from "@journey/llm/tools/unified";

const all = await unifiedToolRegistry.getAllDefinitions();
const available = await unifiedToolRegistry.getAvailableDefinitions();

const tools = await unifiedToolRegistry.resolveTools(["system:save_memory", "utility:current_time"], context);
```

Notes:

- Importing `@journey/llm/tools/unified` auto-registers system + journey + utility tools.
- MCP definitions are cached for ~5s; pass `refreshMCP=true` to `getAllDefinitions()` to force refresh.

### UnifiedToolsConfig (agent nodes)

```typescript
interface UnifiedToolsConfig {
  enabled: string[]; // tool IDs
  mcpServers?: string[];
}
```

### Tool Definitions

```typescript
interface UnifiedToolDefinition {
  id: string; // system:save_memory, utility:current_time, mcp:fetch:fetch
  name: string; // tool name used in LLM calls
  displayName: string;
  description: string;
  category: "memory" | "variables" | "tags" | "crm" | "context" | "messaging" | "journey" | "search" | "utility" | "external";
  source: "system" | "utility" | "mcp";
  available: boolean;
  unavailableReason?: string;
  requiresContext?: boolean;
  requiredServices?: Array<"memory" | "variable" | "messenger" | "mindstate" | "journey" | "tag" | "crm">;
  apiKeyEnvVar?: string;
  mcpServer?: string;
}
```

---

## Utility Tools (Embedded)

Utility tools run in-process and require no context.

### Recommended Definition Helper

Utility tools are defined with the `tool()` helper in `packages/llm/src/tools/tool.ts`.

```typescript
import { z } from "zod";
import { tool } from "../tool";

export default tool(async ({ query }) => ({ results: [`Result for ${query}`] }), {
  name: "web_search",
  description: "Search the web for information",
  schema: z.object({ query: z.string() }),
  category: "search",
  apiKeyEnvVar: "SEARCH_API_KEY",
});
```

### Built-in Utility Tools

| Tool                | ID                     | Notes                     |
| ------------------- | ---------------------- | ------------------------- |
| Web Search (Tavily) | `utility:web_search`   | Requires `TAVILY_API_KEY` |
| Current Time        | `utility:current_time` | No API key                |

#### `web_search` schema

```typescript
z.object({
  query: z.string().min(1).max(400),
  maxResults: z.number().int().min(1).max(10).optional(),
  searchDepth: z.enum(["basic", "advanced"]).optional(),
});
```

#### `current_time` schema

```typescript
z.object({
  timezone: z.string().optional(),
  format: z.enum(["full", "date", "time", "iso"]).optional(),
});
```

---

## System Tools (Built-in)

System tools require execution context (services, session, security config). The unified registry exposes memory/variables/context/messaging/tools as `system:`.

### Context Shape

```typescript
interface BuiltinToolContext {
  nodeId: string;
  services: SharedServiceContext;
  session: {
    sessionId: string;
    journeyId: string;
    userId: string;
    currentNodeId: string;
    tags?: string[];
    context?: Record<string, unknown>;
    nodeOutputs?: Record<string, unknown>;
  };
  clientData?: {
    id?: string;
    platform?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  log: Logger;
  security?: {
    protectedVariables?: string[];
    protectedPatterns?: string[];
    logToolCalls?: boolean;
  };
}
```

### Resolving System Tools

```typescript
import { unifiedToolRegistry } from "@journey/llm/tools/unified";

const tools = await unifiedToolRegistry.resolveTools(
  [
    "system:read_journey_variable",
    "system:read_user_variable",
    "system:write_journey_variable",
    "system:write_user_variable",
    "system:save_memory",
    "system:recall_memories",
    "system:send_message",
    "system:exit_to_next_node",
    "system:get_user_profile",
    "system:get_journey_context",
  ],
  context
);
```

### Variable Tools

- `read_journey_variable`
- `write_journey_variable`
- `read_user_variable`
- `write_user_variable`
- `read_mindstate_parameter` (args: `mindstate`, `parameter`)

### Tag Tools

- `add_user_tags`
- `remove_user_tags`
- `get_user_tags`

### Memory Tools

- `save_memory`
- `recall_memories` (limit max 10)

### Messaging Tools

- `send_message` (args: `content`, optional `buttons`, optional `media`)
- `exit_to_next_node` (args: `summary` optional)

### Context Tools

- `get_user_profile`
- `get_journey_context`

### CRM / Pipeline Tools

- `move_to_pipeline_stage`
- `get_pipeline_position`

### Journey Tools

| Tool                  | ID                           | Description                                             |
| --------------------- | ---------------------------- | ------------------------------------------------------- |
| `start_journey`       | `system:start_journey`       | Route user to a different journey (validates allowlist) |
| `list_journeys`       | `system:list_journeys`       | List available journeys for routing                     |
| `get_active_journeys` | `system:get_active_journeys` | Get user's current journey sessions                     |

Note: Journey tools require the `journey` service in the context.

---

## MCP Tools

MCP tools are loaded from the MCP service and exposed via `mcp:` tool IDs.

Tool names from MCP are in `server_tool` format (for example `fetch_fetch`).

```typescript
import { unifiedToolRegistry } from "@journey/llm/tools/unified";

const tools = await unifiedToolRegistry.resolveTools(
  ["mcp:fetch:fetch"],
  undefined, // no context needed for MCP tools
  ["fetch"] // MCP server names to connect to
);
```

Notes:

- MCP tools require `initMCPServiceClient()` to be called on startup.
- MCP definitions are fetched from the MCP service and cached for ~5 seconds.

---

## Combining Tool Sources

Use `unifiedToolRegistry.resolveTools()` to load tools from any source in a single call:

```typescript
import { unifiedToolRegistry } from "@journey/llm/tools/unified";

const tools = await unifiedToolRegistry.resolveTools(
  [
    // System tools (require context)
    "system:read_user_variable",
    "system:send_message",
    // Utility tools (no context needed)
    "utility:current_time",
    // MCP tools (no context needed)
    "mcp:fetch:fetch",
  ],
  context, // pass context for system tools
  ["fetch"] // MCP server names
);
```

---

## Security Considerations

- Protected variables are blocked by `protectedVariables` and `protectedPatterns` in the security config.
- Tools can declare `capabilities` in `AgentTool` for permission checks.
- MCP tools run in a separate process and can be disabled by service config.

---

## File Reference

| File                                                   | Purpose                          |
| ------------------------------------------------------ | -------------------------------- |
| `packages/llm/src/tools/index.ts`                      | Tool exports                     |
| `packages/llm/src/tools/tool.ts`                       | Utility tool helper              |
| `packages/llm/src/tools/types.ts`                      | MCP type re-exports              |
| `packages/llm/src/tools/embedded/index.ts`             | Embedded tool auto-registration  |
| `packages/llm/src/tools/embedded/tavily.tool.ts`       | Web search tool                  |
| `packages/llm/src/tools/embedded/current-time.tool.ts` | Current time tool                |
| `packages/llm/src/tools/builtin/*`                     | System tool factories            |
| `packages/llm/src/tools/unified/*`                     | Unified registry + registrations |
