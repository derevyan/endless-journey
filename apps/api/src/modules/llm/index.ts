/**
 * LLM Module
 *
 * Unified API for LLM-related functionality:
 * - Model registry (public - no auth required)
 * - Agent tools discovery (protected - workflow:read)
 * - Audio STT/TTS (protected - settings:read)
 *
 * @module modules/llm
 */

export { llm } from "./routes";
