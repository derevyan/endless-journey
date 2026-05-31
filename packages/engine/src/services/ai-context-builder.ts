/**
 * AIContextBuilder - Builds well-formatted markdown context for LLMs
 *
 * Provides consistent formatting across the app for AI prompts.
 * Supports multiple output formats: keyValue, table, list, conversation, etc.
 *
 * @example
 * const context = createAIContextBuilder()
 *   .section("User Profile")
 *   .keyValue({ name: "John", plan: "Pro" })
 *   .section("Messages")
 *   .conversation(messages)
 *   .build();
 *
 * @module engine/services/ai-context-builder
 */

import { createLogger } from "@journey/logger";

const log = createLogger("ai-context-builder");

// =============================================================================
// TYPES
// =============================================================================

export interface ConversationMessage {
  role: "user" | "bot" | "system";
  content: string;
}

export interface TableRow {
  [key: string]: unknown;
}

export type FormatType = "keyValue" | "table" | "list" | "conversation" | "json" | "text" | "numbered";

export interface SectionConfig {
  title: string;
  data: unknown;
  format: FormatType;
}

export interface AIContextBuilderOptions {
  /** Separator between sections (default: "\n---\n") */
  sectionSeparator?: string;
  /** Include section headers (default: true) */
  includeHeaders?: boolean;
  /** Max length per value in keyValue format (default: 500) */
  maxValueLength?: number;
  /** Max rows in table format (default: 50) */
  maxTableRows?: number;
  /** Max items in list format (default: 100) */
  maxListItems?: number;
  /** Max messages in conversation format (default: 20) */
  maxConversationMessages?: number;
}

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Format object as key-value pairs
 */
function formatKeyValue(data: Record<string, unknown>, maxLength: number): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    const formattedKey = formatLabel(key);
    let formattedValue = formatValue(value);

    if (formattedValue.length > maxLength) {
      formattedValue = formattedValue.slice(0, maxLength) + "...";
    }

    lines.push(`- ${formattedKey}: ${formattedValue}`);
  }

  return lines.join("\n");
}

/**
 * Format array as markdown table
 */
