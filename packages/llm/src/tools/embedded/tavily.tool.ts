/**
 * Tavily Search Tool
 *
 * AI-optimized web search using Tavily API.
 * Requires: TAVILY_API_KEY environment variable
 *
 * @see https://tavily.com/
 * @module tools/embedded/tavily.tool
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { tool } from "../tool";

const log = createLogger("llm:tools:tavily");

// Schema for tool input validation
const schema = z.object({
  query: z
    .string()
    .min(1)
    .max(400)
    .describe("Search query - be specific and concise. Use quotes for exact phrases, minus to exclude terms."),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe("Maximum number of results (1-10)"),
  searchDepth: z
    .enum(["basic", "advanced"])
    .optional()
    .default("basic")
    .describe("'basic' for quick results, 'advanced' for thorough search"),
});

// Tavily result type
interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

/**
 * Web Search Tool - Tavily API
 */
const tavilyTool = tool(
  // Execute function FIRST (LangChain-style)
  async ({ query, maxResults = 5, searchDepth = "basic" }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      log.warn("tools:tavily:noApiKey");
      return { error: "Configuration error", message: "TAVILY_API_KEY is not configured" };
    }

    try {
      log.debug({ query, maxResults, searchDepth }, "tools:tavily:search");

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          search_depth: searchDepth,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error({ status: response.status, error: errorText }, "tools:tavily:apiError");

        if (response.status === 429) {
          return { error: "Rate limited", message: "Tavily API rate limit exceeded. Try again later." };
        }
        if (response.status === 401 || response.status === 403) {
          return { error: "Authentication error", message: "Invalid Tavily API key" };
        }
        return { error: "Search failed", message: `Tavily API error: ${response.status}` };
      }

      const data = (await response.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string; snippet?: string; score?: number }>;
        answer?: string;
      };

      // Format results for LLM consumption
      const results: TavilyResult[] = (data.results || []).slice(0, maxResults).map((r) => ({
        title: r.title || "No title",
        url: r.url || "",
        content: r.content || r.snippet || "No content",
        score: r.score,
      }));

      log.debug({ resultCount: results.length, hasAnswer: !!data.answer }, "tools:tavily:success");

      return { query, answer: data.answer || null, results, resultCount: results.length };
    } catch (error) {
      log.error({ err: serializeError(error), query }, "tools:tavily:error");
      return { error: "Search failed", message: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  // Config SECOND (flat, minimal)
  {
    name: "web_search",
    displayName: "Web Search (Tavily)",
    description:
      "Search the web for current information. Use when you need up-to-date information, facts, or recent events.",
    category: "search",
    schema,
    apiKeyEnvVar: "TAVILY_API_KEY",
    usageExample: "Search for the latest news about electric vehicles",
    retry: {
      maxRetries: 2,
      initialDelayMs: 1000,
      backoffFactor: 2.0,
      retryOn: (error: Error) => {
        const msg = error.message.toLowerCase();
        return msg.includes("timeout") || msg.includes("network") || msg.includes("rate limit") || msg.includes("429");
      },
    },
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs search results to respond",
    },
  }
);

// Named exports
export const tavilySearchTool = tavilyTool;
export const tavilySearchMetadata = { name: "web_search", displayName: "Web Search (Tavily)" };
export default tavilyTool;
