/**
 * MCP Server Configuration
 *
 * Configures Model Context Protocol (MCP) servers for AI agent tools.
 * MCP servers run as subprocesses and provide tools via stdio transport.
 *
 * Remote servers can also be provided via MCP_REMOTE_SERVERS (JSON array or map).
 *
 * @example
 * ```bash
 * # Enable fetch server (default)
 * MCP_FETCH_ENABLED=true
 *
 * # Disable fetch server
 * MCP_FETCH_ENABLED=false
 * ```
 *
 * @module config/mcp-servers
 */

import { createLogger, serializeError } from "@journey/logger";
import type { MCPHttpServerConfig, MCPServersConfig } from "@journey/mcp";
import { isStringRecord } from "../utils";

const log = createLogger("mcp:config");

type RemoteServerEntry = {
  name: string;
  url: string;
  transport?: string;
  headers?: Record<string, string>;
};

function normalizeTransport(value?: string): MCPHttpServerConfig["transport"] | null {
  if (!value) {
    return "http";
  }

  const normalized = value.toLowerCase();
  if (normalized === "streamable_http") {
    return "http";
  }

  if (normalized === "http" || normalized === "sse") {
    return normalized;
  }

  return null;
}

function toRemoteServerConfig(entry: RemoteServerEntry): MCPHttpServerConfig | null {
  const transport = normalizeTransport(entry.transport);
  if (!transport) {
    log.warn({ name: entry.name, transport: entry.transport }, "mcpConfig:invalidTransport");
    return null;
  }

  if (!entry.url) {
    log.warn({ name: entry.name }, "mcpConfig:missingUrl");
    return null;
  }

  return {
    transport,
    url: entry.url,
    headers: entry.headers,
  };
}

function parseRemoteServers(raw?: string): MCPServersConfig {
  const servers: MCPServersConfig = {};

  if (!raw) {
    return servers;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") {
          log.warn({ entry }, "mcpConfig:invalidRemoteEntry");
          continue;
        }

        const { name, url, transport, headers } = entry as Record<string, unknown>;
        if (!name || typeof name !== "string") {
          log.warn({ entry }, "mcpConfig:missingRemoteName");
          continue;
        }

        if (!url || typeof url !== "string") {
          log.warn({ name }, "mcpConfig:missingRemoteUrl");
          continue;
        }

        const config = toRemoteServerConfig({
          name,
          url,
          transport: typeof transport === "string" ? transport : undefined,
          headers: isStringRecord(headers) ? headers : undefined,
        });

        if (config) {
          servers[name] = config;
        }
      }

      return servers;
    }

    if (parsed && typeof parsed === "object") {
      for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!value || typeof value !== "object") {
          log.warn({ name }, "mcpConfig:invalidRemoteConfig");
          continue;
        }

        const configValue = value as Record<string, unknown>;
        const url = configValue.url;
        if (!url || typeof url !== "string") {
          log.warn({ name }, "mcpConfig:missingRemoteUrl");
          continue;
        }

        const transportValue =
          typeof configValue.transport === "string"
            ? configValue.transport
            : typeof configValue.type === "string"
              ? configValue.type
              : undefined;

        const config = toRemoteServerConfig({
          name,
          url,
          transport: transportValue,
          headers: isStringRecord(configValue.headers) ? configValue.headers : undefined,
        });

        if (config) {
          servers[name] = config;
        }
      }

      return servers;
    }

    log.warn({ raw }, "mcpConfig:invalidRemoteServers");
    return servers;
  } catch (error) {
    log.warn({ err: serializeError(error) }, "mcpConfig:parseRemoteServersFailed");
    return servers;
  }
}

/**
 * Get MCP servers configuration based on environment variables.
 * Servers are disabled by default - enable via MCP_*_ENABLED=true.
 */
export function getMCPServersConfig(): MCPServersConfig {
  const servers: MCPServersConfig = {};

  // Fetch Server - fetches web content and converts to markdown
  // Official MCP server (Python): https://github.com/modelcontextprotocol/servers/tree/main/src/fetch
  // Requires: Python with uv installed (brew install uv)
  if (process.env.MCP_FETCH_ENABLED === "true") {
    servers.fetch = {
      transport: "stdio",
      command: "uvx",
      args: ["mcp-server-fetch"],
    };
  }

  // Filesystem Server - file operations (read, write, list)
  // Official MCP server (Node.js): https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem
  if (process.env.MCP_FILESYSTEM_ENABLED === "true") {
    const allowedPaths = process.env.MCP_FILESYSTEM_PATHS || process.cwd();
    servers.filesystem = {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", allowedPaths],
    };
  }

  const remoteServers = parseRemoteServers(process.env.MCP_REMOTE_SERVERS);
  for (const [name, config] of Object.entries(remoteServers)) {
    if (servers[name]) {
      log.warn({ name }, "mcpConfig:remoteOverride");
    }
    servers[name] = config;
  }

  return servers;
}
