/**
 * Prompts Seeding Module
 *
 * Seeds prompts from markdown files in apps/web/src/data/prompts/
 * Creates prompts with initial "production" labeled versions.
 *
 * @module seed/seed-prompts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@journey/logger";
import type { PromptChatMessage } from "@journey/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { organization, prompts, promptVersions } from "../schema";
import { PROMPT_CONFIGS } from "./data";
import type { PromptConfigData } from "./types";

const log = createLogger("db:seed:prompts");

// =============================================================================
// CONTENT LOADING
// =============================================================================

/**
 * Base path to prompts data directory
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DATA_DIR = path.resolve(__dirname, "../../../../apps/web/src/data/prompts");

/**
 * Parse markdown content for chat-type prompts.
 * Uses ---role--- markers to split into messages.
 *
 * Format:
 * ---system---
 * System message content
 *
 * ---user---
 * User message content
 */
function parseChatContent(markdown: string): PromptChatMessage[] {
  const messages: PromptChatMessage[] = [];
  const rolePattern = /---(\w+)---/g;

  // Split by role markers
  const parts = markdown.split(rolePattern);

  // parts[0] is content before first marker (should be empty or whitespace)
  // parts[1] is first role, parts[2] is first content, etc.
  for (let i = 1; i < parts.length; i += 2) {
    const role = parts[i] as "system" | "user" | "assistant";
    const content = parts[i + 1]?.trim() || "";

    if (content && ["system", "user", "assistant"].includes(role)) {
      messages.push({ role, content });
    }
  }

  return messages;
}

/**
 * Load prompt content from markdown file
 */
function loadPromptContent(promptName: string, type: "text" | "chat"): string | PromptChatMessage[] {
  const contentPath = path.join(PROMPTS_DATA_DIR, promptName, "content.md");

  if (!fs.existsSync(contentPath)) {
    log.error({ contentPath }, "seed:promptContentNotFound");
    throw new Error(`Prompt content file not found: ${contentPath}`);
  }

  const markdown = fs.readFileSync(contentPath, "utf-8");

  if (type === "chat") {
    return parseChatContent(markdown);
  }

  // For text type, return raw content
  return markdown;
}

// =============================================================================
// PROMPT DEFINITION WITH CONTENT
// =============================================================================

/**
 * Prompt definition with loaded content.
 * Extends PromptConfigData (from types.ts) with the actual content loaded from markdown.
 */
interface PromptDefinition extends PromptConfigData {
  content: string | PromptChatMessage[];
}

/**
 * Build prompt definitions from configs with loaded content
 */
function buildPromptDefinitions(): PromptDefinition[] {
  return PROMPT_CONFIGS.map((config: PromptConfigData) => ({
    name: config.name,
    description: config.description,
    type: config.type,
    tags: config.tags,
    isSystem: config.isSystem,
    scope: config.scope,
    content: loadPromptContent(config.name, config.type),
  }));
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

/**
 * Helper function to seed a single prompt definition to an organization
 */
async function seedPromptToOrg(orgId: string, promptDef: PromptDefinition) {
  // Check if this prompt already exists for this organization
  const existing = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.organizationId, orgId), eq(prompts.name, promptDef.name), isNull(prompts.deletedAt)));

  if (existing.length > 0) {
    log.debug({ orgId, promptName: promptDef.name }, "seed:promptExists");
    return;
  }

  // Create the prompt
  const [newPrompt] = await db
    .insert(prompts)
    .values({
      organizationId: orgId,
      name: promptDef.name,
      description: promptDef.description,
      type: promptDef.type,
      tags: promptDef.tags,
      isSystem: promptDef.isSystem,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create the initial version with "production" and "latest" labels
  await db.insert(promptVersions).values({
    promptId: newPrompt.id,
    versionId: "v001",
    content: promptDef.content,
    labels: ["production", "latest"],
    notes: "Initial version - seeded from markdown",
    createdAt: new Date(),
  });

  log.info({ orgId, promptName: promptDef.name }, "seed:promptCreated");
}

/**
 * Seed prompts for all organizations
 *
 * - Global prompts (scope: "global") are seeded to all organizations
 */
export async function seedPrompts() {
  log.info("🌱 Seeding prompts from markdown files...");

  // Build prompt definitions with loaded content
  const promptDefinitions = buildPromptDefinitions();
  log.info({ count: promptDefinitions.length }, "seed:promptsLoaded");

  // Separate by scope
  const globalPrompts = promptDefinitions.filter((p) => p.scope === "global");

  // Get all organizations
  const organizations = await db.select().from(organization);

  // Seed global prompts to all organizations
  for (const org of organizations) {
    for (const promptDef of globalPrompts) {
      await seedPromptToOrg(org.id, promptDef);
    }
  }

  // Seed demo questionnaire prompt to Demo Workspace for testing
  const demoOrg = organizations.find((org) => org.name === "Demo Workspace");
  if (demoOrg) {
    const demoPrompt = promptDefinitions.find((p) => p.name === "questionnaire-demo");
    if (demoPrompt) {
      await seedPromptToOrg(demoOrg.id, demoPrompt);
      log.info({ orgId: demoOrg.id }, "seed:questionnaireDemoPromptSeededToDemo");
    }
  }

  log.info("✅ Prompts seeded from markdown files!");
}
