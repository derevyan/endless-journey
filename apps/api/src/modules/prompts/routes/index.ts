/**
 * Prompt Routes
 *
 * REST API for prompt management.
 *
 * Routes:
 * - GET    /prompts                         - List prompts
 * - POST   /prompts                         - Create prompt + initial version
 * - GET    /prompts/:name                   - Get prompt by name
 * - PUT    /prompts/:name                   - Update prompt metadata
 * - DELETE /prompts/:name                   - Soft delete prompt
 *
 * - GET    /prompts/:name/versions          - List all versions
 * - POST   /prompts/:name/versions          - Create new version
 * - GET    /prompts/:name/versions/:vId     - Get specific version
 * - PUT    /prompts/:name/versions/:vId/labels - Update labels
 * - DELETE /prompts/:name/versions/:vId     - Delete version
 *
 * @module modules/prompts/routes
 */

import { createLogger, serializeError } from "@journey/logger";
import {
  CreatePromptInputSchema,
  UpdatePromptInputSchema,
  CreateVersionInputSchema,
  UpdateLabelsInputSchema,
  PromptFiltersSchema,
  CompilePromptInputSchema,
} from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson, validateQuery } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:prompts");

// =============================================================================
// ROUTER SETUP
// =============================================================================

const promptsRouter = createProtectedRouter({
  defaultPermission: { resource: "prompt", action: "read" },
});

// =============================================================================
// PROMPT CRUD ROUTES
// =============================================================================

/**
 * GET /prompts - List prompts with filtering
 */
promptsRouter.get("/", async (c) => {
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const parseResult = validateQuery(c, PromptFiltersSchema);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const result = await services.prompt.listPrompts(parseResult.data);

  log.info({ organizationId: organization.id, count: result.total }, "prompts:list");

  return c.json(result);
});

/**
 * POST /prompts - Create a new prompt
 */
