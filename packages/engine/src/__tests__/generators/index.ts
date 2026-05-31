/**
 * Journey Generators for Fuzzy Testing
 *
 * Exports node and journey generators for property-based testing.
 *
 * @module engine/tests/generators
 */

// Node generators
export {
  // Random utilities
  SeededRandom,
  setGeneratorSeed,
  getRandom,
  createMetadata,
  generateNodeId,
  generateEdgeId,
  randomPosition,
  // Content generators
  randomContent,
  generateRealisticContent,
  randomButtons,
  generateRealisticButtons,
  randomLabel,
  // Action generators
  generateTagAction,
  generateVariableAction,
  generateMedia,
  // Node generators
  generateStartNode,
  generateEndNode,
  generateMessageNode,
  generateConditionNode,
  generateWaitNode,
  generateWebhookNode,
  generateCrmNode,
  generateTeleportNode,
  generateEdge,
  generateRandomNode,
  // Types
  type StartNodeOptions,
  type EndNodeOptions,
  type MessageNodeOptions,
  type ConditionNodeOptions,
  type WebhookNodeOptions,
  type CrmNodeOptions,
  type TeleportNodeOptions,
  type EdgeOptions,
} from "./node-generators";

// Journey generators
export {
  generateValidJourney,
  generateLinearJourney,
  generateBranchingJourney,
  generateInvalidJourney,
  generateEdgeCaseJourney,
  generateRandomJourneys,
  generateMixedJourneys,
  type GeneratorOptions,
  type InvalidationType,
  type EdgeCaseType,
} from "./journey-generator";
