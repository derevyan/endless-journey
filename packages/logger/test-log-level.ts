// Test script to verify logger reads LOG_LEVEL correctly
// Note: Set LOG_LEVEL environment variable before running: LOG_LEVEL=debug tsx test-log-level.ts
import { createLogger, logger } from "./src/index";

const log = createLogger("test");

console.error("=== Logger Level Test ===");
console.error("process.env.LOG_LEVEL:", process.env.LOG_LEVEL);
console.error("process.env.NODE_ENV:", process.env.NODE_ENV);
console.error("Base logger level:", logger.level);
console.error("Base logger levelVal:", logger.levelVal);

// Test all log levels
console.error("\n--- Testing all log levels ---");
log.trace("This is a TRACE message");
log.debug("This is a DEBUG message");
log.info("This is an INFO message");
log.warn("This is a WARN message");
log.error("This is an ERROR message");
log.fatal("This is a FATAL message");

console.error("\n--- Test complete ---");

