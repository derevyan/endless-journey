import type { JourneyConfig } from "@journey/schemas";
import type { TestVariation, VariationResult, VariationRunnerOptions } from "../types";
import { VariationRunner } from "../variation-runner";
import type { BackendInitParams, TestExecutionBackend } from "./types";

export class EngineBackend implements TestExecutionBackend {
  name = "engine";
  supportsWorkers = true;

  private journey?: JourneyConfig;
  private runnerOptions?: VariationRunnerOptions;
  private runner?: VariationRunner;

  initialize(params: BackendInitParams): void {
    this.journey = params.journey;
    this.runnerOptions = params.runnerOptions;
  }

  async runSingle(variation: TestVariation): Promise<VariationResult> {
    if (!this.runner) {
      if (!this.journey || !this.runnerOptions) {
        throw new Error("Engine backend not initialized");
      }
      this.runner = new VariationRunner(this.journey, this.runnerOptions);
    }

    return this.runner.runSingle(variation);
  }

  setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }
    if (this.runnerOptions) {
      this.runnerOptions.timeScale = scale;
    }
    this.runner?.setTimeScale(scale);
  }

  teardown(): void {
    this.runner = undefined;
  }
}
