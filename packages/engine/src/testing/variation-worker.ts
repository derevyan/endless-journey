import { parentPort, workerData } from "node:worker_threads";
import type { JourneyConfig } from "@journey/schemas";
import type { TestVariation, VariationResult, VariationRunnerOptions } from "./types";
import { VariationRunner } from "./variation-runner";

interface WorkerInit {
  journey: JourneyConfig;
  options: VariationRunnerOptions;
}

interface RunMessage {
  type: "run";
  id: number;
  variation: TestVariation;
}

const init = workerData as WorkerInit;
const runner = new VariationRunner(init.journey, init.options);

parentPort?.on("message", async (message: RunMessage) => {
  if (message.type !== "run") return;
  try {
    const result = await runner.runSingle(message.variation);
    parentPort?.postMessage({ type: "result", id: message.id, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const fallback: VariationResult = {
      variation: message.variation,
      success: false,
      status: "failed",
      error: errorMessage,
      stack,
      visitedNodes: [],
      messagesSent: [],
      steps: [],
      durationMs: 0,
      finalStatus: "failed",
    };
    parentPort?.postMessage({ type: "error", id: message.id, error: errorMessage, stack, result: fallback });
  }
});