promptsRouter.post(
  "/",
  protect({
    permission: { resource: "prompt", action: "create" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreatePromptInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const result = await services.prompt.createPrompt(user.id, parseResult.data);

    log.info({ promptId: result.id, name: result.name, userId: user.id }, "prompts:create");

    return c.json(result, 201);
  }
);

/**
 * GET /prompts/:name - Get prompt by name
 */
promptsRouter.get("/:name", async (c) => {
  const services = createServicesFromContext(c);
  const name = c.req.param("name");

  const result = await services.prompt.getPromptByName(name);

  return c.json(result);
});

/**
 * PUT /prompts/:name - Update prompt metadata
 */
promptsRouter.put(
  "/:name",
  protect({
    permission: { resource: "prompt", action: "update" },
  }),
  async (c) => {
    const name = c.req.param("name");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdatePromptInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const result = await services.prompt.updatePrompt(name, parseResult.data);

    log.info({ promptId: result.id, name }, "prompts:update");

    return c.json(result);
  }
);

/**
 * DELETE /prompts/:name - Soft delete prompt
 */
promptsRouter.delete(
  "/:name",
  protect({
    permission: { resource: "prompt", action: "delete" },
  }),
  async (c) => {
    const organization = c.get("authOrg");
    const name = c.req.param("name");
    const services = createServicesFromContext(c);

    await services.prompt.deletePrompt(name);

    log.info({ name, organizationId: organization.id }, "prompts:delete");

    return c.json({ success: true });
  }
);

// =============================================================================
// VERSION ROUTES
// =============================================================================

/**
 * GET /prompts/:name/versions - List all versions
 */
promptsRouter.get("/:name/versions", async (c) => {
  const services = createServicesFromContext(c);
  const name = c.req.param("name");

  const versions = await services.prompt.listVersions(name);

  return c.json({ versions });
});

/**
 * POST /prompts/:name/versions - Create new version
 */
promptsRouter.post(
  "/:name/versions",
  protect({
    permission: { resource: "prompt", action: "update" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const name = c.req.param("name");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateVersionInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const result = await services.prompt.createVersion(name, user.id, parseResult.data);

    log.info({ name, versionId: result.versionId, userId: user.id }, "prompts:createVersion");

    return c.json(result, 201);
  }
);

/**
 * GET /prompts/:name/versions/:versionId - Get specific version
 */
promptsRouter.get("/:name/versions/:versionId", async (c) => {
  const services = createServicesFromContext(c);
  const name = c.req.param("name");
  const versionId = c.req.param("versionId");

  const result = await services.prompt.getVersion(name, versionId);

  return c.json(result);
});

/**
 * PUT /prompts/:name/versions/:versionId/labels - Update labels
 */
promptsRouter.put(
  "/:name/versions/:versionId/labels",
  protect({
    permission: { resource: "prompt", action: "update" },
  }),
  async (c) => {
    const name = c.req.param("name");
    const versionId = c.req.param("versionId");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateLabelsInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const result = await services.prompt.updateLabels(name, versionId, parseResult.data);

    log.info({ name, versionId, labels: parseResult.data.labels }, "prompts:updateLabels");

    return c.json(result);
  }
);

/**
 * DELETE /prompts/:name/versions/:versionId - Delete version
 */
promptsRouter.delete(
  "/:name/versions/:versionId",
  protect({
    permission: { resource: "prompt", action: "delete" },
  }),
  async (c) => {
    const organization = c.get("authOrg");
    const name = c.req.param("name");
    const versionId = c.req.param("versionId");
    const services = createServicesFromContext(c);

    await services.prompt.deleteVersion(name, versionId);

    log.info({ name, versionId, organizationId: organization.id }, "prompts:deleteVersion");

    return c.json({ success: true });
  }
);

// =============================================================================
// RUNTIME ROUTES (compile/test)
// =============================================================================

/**
 * GET /prompts/:name/compiled - Get prompt without variable resolution
 * Query params: label (default: "production")
 *
 * Use this to preview the raw prompt content.
 * For variable resolution, use POST /prompts/:name/compile
 */
promptsRouter.get("/:name/compiled", async (c) => {
  const name = c.req.param("name");
  const label = c.req.query("label") ?? "production";
  const services = createServicesFromContext(c);

  // Use cached version for better performance
  const version = await services.prompt.getVersionByLabel(name, label);

  // Return in compiled format
  const prompt = await services.prompt.getPromptByName(name);

  return c.json({
    name: prompt.name,
    type: prompt.type,
    versionId: version.versionId,
    label,
    content: version.content,
  });
});

/**
 * POST /prompts/:name/compile - Compile prompt with variable resolution
 *
 * Body: { variables: { key: value }, label?, versionId? }
 * Returns: Fully compiled prompt with variables resolved
 */
promptsRouter.post("/:name/compile", async (c) => {
  const organization = c.get("authOrg");
  const name = c.req.param("name");
  const services = createServicesFromContext(c);

  const parseResult = await validateJson(c, CompilePromptInputSchema);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const { variables, label, versionId } = parseResult.data;

  const compiled = await services.prompt.compilePrompt(name, variables, { label, versionId });

  log.info({ name, versionId: compiled.versionId, organizationId: organization.id }, "prompts:compile");

  return c.json(compiled);
});

/**
 * GET /prompts/:name/variables - Extract variables from prompt
 *
 * Query params: label (default: "latest"), versionId
 * Returns: List of variable names/paths in the prompt
 */
promptsRouter.get("/:name/variables", async (c) => {
  const name = c.req.param("name");
  const label = c.req.query("label") ?? "latest";
  const versionId = c.req.query("versionId");
  const services = createServicesFromContext(c);

  // Get version
  const version = versionId
    ? await services.prompt.getVersion(name, versionId)
    : await services.prompt.getVersionByLabel(name, label);

  // Extract variables
  const variables = services.prompt.extractVariables(version.content);
  const paths = services.prompt.extractVariablePaths(version.content);

  return c.json({
    versionId: version.versionId,
    variables,
    paths,
  });
});

export { promptsRouter as prompts };
