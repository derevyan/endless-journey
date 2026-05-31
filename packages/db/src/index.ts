// Schema exports
export * from "./schema";

// Client exports
export {
  db,
  queryClient,
  withQueryLogging,
  checkDatabaseHealth,
  closeDatabaseConnection,
  // Pool monitoring
  poolConfig,
  getPoolStats,
  startPoolMonitoring,
  type PoolStats,
} from "./client";

export type DbClient = typeof import("./client").db;

// Utility exports (encryption, transaction helpers, etc.)
export { encrypt, decrypt, isEncrypted, safeEncrypt, hashSecret, withTransaction, type TransactionClient } from "./utils";

// Service exports (shared business logic)
export { loadPromptContent, loadPromptWithType, type LoadedPrompt } from "./services";
