/**
 * Default prompts for Question Understanding Engine
 *
 * These prompts are adapted from the Python reference implementation.
 * The worker prompt synthesizes unanswered questions in the same language as the input.
 * The evaluator prompt selects the best worker output.
 */

import { z } from "zod";

// =============================================================================
// WORKER PROMPT (question_synthesis_prompt)
// =============================================================================

/**
 * Default system prompt for worker LLMs
 * Analyzes conversation history and identifies unanswered questions,
 * rephrasing them in the same language as the input as a single coherent sentence.
 */
export const DEFAULT_WORKER_SYSTEM_PROMPT = `You are tasked with analyzing a conversation history and identifying any unanswered questions from the user. Your goal is to rephrase these questions in the same language as the input conversation, combining them into a single, coherent sentence.

First, carefully review the entire conversation history provided. Pay attention to the flow of the conversation and identify any questions posed by the user that have not been answered.

**Language Detection:** Determine the language used in the conversation history and user question. Your output must be in the exact same language as the input. If the conversation is in English, output in English. If it's in Russian, output in Russian. If it's in Spanish, output in Spanish, and so on. Match the input language precisely.

For each unanswered question you find:
1. Rephrase it in the same language as the input conversation
2. Use first-person perspective
3. Maintain a natural, conversational tone
4. Preserve the original meaning and intent
5. Select only unanswered questions

If there are multiple unanswered questions, combine them into a single string using appropriate conjunctions or punctuation.
The result should flow naturally and sound like a single person asking multiple related questions.

Your output should be a single sentence in the same language as the input that encapsulates all unanswered questions from the user's perspective.
Do not provide answers or additional commentary - focus solely on rephrasing the questions.
Use first-person perspective for final output.
Skip already answered questions and focus only on the unanswered ones.

Examples:

1. If the conversation history contains:
   Message 1:(HUMAN): How much does the course cost?
   Message 2:(HUMAN): Who are your trainers?
   Message 3:(HUMAN): Payment methods
   Your output might be: "How much does your course cost, who teaches in your program, and what payment methods do you offer?"

2. If the conversation history contains:
   Message 1:(HUMAN): Do you have a program for beginners?
   Message 2:(AI): Yes, we have several programs for beginners.
   Message 3:(HUMAN): What about for advanced learners?
   Message 4:(HUMAN): How long does the course last?
   Your output might be: "Do you have programs for advanced learners and how long does the course last?"`;

// =============================================================================
// EVALUATOR PROMPT (question_evaluator_prompt)
// =============================================================================

/**
 * Default system prompt for evaluator LLM
 * Selects the best worker output based on quality criteria.
 */
export const DEFAULT_EVALUATOR_SYSTEM_PROMPT = `You are an expert evaluator. Your task is to analyze the following outputs from multiple workers, along with their reasoning. Your goal is to select the best output based on the quality of the reasoning, the majority agreement among workers, the similarity of their responses, the relevance to the conversation history, and language consistency.

### Instructions:
1. **Review All Outputs:** Carefully read all the outputs provided by the workers along with their reasoning. Make sure to understand the context from the conversation history and the last user message.

2. **Check Majority Agreement:** Identify if there is a majority opinion among the workers. An output that is supported by the majority should be strongly considered, especially if the reasoning is sound.

3. **Evaluate Similarity:** Look for similarities in the responses. If several workers provide similar answers, this may indicate a correct or widely accepted answer.

4. **Consider Reasoning Quality:** Assess the quality of the reasoning behind each answer. Good reasoning should be logical, clear, and directly related to the question and conversation history.

5. **Use Conversation History:** Ensure that the selected output is relevant to the conversation history and addresses the user's needs effectively.

6. **Language Consistency:** Verify that the selected output is in the same language as the input conversation. The output language must match the language used in the conversation history and user question. If the input is in English, the output should be in English. If the input is in another language, the output must be in that same language.

7. **Make a Decision:** Based on the criteria above (majority agreement, similarity, reasoning quality, relevance to the history, and language consistency), choose the best output.

8. **First-person perspective:** The final output should be in the first-person perspective, reflecting the user's point of view.

### Your Response:
- **Best Output:** [Select the most appropriate output based on the above criteria.]
- **Explanation:** [Provide a clear explanation of why this output was chosen, considering majority opinion, reasoning quality, similarity, relevance to the conversation history, and language consistency.]`;

// =============================================================================
// STRUCTURED OUTPUT SCHEMAS
// =============================================================================

/**
 * Schema for worker LLM structured output
 */
export const WORKER_OUTPUT_SCHEMA = z.object({
  answer: z.string().describe("The synthesized question(s) in the same language as the input, in first-person perspective"),
  reasoning: z.string().describe("Brief explanation of which questions were identified as unanswered and why"),
  confidence: z.number().min(0).max(1).describe("Confidence score from 0 to 1 based on clarity of unanswered questions"),
});

export type WorkerOutput = z.infer<typeof WORKER_OUTPUT_SCHEMA>;

/**
 * Schema for evaluator LLM structured output
 */
export const EVALUATOR_OUTPUT_SCHEMA = z.object({
  selectedWorkerId: z.string().describe("ID of the worker with the best answer"),
  selectedAnswer: z.string().describe("The selected best answer (copy exactly from worker output)"),
  evaluationReasoning: z.string().describe("Explanation of why this answer was selected based on majority agreement, similarity, reasoning quality, and relevance"),
  rankings: z.array(z.object({
    workerId: z.string(),
    rank: z.number().int().min(1),
    score: z.number().min(0).max(1),
  })).describe("Ranking of all workers from best to worst with scores"),
});

export type EvaluatorOutput = z.infer<typeof EVALUATOR_OUTPUT_SCHEMA>;

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

/**
 * Build the user content for a worker LLM
 */
export function buildWorkerUserContent(
  question: string,
  conversationHistory?: string
): string {
  if (conversationHistory) {
    return `Here is the conversation history to analyze:
${conversationHistory}
${question}`;
  }
  return question;
}

/**
 * Build the user content for the evaluator LLM
 */
export function buildEvaluatorUserContent(
  question: string,
  workerAnswers: Array<{ workerId: string; model: string; answer: string; reasoning?: string }>,
  conversationHistory?: string
): string {
  const answersBlock = workerAnswers
    .map((wa) => `Worker ${wa.workerId} (${wa.model}):\nAnswer: ${wa.answer}\nReasoning: ${wa.reasoning || "N/A"}`)
    .join("\n\n---\n\n");

  let content = `### Context:
You will be provided with the conversation history to understand the context.

### Input Provided to Workers:
<conversation_history>
${conversationHistory || "(No conversation history provided)"}
</conversation_history>

### Worker Outputs:
Below are the responses provided by different workers, including their reasoning. Review each response carefully.

<worker_outputs>
${answersBlock}
</worker_outputs>

Please evaluate these answers and select the best one for the original question: "${question}"`;

  return content;
}
