/**
 * Question Understanding Service Tests
 *
 * Tests the map-reduce pattern for synthesizing unanswered questions.
 * Mocks the LLM service to test the core orchestration logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { QuestionUnderstandingConfig } from "@journey/schemas";

// Mock the llm-service module
vi.mock("../../llm-service", () => ({
  generateStructuredOutput: vi.fn(),
}));

// Import after mocks
import { executeQuestionUnderstanding } from "../question-understanding-service";
import { generateStructuredOutput } from "../../llm-service";

const mockGenerateStructuredOutput = vi.mocked(generateStructuredOutput);

describe("Question Understanding Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create minimal valid config
  function createConfig(overrides: Partial<QuestionUnderstandingConfig> = {}): QuestionUnderstandingConfig {
    return {
      workers: [
        { id: "w1", model: "gpt-5-mini", provider: "openai" },
        { id: "w2", model: "claude-haiku-4-5", provider: "anthropic" },
      ],
      workersTemperature: 0.1,
      workerTimeoutMs: 6000,
      maxWorkersThreads: 6,
      evaluator: {
        model: "claude-haiku-4-5",
        temperature: 0.1,
        timeoutMs: 30000,
        backupModels: ["gemini-2.5-pro"],
      },
      fallback: {
        enabled: true,
        strategy: "first_worker",
      },
      requireAllWorkers: false,
      includeReasoningInOutput: true,
      ...overrides,
    };
  }

  // Helper to create mock worker response
  function createWorkerResponse(answer: string, confidence = 0.9) {
    return {
      result: {
        answer,
        reasoning: "Test reasoning",
        confidence,
      },
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    };
  }

  // Helper to create mock evaluator response
  function createEvaluatorResponse(selectedWorkerId: string, selectedAnswer: string) {
    return {
      result: {
        selectedWorkerId,
        selectedAnswer,
        evaluationReasoning: "Selected based on quality",
        rankings: [
          { workerId: selectedWorkerId, rank: 1, score: 0.95 },
        ],
      },
      usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
    };
  }

  describe("Parallel Worker Execution (Map Phase)", () => {
    it("should execute all workers in parallel", async () => {
      const config = createConfig();

      // Mock worker responses
      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Какой у вас курс?")) // w1
        .mockResolvedValueOnce(createWorkerResponse("Сколько стоит курс?")) // w2
        .mockResolvedValueOnce(createEvaluatorResponse("w1", "Какой у вас курс?")); // evaluator

      const result = await executeQuestionUnderstanding(
        "What courses do you offer?",
        config
      );

      // Should have called workers and evaluator
      expect(mockGenerateStructuredOutput).toHaveBeenCalledTimes(3);
      expect(result.workerAnswers).toHaveLength(2);
      expect(result.selectedWorkerId).toBe("w1");
      expect(result.selectedAnswer).toBe("Какой у вас курс?");
    });

    it("should continue with remaining workers when some fail", async () => {
      const config = createConfig({ requireAllWorkers: false });

      // First worker fails, second succeeds
      mockGenerateStructuredOutput
        .mockRejectedValueOnce(new Error("Worker 1 timeout"))
        .mockResolvedValueOnce(createWorkerResponse("Какие курсы предлагаете?"));

      const result = await executeQuestionUnderstanding(
        "What courses?",
        config
      );

      // Should have one successful worker answer
      expect(result.workerAnswers).toHaveLength(1);
      expect(result.workerAnswers[0].workerId).toBe("w2");
      expect(result.selectedAnswer).toBe("Какие курсы предлагаете?");
    });

    it("should throw when all workers fail", async () => {
      const config = createConfig();

      mockGenerateStructuredOutput
        .mockRejectedValueOnce(new Error("Worker 1 failed"))
        .mockRejectedValueOnce(new Error("Worker 2 failed"));

      await expect(
        executeQuestionUnderstanding("What courses?", config)
      ).rejects.toThrow("All workers failed");
    });

    it("should fail when requireAllWorkers=true and some fail", async () => {
      const config = createConfig({ requireAllWorkers: true });

      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Какой курс?"))
        .mockRejectedValueOnce(new Error("Worker 2 failed"));

      await expect(
        executeQuestionUnderstanding("What courses?", config)
      ).rejects.toThrow("Not all workers completed");
    });
  });

  describe("Single Worker Skip Evaluation", () => {
    it("should skip evaluator when only one worker succeeds", async () => {
      const config = createConfig({
        workers: [{ id: "w1", model: "gpt-5-mini", provider: "openai" }],
      });

      mockGenerateStructuredOutput.mockResolvedValueOnce(
        createWorkerResponse("Единственный ответ")
      );

      const result = await executeQuestionUnderstanding(
        "Single question",
        config
      );

      // Should only call the worker, not the evaluator
      expect(mockGenerateStructuredOutput).toHaveBeenCalledTimes(1);
      expect(result.selectedWorkerId).toBe("w1");
      expect(result.selectedAnswer).toBe("Единственный ответ");
      expect(result.evaluation).toBeUndefined();
    });
  });

  describe("Evaluator Fallback Strategies", () => {
    it("should apply first_worker fallback when evaluator fails", async () => {
      const config = createConfig({
        fallback: { enabled: true, strategy: "first_worker" },
      });

      // Workers succeed, evaluator fails
      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Первый ответ"))
        .mockResolvedValueOnce(createWorkerResponse("Второй ответ"))
        .mockRejectedValueOnce(new Error("Evaluator failed"))
        .mockRejectedValueOnce(new Error("Backup evaluator also failed"));

      const result = await executeQuestionUnderstanding("Test", config);

      expect(result.selectedWorkerId).toBe("w1");
      expect(result.selectedAnswer).toBe("Первый ответ");
    });

    it("should apply longest_answer fallback when evaluator fails", async () => {
      const config = createConfig({
        fallback: { enabled: true, strategy: "longest_answer" },
      });

      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Короткий"))
        .mockResolvedValueOnce(createWorkerResponse("Это очень длинный и подробный ответ"))
        .mockRejectedValueOnce(new Error("Evaluator failed"))
        .mockRejectedValueOnce(new Error("Backup also failed"));

      const result = await executeQuestionUnderstanding("Test", config);

      expect(result.selectedWorkerId).toBe("w2");
      expect(result.selectedAnswer).toBe("Это очень длинный и подробный ответ");
    });

    it("should throw when evaluator fails and fallback is disabled", async () => {
      const config = createConfig({
        fallback: { enabled: false, strategy: "first_worker" },
      });

      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Answer 1"))
        .mockResolvedValueOnce(createWorkerResponse("Answer 2"))
        .mockRejectedValueOnce(new Error("Evaluator failed"))
        .mockRejectedValueOnce(new Error("Backup also failed"));

      await expect(
        executeQuestionUnderstanding("Test", config)
      ).rejects.toThrow("Evaluator failed and fallback is disabled");
    });
  });

  describe("Evaluator with Backup Models", () => {
    it("should try backup models when primary evaluator fails", async () => {
      const config = createConfig({
        evaluator: {
          model: "primary-model",
          temperature: 0.1,
          timeoutMs: 30000,
          backupModels: ["backup-1", "backup-2"],
        },
      });

      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Worker answer 1"))
        .mockResolvedValueOnce(createWorkerResponse("Worker answer 2"))
        .mockRejectedValueOnce(new Error("Primary evaluator failed"))
        .mockResolvedValueOnce(createEvaluatorResponse("w2", "Worker answer 2")); // backup-1 succeeds

      const result = await executeQuestionUnderstanding("Test", config);

      // Should have called: 2 workers + primary evaluator (failed) + backup-1 (succeeded)
      expect(mockGenerateStructuredOutput).toHaveBeenCalledTimes(4);
      expect(result.selectedWorkerId).toBe("w2");
    });
  });

  describe("Result Structure", () => {
    it("should include all metadata in result", async () => {
      const config = createConfig({ includeReasoningInOutput: true });

      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Answer 1", 0.85))
        .mockResolvedValueOnce(createWorkerResponse("Answer 2", 0.9))
        .mockResolvedValueOnce(createEvaluatorResponse("w2", "Answer 2"));

      const result = await executeQuestionUnderstanding(
        "Original question",
        config
      );

      expect(result.question).toBe("Original question");
      expect(result.selectedAnswer).toBe("Answer 2");
      expect(result.selectedWorkerId).toBe("w2");
      expect(result.workerAnswers).toHaveLength(2);
      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0); // Can be 0 with mocked instant responses
      expect(result.evaluation).toBeDefined();
      expect(result.evaluation?.evaluationReasoning).toBe("Selected based on quality");
    });

    it("should exclude evaluation reasoning when includeReasoningInOutput=false", async () => {
      const config = createConfig({ includeReasoningInOutput: false });

      mockGenerateStructuredOutput
        .mockResolvedValueOnce(createWorkerResponse("Answer 1"))
        .mockResolvedValueOnce(createWorkerResponse("Answer 2"))
        .mockResolvedValueOnce(createEvaluatorResponse("w1", "Answer 1"));

      const result = await executeQuestionUnderstanding("Test", config);

      expect(result.evaluation).toBeUndefined();
    });
  });

  describe("Context Handling", () => {
    it("should pass conversation history to workers", async () => {
      const config = createConfig({
        workers: [{ id: "w1", model: "test-model", provider: "openai" }],
      });

      mockGenerateStructuredOutput.mockResolvedValueOnce(
        createWorkerResponse("Synthesized question")
      );

      await executeQuestionUnderstanding(
        "Current question",
        config,
        { conversationHistory: "User: Hello\nAI: Hi there!" }
      );

      // Check that conversation history was included in the call
      const callArgs = mockGenerateStructuredOutput.mock.calls[0];
      expect(callArgs[1]).toContain("User: Hello");
      expect(callArgs[1]).toContain("AI: Hi there!");
    });
  });
});
