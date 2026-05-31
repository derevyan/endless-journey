import type { JourneyConfig } from "@journey/schemas";
import type { TestVariation, VariationResult, VariationRunnerOptions } from "../types";

export interface BackendInitParams {
  journey: JourneyConfig;
  runnerOptions: VariationRunnerOptions;
  journeyPath?: string;
}

export interface TestExecutionBackend {
  name: string;
  supportsWorkers: boolean;
  initialize(params: BackendInitParams): Promise<void> | void;
  runSingle(variation: TestVariation): Promise<VariationResult>;
  setTimeScale?(scale: number): void;
  teardown(): Promise<void> | void;
}
