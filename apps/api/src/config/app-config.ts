/**
 * API App Configuration
 *
 * Centralized environment parsing for the API server.
 *
 * @module config/app-config
 */

type NodeEnvironment = "development" | "production" | "test";

const parseNodeEnv = (value: string | undefined): NodeEnvironment => {
  if (value === "production" || value === "test") return value;
  return "development";
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return value === "true";
};

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
const isTest = nodeEnv === "test";
const isProduction = nodeEnv === "production";
const isDevelopment = !isProduction;

export type AppConfig = {
  env: {
    nodeEnv: NodeEnvironment;
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
  };
  server: {
    port: number;
  };
  frontend: {
    url: string;
  };
  auth: {
    secret?: string;
    allowMockAuth: boolean;
    useSecureCookies: boolean;
  };
  redis: {
    url: string;
  };
  storage: {
    minio: {
      endpoint: string;
      accessKey: string;
      secretKey: string;
      bucket: string;
    };
  };
  rateLimits: {
    events: {
      maxTokens: number;
      refillRate: number;
      refillInterval: number;
    };
    sseConnections: {
      maxTokens: number;
      refillRate: number;
      refillInterval: number;
    };
    http: {
      global: number;
      auth: number;
      webhook: number;
    };
  };
  /**
   * Data retention settings per table.
   * 0 = forever (no retention, skip during job)
   * Positive number = days to keep data
   */
  retention: {
    events: number;
    interactions: number;
    sentMessages: number;
    conversations: number;
    llmUsageEvents: number;
    mindstateAnalysisLog: number;
    failedEvents: number;
    crmStageHistory: number;
  };
  mcp: {
    serviceUrl: string;
    serviceTimeoutMs: number;
  };
  urls: {
    apiBaseUrl?: string;
    webhookBaseUrl?: string;
  };
  features: {};
};

export const appConfig: AppConfig = {
  env: {
    nodeEnv,
    isDevelopment,
    isProduction,
    isTest,
  },
  server: {
    port: parseNumber(process.env.PORT, 3001),
  },
  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:3000",
  },
  auth: {
    secret: process.env.BETTER_AUTH_SECRET,
    allowMockAuth: parseBoolean(process.env.ALLOW_MOCK_AUTH),
    useSecureCookies: !isTest && !isDevelopment,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  storage: {
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
      bucket: process.env.MINIO_BUCKET || "journey-media",
    },
  },
  rateLimits: {
    events: {
      maxTokens: parseNumber(process.env.RATE_LIMIT_EVENTS_MAX_TOKENS, 1000),
      refillRate: parseNumber(process.env.RATE_LIMIT_EVENTS_REFILL_RATE, 1000),
      refillInterval: parseNumber(process.env.RATE_LIMIT_EVENTS_INTERVAL, 60),
    },
    sseConnections: {
      maxTokens: parseNumber(process.env.RATE_LIMIT_SSE_MAX_CONNECTIONS, 10),
      refillRate: 1,
      refillInterval: 60,
    },
    http: {
      global: parseNumber(process.env.RATE_LIMIT_GLOBAL, 100),
      auth: parseNumber(process.env.RATE_LIMIT_AUTH, 10),
      webhook: parseNumber(process.env.RATE_LIMIT_WEBHOOK, 200),
    },
  },
  // Data retention: 0 = forever (no retention), positive = days to keep
  retention: {
    events: parseNumber(process.env.EVENT_RETENTION_DAYS, 90),
    interactions: parseNumber(process.env.INTERACTIONS_RETENTION_DAYS, 0),
    sentMessages: parseNumber(process.env.SENT_MESSAGES_RETENTION_DAYS, 0),
    conversations: parseNumber(process.env.CONVERSATIONS_RETENTION_DAYS, 0),
    llmUsageEvents: parseNumber(process.env.LLM_USAGE_RETENTION_DAYS, 0),
    mindstateAnalysisLog: parseNumber(process.env.MINDSTATE_LOG_RETENTION_DAYS, 0),
    failedEvents: parseNumber(process.env.FAILED_EVENTS_RETENTION_DAYS, 30),
    crmStageHistory: parseNumber(process.env.CRM_STAGE_HISTORY_RETENTION_DAYS, 365),
  },
  mcp: {
    serviceUrl: process.env.MCP_SERVICE_URL || "http://localhost:3002",
    serviceTimeoutMs: parseNumber(process.env.MCP_SERVICE_TIMEOUT, 30000),
  },
  urls: {
    apiBaseUrl: process.env.API_URL,
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
  },
  features: {},
};
