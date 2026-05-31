import pino, { type Level, type Logger } from "pino";

// Declare window for Node.js compatibility (window is undefined in Node)
declare const window: { document?: unknown } | undefined;

export type LogLevel = Level;
export interface SerializedError {
  name?: string;
  message: string;
  stack?: string | undefined;
  cause?: SerializedError | unknown;
}

const appName = "journey";
const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

/**
 * Lazily read log configuration from environment variables.
 * This function is called when the logger is first needed, ensuring dotenv
 * has already loaded the .env file (ESM import hoisting means module-level
 * code runs before dotenv, but function calls happen after).
 */
function getLogConfig() {
  const processEnv = (
    typeof process !== "undefined" && process.env
      ? process.env
      : typeof globalThis !== "undefined"
      ? (globalThis as Record<string, any>).process?.env
      : undefined
  ) as Record<string, string | undefined> | undefined;

  const importMetaEnv = typeof import.meta !== "undefined" ? (import.meta as unknown as { env?: Record<string, string> }).env : undefined;

  // LOG_LEVEL is the single source of truth for logging settings
  // Check process.env.LOG_LEVEL (Node.js) or import.meta.env.VITE_LOG_LEVEL (Vite browser)
  const envLevel = processEnv?.LOG_LEVEL || importMetaEnv?.VITE_LOG_LEVEL;
  const defaultLevel = "info";
  // Normalize level to lowercase and trim whitespace (pino expects lowercase)
  const normalizedLevel = envLevel ? envLevel.trim().toLowerCase() : defaultLevel;

  return {
    level: normalizedLevel as Level,
    isSilent: normalizedLevel === "silent",
  };
}

// Cached logger instance - created on first use
let _baseLogger: Logger | null = null;

/**
 * Get or create the base pino logger.
 * Uses lazy initialization to ensure environment variables are loaded first.
 */
function getBaseLogger(): Logger {
  if (_baseLogger) return _baseLogger;

  const config = getLogConfig();

  if (isBrowser) {
    _baseLogger = pino({
      level: config.level,
      browser: { asObject: true },
    });
  } else if (config.isSilent) {
    // Skip file transport in silent mode (tests) to prevent hanging
    _baseLogger = pino({
      level: "silent",
      name: appName,
    });
  } else {
    // Node.js configuration with pino-pretty, file rotation, and error-only logs
    const transport = pino.transport({
      targets: [
        // 1. Console output with pretty formatting
        {
          target: "pino-pretty",
          options: {
            colorize: true,
            // pino-pretty uses minimumLevel to filter logs at the transport level
            // Must be set to the same level as the pino logger
            minimumLevel: config.level,
          },
          // Each target in pino.transport can have its own level filter
          level: config.level,
        },
        // 2. Main log with daily rotation (1-day retention)
        {
          target: "pino-roll",
          options: {
            file: "./logs/journey",
            frequency: "daily",
            dateFormat: "yyyy-MM-dd",
            mkdir: true,
            retention: {
              count: 1,
            },
          },
          level: config.level,
        },
        // 3. Error-only log with daily rotation (1-day retention)
        {
          target: "pino-roll",
          options: {
            file: "./logs/journey-error",
            frequency: "daily",
            dateFormat: "yyyy-MM-dd",
            mkdir: true,
            retention: {
              count: 1,
            },
          },
          level: "error", // Only error (50) and fatal (60) levels
        },
      ],
    });

    _baseLogger = pino(
      {
        level: config.level,
        name: appName,
      },
      transport
    );
  }

  return _baseLogger;
}

export function createLogger(scope: string, extras: Record<string, unknown> = {}) {
  const child = getBaseLogger().child({ scope, ...extras });

  const logAt = (method: "debug" | "info" | "warn" | "error" | "fatal" | "trace") => (payload?: Record<string, unknown> | string, message?: string) => {
    if (typeof payload === "string") {
      child[method](payload);
    } else if (payload) {
      child[method](payload, message);
    } else {
      child[method](message || "");
    }
  };

  return {
    trace: logAt("trace"),
    debug: logAt("debug"),
    info: logAt("info"),
    warn: logAt("warn"),
    error: logAt("error"),
    fatal: logAt("fatal"),
    child: (childExtras: Record<string, unknown>) => createLogger(scope, { ...extras, ...childExtras }),
  };
}

/**
 * Direct pino logger export with lazy initialization.
 * Uses a Proxy to defer logger creation until first property access,
 * ensuring environment variables are loaded first.
 */
export const logger: Logger = new Proxy({} as Logger, {
  get(_, prop) {
    const baseLogger = getBaseLogger();
    return baseLogger[prop as keyof Logger];
  },
});

export function serializeError(err: unknown): SerializedError | null {
  if (!err) return null;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause instanceof Error ? serializeError(err.cause) : err.cause,
    };
  }
  return { message: String(err) };
}
