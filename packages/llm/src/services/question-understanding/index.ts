/**
 * Question Understanding Service
 *
 * Map-reduce pattern for synthesizing unanswered questions from conversation history.
 * Uses multiple worker LLMs in parallel with an evaluator to select the best synthesis.
 */

// Main service function
export { executeQuestionUnderstanding, type WorkerContext } from "./question-understanding-service";

// Prompts and schemas
export {
  DEFAULT_WORKER_SYSTEM_PROMPT,
  DEFAULT_EVALUATOR_SYSTEM_PROMPT,
  WORKER_OUTPUT_SCHEMA,
  EVALUATOR_OUTPUT_SCHEMA,
  buildWorkerUserContent,
  buildEvaluatorUserContent,
  type WorkerOutput,
  type EvaluatorOutput,
} from "./prompts";