function formatTable(data: TableRow[], maxRows: number): string {
  if (!Array.isArray(data) || data.length === 0) return "(empty)";

  const rows = data.slice(0, maxRows);
  const headers = Object.keys(rows[0]);

  // Header row
  const headerRow = `| ${headers.map(formatLabel).join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  // Data rows
  const dataRows = rows.map((row) => {
    const cells = headers.map((h) => formatValue(row[h]).replace(/\|/g, "\\|"));
    return `| ${cells.join(" | ")} |`;
  });

  const result = [headerRow, separatorRow, ...dataRows].join("\n");

  if (data.length > maxRows) {
    return result + `\n... and ${data.length - maxRows} more rows`;
  }

  return result;
}

/**
 * Format array as bulleted list
 */
function formatList(data: unknown[], maxItems: number): string {
  if (!Array.isArray(data) || data.length === 0) return "(empty)";

  const items = data.slice(0, maxItems);
  const lines = items.map((item) => `• ${formatValue(item)}`);

  if (data.length > maxItems) {
    lines.push(`... and ${data.length - maxItems} more items`);
  }

  return lines.join("\n");
}

/**
 * Format array as numbered list
 */
function formatNumberedList(data: unknown[], maxItems: number): string {
  if (!Array.isArray(data) || data.length === 0) return "(empty)";

  const items = data.slice(0, maxItems);
  const lines = items.map((item, i) => `${i + 1}. ${formatValue(item)}`);

  if (data.length > maxItems) {
    lines.push(`... and ${data.length - maxItems} more items`);
  }

  return lines.join("\n");
}

/**
 * Format conversation messages
 */
function formatConversation(messages: ConversationMessage[], maxMessages: number): string {
  if (!Array.isArray(messages) || messages.length === 0) return "(no messages)";

  const recent = messages.slice(-maxMessages);
  const lines = recent.map((msg) => {
    const role = msg.role === "user" ? "User" : msg.role === "bot" ? "Bot" : "System";
    return `${role}: ${msg.content}`;
  });

  if (messages.length > maxMessages) {
    return `(showing last ${maxMessages} of ${messages.length} messages)\n${lines.join("\n")}`;
  }

  return lines.join("\n");
}

/**
 * Format as pretty JSON
 */
function formatJson(data: unknown): string {
  try {
    return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
  } catch {
    return String(data);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert camelCase/snake_case to Title Case
 */
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1") // camelCase -> camel Case
    .replace(/_/g, " ") // snake_case -> snake case
    .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first
    .trim();
}

/**
 * Format any value to string
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(not provided)";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

// =============================================================================
// BUILDER CLASS
// =============================================================================

class AIContextBuilderImpl {
  private sections: Array<{ title: string; content: string }> = [];
  private currentTitle: string | null = null;
  private options: Required<AIContextBuilderOptions>;

  constructor(options: AIContextBuilderOptions = {}) {
    this.options = {
      sectionSeparator: options.sectionSeparator ?? "\n---\n",
      includeHeaders: options.includeHeaders ?? true,
      maxValueLength: options.maxValueLength ?? 500,
      maxTableRows: options.maxTableRows ?? 50,
      maxListItems: options.maxListItems ?? 100,
      maxConversationMessages: options.maxConversationMessages ?? 20,
    };
  }

  /**
   * Start a new section
   */
  section(title: string): this {
    this.currentTitle = title;
    return this;
  }

  /**
   * Add key-value formatted content
   */
  keyValue(data: Record<string, unknown>): this {
    this.addContent(formatKeyValue(data, this.options.maxValueLength));
    return this;
  }

  /**
   * Add table formatted content
   */
  table(data: TableRow[]): this {
    this.addContent(formatTable(data, this.options.maxTableRows));
    return this;
  }

  /**
   * Add bulleted list
   */
  list(data: unknown[]): this {
    this.addContent(formatList(data, this.options.maxListItems));
    return this;
  }

  /**
   * Add numbered list
   */
  numbered(data: unknown[]): this {
    this.addContent(formatNumberedList(data, this.options.maxListItems));
    return this;
  }

  /**
   * Add conversation formatted content
   */
  conversation(messages: ConversationMessage[]): this {
    this.addContent(formatConversation(messages, this.options.maxConversationMessages));
    return this;
  }

  /**
   * Add JSON formatted content
   */
  json(data: unknown): this {
    this.addContent(formatJson(data));
    return this;
  }

  /**
   * Add raw text content
   */
  text(content: string): this {
    this.addContent(content);
    return this;
  }

  /**
   * Add content conditionally
   */
  when(condition: boolean, builder: (ctx: this) => this): this {
    if (condition) {
      return builder(this);
    }
    return this;
  }

  /**
   * Build final markdown string
   */
  build(): string {
    const result = this.sections
      .map((s) => {
        if (this.options.includeHeaders && s.title) {
          return `## ${s.title}\n${s.content}`;
        }
        return s.content;
      })
      .join(this.options.sectionSeparator);

    log.debug({ sectionsCount: this.sections.length }, "aiContextBuilder:built");
    return result;
  }

  private addContent(content: string): void {
    if (!content) return;

    this.sections.push({
      title: this.currentTitle ?? "",
      content,
    });
    this.currentTitle = null;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a new AIContextBuilder instance
 */
export function createAIContextBuilder(options?: AIContextBuilderOptions): AIContextBuilderImpl {
  return new AIContextBuilderImpl(options);
}

/**
 * Build AI context from config (alternative API)
 */
export function buildAIContext(config: { sections: SectionConfig[]; options?: AIContextBuilderOptions }): string {
  const builder = createAIContextBuilder(config.options);

  for (const section of config.sections) {
    builder.section(section.title);

    switch (section.format) {
      case "keyValue":
        builder.keyValue(section.data as Record<string, unknown>);
        break;
      case "table":
        builder.table(section.data as TableRow[]);
        break;
      case "list":
        builder.list(section.data as unknown[]);
        break;
      case "numbered":
        builder.numbered(section.data as unknown[]);
        break;
      case "conversation":
        builder.conversation(section.data as ConversationMessage[]);
        break;
      case "json":
        builder.json(section.data);
        break;
      case "text":
        builder.text(String(section.data));
        break;
    }
  }

  return builder.build();
}

// =============================================================================
// SPECIALIZED BUILDERS (for common use cases)
// =============================================================================

/**
 * Build user profile context from session context
 * Extracts common user fields (name, username, email, etc.)
 */
export function buildUserProfileContext(context: Record<string, unknown>): string {
  const profile: Record<string, unknown> = {};

  // Extract common user fields
  const userFields = ["firstName", "first_name", "name", "username", "user_name", "email", "phone", "language", "timezone"];
  for (const field of userFields) {
    if (context[field] !== undefined) {
      profile[field] = context[field];
    }
  }

  if (Object.keys(profile).length === 0) return "";

  return createAIContextBuilder().section("User Profile").keyValue(profile).build();
}

/**
 * Build node output context (smart extraction by node type)
 * Formats data appropriately for agent, questionnaire, message, etc.
 */
export function buildNodeOutputContext(nodeLabel: string, nodeType: string, data: unknown): string {
  const builder = createAIContextBuilder().section(`Previous Step: ${nodeLabel}`);

  switch (nodeType) {
    case "agent": {
      const agentData = data as {
        lastResponse?: string;
        allResponses?: Array<{ userMessage?: string; response?: string }>;
      };

      if (agentData.lastResponse) {
        builder.text(`Last AI Response: ${agentData.lastResponse}`);
      }

      if (agentData.allResponses?.length) {
        const recent = agentData.allResponses.slice(-3);
        builder.section("Recent Conversation").conversation(
          recent
            .flatMap((r) => [
              { role: "user" as const, content: r.userMessage ?? "" },
              { role: "bot" as const, content: r.response ?? "" },
            ])
            .filter((m) => m.content)
        );
      }
      break;
    }

    case "questionnaire": {
      const qaData = data as Record<string, { questionText: string; answer: string; answerLabel?: string }>;
      const rows = Object.values(qaData).map((qa) => ({
        Question: qa.questionText,
        Answer: qa.answerLabel || qa.answer,
      }));
      builder.table(rows);
      break;
    }

    case "message": {
      const msgData = data as { selectedButtonLabel?: string; textResponse?: string };
      if (msgData.selectedButtonLabel) {
        builder.text(`User selected: "${msgData.selectedButtonLabel}"`);
      } else if (msgData.textResponse) {
        builder.text(`User responded: "${msgData.textResponse}"`);
      }
      break;
    }

    default:
      builder.json(data);
  }

  return builder.build();
}

/**
 * Build session context including tags, variables, and recent conversation
 */
export function buildSessionContext(session: {
  tags?: string[];
  context?: Record<string, unknown>;
  history?: Array<{ type: string; payload?: unknown }>;
}): string {
  const builder = createAIContextBuilder();

  // Tags
  if (session.tags?.length) {
    builder.section("User Tags").list(session.tags);
  }

  // Variables
  if (session.context && Object.keys(session.context).length > 0) {
    builder.section("Session Variables").json(session.context);
  }

  // Recent messages
  if (session.history?.length) {
    const messages = session.history
      .filter((e) => e.type === "USER_MESSAGE" || e.type === "ENGINE_MESSAGE")
      .slice(-10)
      .map((e) => {
        const payload = e.payload as { text?: string; content?: string } | null | undefined;
        return {
          role: (e.type === "USER_MESSAGE" ? "user" : "bot") as "user" | "bot",
          content: payload?.text ?? payload?.content ?? "",
        };
      })
      .filter((m) => m.content);

    if (messages.length > 0) {
      builder.section("Recent Conversation").conversation(messages);
    }
  }

  return builder.build();
}
