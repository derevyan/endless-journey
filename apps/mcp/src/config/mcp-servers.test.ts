import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getMCPServersConfig } from "./mcp-servers";
import type { MCPStdioServerConfig, MCPHttpServerConfig } from "@journey/mcp";

describe("getMCPServersConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty config when no servers enabled", () => {
    delete process.env.MCP_FETCH_ENABLED;
    delete process.env.MCP_FILESYSTEM_ENABLED;
    delete process.env.MCP_REMOTE_SERVERS;

    const config = getMCPServersConfig();
    expect(Object.keys(config)).toHaveLength(0);
  });

  it("includes fetch server when enabled", () => {
    process.env.MCP_FETCH_ENABLED = "true";

    const config = getMCPServersConfig();
    expect(config.fetch).toBeDefined();
    const fetchConfig = config.fetch as MCPStdioServerConfig;
    expect(fetchConfig.transport).toBe("stdio");
    expect(fetchConfig.command).toBe("uvx");
  });

  it("excludes fetch server when not enabled", () => {
    process.env.MCP_FETCH_ENABLED = "false";

    const config = getMCPServersConfig();
    expect(config.fetch).toBeUndefined();
  });

  it("includes filesystem server when enabled", () => {
    process.env.MCP_FILESYSTEM_ENABLED = "true";

    const config = getMCPServersConfig();
    expect(config.filesystem).toBeDefined();
    const fsConfig = config.filesystem as MCPStdioServerConfig;
    expect(fsConfig.transport).toBe("stdio");
    expect(fsConfig.command).toBe("npx");
  });

  it("uses custom paths for filesystem server", () => {
    process.env.MCP_FILESYSTEM_ENABLED = "true";
    process.env.MCP_FILESYSTEM_PATHS = "/custom/path";

    const config = getMCPServersConfig();
    const fsConfig = config.filesystem as MCPStdioServerConfig;
    expect(fsConfig.args).toContain("/custom/path");
  });

  it("parses remote servers from array format", () => {
    process.env.MCP_REMOTE_SERVERS = JSON.stringify([
      { name: "remote1", url: "http://localhost:4000/mcp", transport: "http" },
    ]);

    const config = getMCPServersConfig();
    expect(config.remote1).toBeDefined();
    const remoteConfig = config.remote1 as MCPHttpServerConfig;
    expect(remoteConfig.url).toBe("http://localhost:4000/mcp");
    expect(remoteConfig.transport).toBe("http");
  });

  it("parses remote servers from object format", () => {
    process.env.MCP_REMOTE_SERVERS = JSON.stringify({
      remote1: { url: "http://localhost:4000/mcp", transport: "sse" },
    });

    const config = getMCPServersConfig();
    expect(config.remote1).toBeDefined();
    expect(config.remote1.transport).toBe("sse");
  });

  it("normalizes streamable_http to http", () => {
    process.env.MCP_REMOTE_SERVERS = JSON.stringify([
      { name: "remote1", url: "http://localhost:4000/mcp", transport: "streamable_http" },
    ]);

    const config = getMCPServersConfig();
    expect(config.remote1.transport).toBe("http");
  });

  it("includes headers in remote server config", () => {
    process.env.MCP_REMOTE_SERVERS = JSON.stringify([
      {
        name: "remote1",
        url: "http://localhost:4000/mcp",
        headers: { Authorization: "Bearer token" },
      },
    ]);

    const config = getMCPServersConfig();
    const remoteConfig = config.remote1 as MCPHttpServerConfig;
    expect(remoteConfig.headers).toEqual({ Authorization: "Bearer token" });
  });

  it("ignores invalid JSON in MCP_REMOTE_SERVERS", () => {
    process.env.MCP_REMOTE_SERVERS = "invalid-json{";

    const config = getMCPServersConfig();
    expect(Object.keys(config)).toHaveLength(0);
  });

  it("ignores remote servers with missing url", () => {
    process.env.MCP_REMOTE_SERVERS = JSON.stringify([{ name: "remote1" }]);

    const config = getMCPServersConfig();
    expect(config.remote1).toBeUndefined();
  });

  it("ignores remote servers with invalid transport", () => {
    process.env.MCP_REMOTE_SERVERS = JSON.stringify([
      { name: "remote1", url: "http://localhost:4000", transport: "invalid" },
    ]);

    const config = getMCPServersConfig();
    expect(config.remote1).toBeUndefined();
  });
});
