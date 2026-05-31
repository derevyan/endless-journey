/**
 * Current Time Tool
 *
 * Simple utility tool to get the current date and time.
 * Useful for time-aware agent responses.
 *
 * @module tools/embedded/current-time.tool
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { tool } from "../tool";

const log = createLogger("llm:tools:time");

// Schema for tool input validation
const schema = z.object({
  timezone: z
    .string()
    .optional()
    .describe("IANA timezone (e.g., 'America/New_York', 'Europe/London'). Defaults to server timezone if not provided."),
  format: z
    .enum(["full", "date", "time", "iso"])
    .optional()
    .default("full")
    .describe("Output format: 'full' (default), 'date', 'time', or 'iso'"),
});

/**
 * Get timezone offset string (e.g., "+05:30", "-08:00")
 */
function getTimezoneOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? "+" : "-";
  return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Current Time Tool
 */
const currentTimeTool = tool(
  // Execute function FIRST (LangChain-style)
  async ({ timezone, format = "full" }) => {
    try {
      const now = new Date();

      // Determine locale options based on timezone
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      };

      // Create formatter
      let formatter: Intl.DateTimeFormat;
      try {
        formatter = new Intl.DateTimeFormat("en-US", options);
      } catch {
        log.warn({ timezone }, "tools:time:invalidTimezone");
        return {
          error: "Invalid timezone",
          message: `'${timezone}' is not a valid timezone. Use names like 'America/New_York', 'Europe/London'.`,
        };
      }

      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

      const result: Record<string, unknown> = {
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: timezone ? undefined : getTimezoneOffset(now),
      };

      switch (format) {
        case "iso":
          result.iso = now.toISOString();
          result.timestamp = now.getTime();
          break;

        case "date":
          result.date = `${getPart("year")}-${(parts.findIndex((p) => p.type === "month") + 1).toString().padStart(2, "0")}-${getPart("day").padStart(2, "0")}`;
          result.formatted = `${getPart("weekday")}, ${getPart("month")} ${getPart("day")}, ${getPart("year")}`;
          result.dayOfWeek = getPart("weekday");
          result.day = parseInt(getPart("day"));
          result.month = getPart("month");
          result.year = parseInt(getPart("year"));
          break;

        case "time":
          result.time = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
          result.hour = parseInt(getPart("hour"));
          result.minute = parseInt(getPart("minute"));
          result.second = parseInt(getPart("second"));
          break;

        case "full":
        default:
          result.iso = now.toISOString();
          result.formatted = `${getPart("weekday")}, ${getPart("month")} ${getPart("day")}, ${getPart("year")} at ${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
          result.date = `${getPart("year")}-${(parts.findIndex((p) => p.type === "month") + 1).toString().padStart(2, "0")}-${getPart("day").padStart(2, "0")}`;
          result.time = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
          result.dayOfWeek = getPart("weekday");
          result.timestamp = now.getTime();
          break;
      }

      log.debug({ timezone: result.timezone, format }, "tools:time:success");
      return result;
    } catch (error) {
      log.error({ err: serializeError(error), timezone, format }, "tools:time:error");
      return { error: "Time lookup failed", message: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  // Config SECOND (flat, minimal)
  {
    name: "current_time",
    displayName: "Current Time",
    description:
      "Get the current date and time. Use when you need to know the current time, date, day of week, or provide time-aware responses.",
    category: "utility",
    schema,
    usageExample: "What time is it in New York right now?",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs current time to respond",
    },
  }
);

// Named exports
export const currentTimeToolImpl = currentTimeTool;
export const currentTimeMetadata = { name: "current_time", displayName: "Current Time" };
export { currentTimeToolImpl as currentTimeTool };
export default currentTimeTool;
