# Add New MCP Server: {serverName}

## 🎯 Mission
Create a new MCP server in `packages/mcp` and integrate it with the frontend.

## 🛠️ Execution Steps

### 1. Create Server Logic
- Create `packages/mcp/src/servers/{serverName}/`.
- Implement tools and resources.

### 2. Register in MCP Service
- Add the new server to the MCP registry in `apps/api`.

### 3. Frontend Integration
- Update `docs/dev/guides/mcp-tools.md` with instructions for the new tools.
- Create any necessary UI components in `apps/web/src/features/developers/`.

### 4. Documentation
- Create a dedicated guide in `docs/dev/guides/mcp-{serverName}.md` explaining step-by-step configuration and usage.

## ✅ Validation
- Run `pnpm typecheck`.
- Verify the server appears in the developer tools.
