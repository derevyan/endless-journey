/**
 * Seed Data Constants
 *
 * All static seed data used across seed modules.
 *
 * @module seed/data
 */

import type { JourneyConfig, JourneyContent } from "@journey/schemas";
import { restoreJourneyFromExport } from "@journey/schemas";
import type {
  JourneyConfigData,
  PipelineStageData,
  PromptConfigData,
  TagDefinitionData,
  TestChannelUser,
  TestInteraction,
  TestSession,
  TestUser,
  UserOrgAssignment,
  VariableData,
  WorkflowConfigData,
} from "./types";
import { EDGE_STYLE_DEFAULTS } from "../../../../apps/web/src/features/nodes/journey/config/node-theme";

// Import journey structures (with $content: references)
import aiAgentMinimalStructure from "../../../../apps/web/src/data/journeys/ai-agent-minimal/journey.json";
import saasOnboardingStructure from "../../../../apps/web/src/data/journeys/saas-onboarding/journey.json";
import starterTemplateStructure from "../../../../apps/web/src/data/journeys/starter-template/journey.json";
import supportTriageStructure from "../../../../apps/web/src/data/journeys/support-triage/journey.json";
import voiceOnlyTestStructure from "../../../../apps/web/src/data/journeys/voice-only-test/journey.json";
import voiceToVoiceTestStructure from "../../../../apps/web/src/data/journeys/voice-to-voice-test/journey.json";
import questionnaireDemoStructure from "../../../../apps/web/src/data/journeys/questionnaire-demo/journey.json";
import e2eMediaTestStructure from "../../../../apps/web/src/data/journeys/e2e-media-test/journey.json";

// Import journey content files
import aiAgentMinimalContent from "../../../../apps/web/src/data/journeys/ai-agent-minimal/content.json";
import saasOnboardingContent from "../../../../apps/web/src/data/journeys/saas-onboarding/content.json";
import starterTemplateContent from "../../../../apps/web/src/data/journeys/starter-template/content.json";
import supportTriageContent from "../../../../apps/web/src/data/journeys/support-triage/content.json";
import voiceOnlyTestContent from "../../../../apps/web/src/data/journeys/voice-only-test/content.json";
import voiceToVoiceTestContent from "../../../../apps/web/src/data/journeys/voice-to-voice-test/content.json";
import questionnaireDemoContent from "../../../../apps/web/src/data/journeys/questionnaire-demo/content.json";
import e2eMediaTestContent from "../../../../apps/web/src/data/journeys/e2e-media-test/content.json";

// Import workflow configurations
import demoAssistantWorkflow from "../../../../apps/web/src/data/workflows/demo-assistant/workflow.json";
import questionUnderstandingWorkflow from "../../../../apps/web/src/data/workflows/question-understanding/workflow.json";
import multiAgentRouterWorkflow from "../../../../apps/web/src/data/workflows/multi-agent-router/workflow.json";
import comprehensiveSupportWorkflow from "../../../../apps/web/src/data/workflows/comprehensive-support/workflow.json";
import memoryAgentWorkflow from "../../../../apps/web/src/data/workflows/memory-agent/workflow.json";
import ifElseDemoWorkflow from "../../../../apps/web/src/data/workflows/if-else-demo/workflow.json";
import voiceTestAssistantWorkflow from "../../../../apps/web/src/data/workflows/voice-test-assistant/workflow.json";
import questionnaireDemoWorkflow from "../../../../apps/web/src/data/workflows/questionnaire-demo/workflow.json";

// Import prompt metadata files
import voiceDirectorV3Prompt from "../../../../apps/web/src/data/prompts/voice-director-v3/prompt.json";
import voiceDirectorV2Prompt from "../../../../apps/web/src/data/prompts/voice-director-v2/prompt.json";
import questionnaireDemoPrompt from "../../../../apps/web/src/data/prompts/questionnaire-demo/prompt.json";

/**
 * Extract JourneyConfig from imported JSON.
 * Handles both formats:
 * - Direct format: { nodes, edges } (JourneyConfig)
 * - Wrapped format: { name, description, configuration: { nodes, edges } }
 */
function extractJourneyConfig(data: unknown): JourneyConfig {
  const obj = data as Record<string, unknown>;
  // If it has 'configuration', extract from wrapper
  if ("configuration" in obj && obj.configuration) {
    return obj.configuration as JourneyConfig;
  }
  // Otherwise, assume direct format
  return data as JourneyConfig;
}

// Merge structure with content to create full journey configs
const aiAgentMinimalJourney = restoreJourneyFromExport(
  extractJourneyConfig(aiAgentMinimalStructure),
  aiAgentMinimalContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);
const saasOnboardingJourney = restoreJourneyFromExport(
  extractJourneyConfig(saasOnboardingStructure),
  saasOnboardingContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);
const starterTemplateJourney = restoreJourneyFromExport(
  extractJourneyConfig(starterTemplateStructure),
  starterTemplateContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);
const supportTriageJourney = restoreJourneyFromExport(
  extractJourneyConfig(supportTriageStructure),
  supportTriageContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);
const voiceOnlyTestJourney = restoreJourneyFromExport(
  extractJourneyConfig(voiceOnlyTestStructure),
  voiceOnlyTestContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);
const voiceToVoiceTestJourney = restoreJourneyFromExport(
  extractJourneyConfig(voiceToVoiceTestStructure),
  voiceToVoiceTestContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);
const questionnaireDemoJourney = restoreJourneyFromExport(
  extractJourneyConfig(questionnaireDemoStructure),
  questionnaireDemoContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);
const e2eMediaTestJourney = restoreJourneyFromExport(
  extractJourneyConfig(e2eMediaTestStructure),
  e2eMediaTestContent as JourneyContent,
  EDGE_STYLE_DEFAULTS
);

// =============================================================================
// JOURNEY CONFIGS
// =============================================================================

export const JOURNEY_CONFIGS: JourneyConfigData[] = [
  {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-ae1f2a3b4c5d",
    slug: "saas-onboarding",
    name: "SaaS Onboarding Demo",
    description: "Complete onboarding flow with CRM pipeline, buttons, timers, webhooks, and multiple end states",
    status: "active",
    configuration: saasOnboardingJourney as JourneyConfig,
  },
  {
    id: "b2c3d4e5-f6a7-4b8c-9d0e-8f2a3b4c5d6e",
    slug: "starter-template",
    name: "Starter Template",
    description: "Simple linear flow template: Start → Message → Timer → Message → End",
    status: "active",
    configuration: starterTemplateJourney as JourneyConfig,
  },
  {
    id: "e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b",
    slug: "support-triage",
    name: "Customer Support Triage",
    description: "Multi-branch support flow with category routing, ticket creation, and feedback collection",
    status: "active",
    configuration: supportTriageJourney as JourneyConfig,
  },
  {
    id: "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b9c",
    slug: "ai-agent-minimal",
    name: "AI Agent Minimal",
    description: "Minimal AI agent journey with embedded tools (time, Wikipedia, search)",
    status: "active",
    configuration: aiAgentMinimalJourney as JourneyConfig,
  },
  {
    id: "a7b8c9d0-e1f2-4a3b-9c4d-5e6f7a8b9c0d",
    slug: "voice-only-test",
    name: "Voice-Only Test",
    description: "Test journey with voice-only mode - agent always responds with audio (TTS)",
    status: "active",
    configuration: voiceOnlyTestJourney as JourneyConfig,
  },
  {
    id: "b8c9d0e1-f2a3-4b4c-9d5e-6f7a8b9c0d1e",
    slug: "voice-to-voice-test",
    name: "Voice-to-Voice Test",
    description: "Test journey with voice-to-voice mode - agent mirrors user input type",
    status: "active",
    configuration: voiceToVoiceTestJourney as JourneyConfig,
  },
  {
    id: "e5f6a7b8-c9d0-4e1f-9a2b-4c5d6e7f8a9b",
    slug: "questionnaire-demo",
    name: "Questionnaire Demo",
    description: "Demo journey with questionnaire agent and webhook export",
    status: "active",
    configuration: questionnaireDemoJourney as JourneyConfig,
  },
  {
    id: "f7a8b9c0-d1e2-4f3a-ab4c-5d6e7f8a9b0c",
    slug: "e2e-media-test",
    name: "E2E Media Test",
    description: "Minimal test journey for media upload e2e tests",
    status: "active",
    configuration: e2eMediaTestJourney as JourneyConfig,
  },
];

// =============================================================================
// USER DATA
// =============================================================================

/**
 * Test users to create automatically
 * These users will be created via Better Auth sign-up endpoint
 */
export const TEST_USERS: TestUser[] = [
  { email: "demo@journey.app", password: "demo1234", name: "Demo User" },
  { email: "arina@journey.app", password: "arina1234", name: "Arina" },
  { email: "default@journey.app", password: "default1234", name: "Default User" },
];

/**
 * User to organisation and journey assignments
 * Maps user email to their organisation and journey IDs
 */
export const USER_ORG_ASSIGNMENTS: Record<string, UserOrgAssignment> = {
  "demo@journey.app": {
    orgName: "Demo Workspace",
    journeyIds: [
      "a1b2c3d4-e5f6-4a7b-8c9d-ae1f2a3b4c5d", // SaaS Onboarding Demo
      "b2c3d4e5-f6a7-4b8c-9d0e-8f2a3b4c5d6e", // Starter Template
      "e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b", // Customer Support Triage
      "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b9c", // AI Agent Minimal
      "a7b8c9d0-e1f2-4a3b-9c4d-5e6f7a8b9c0d", // Voice-Only Test
      "b8c9d0e1-f2a3-4b4c-9d5e-6f7a8b9c0d1e", // Voice-to-Voice Test
      "e5f6a7b8-c9d0-4e1f-9a2b-4c5d6e7f8a9b", // Questionnaire Demo
      "f7a8b9c0-d1e2-4f3a-ab4c-5d6e7f8a9b0c", // E2E Media Test
    ],
  },
  "arina@journey.app": {
    orgName: "Arina's Workspace",
    journeyIds: [
      "a1b2c3d4-e5f6-4a7b-8c9d-ae1f2a3b4c5d", // SaaS Onboarding Demo
      "e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b", // Customer Support Triage
      "e5f6a7b8-c9d0-4e1f-9a2b-4c5d6e7f8a9b", // Questionnaire Demo
    ],
  },
  // Default user gets a workspace with demo journeys for development testing
  "default@journey.app": {
    orgName: "My Workspace",
    journeyIds: [
      "a1b2c3d4-e5f6-4a7b-8c9d-ae1f2a3b4c5d", // SaaS Onboarding Demo
      "b2c3d4e5-f6a7-4b8c-9d0e-8f2a3b4c5d6e", // Starter Template
      "e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b", // Customer Support Triage
      "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b9c", // AI Agent Minimal
    ],
  },
};

// =============================================================================
// TEST BOT
// =============================================================================

export const TEST_BOT_ID = "d4e5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f8a";

// Console tabs test session - used for State/Outputs tab testing in playback mode
export const CONSOLE_TABS_TEST_SESSION_ID = "00000000-0000-0000-5000-000000000001";

// =============================================================================
// VARIABLES
// =============================================================================

/**
 * Global variables - organization-wide data
 */
export const GLOBAL_VARIABLES: VariableData[] = [
  {
    key: "total_conversions",
    value: 42,
    description: "Total number of users who converted across all journeys",
  },
  {
    key: "loyalty_multiplier",
    value: 1.5,
    description: "Bonus multiplier for loyalty points calculation",
  },
  {
    key: "feature_flags",
    value: {
      new_onboarding: true,
      beta_analytics: false,
      premium_support: true,
    },
    description: "Feature flags for A/B testing and gradual rollouts",
  },
  {
    key: "promo_codes",
    value: ["WELCOME20", "SUMMER10", "VIP50"],
    description: "Active promotional codes",
  },
  {
    key: "badge_definitions",
    value: {
      early_adopter: { name: "Early Adopter", points: 100, icon: "🌟" },
      power_user: { name: "Power User", points: 500, icon: "⚡" },
      ambassador: { name: "Ambassador", points: 1000, icon: "🏆" },
    },
    description: "Badge definitions with point values",
  },
];

/**
 * Journey variables - specific to the SaaS Onboarding journey
 */
export const JOURNEY_VARIABLES: VariableData[] = [
  {
    key: "journey_starts",
    value: 127,
    description: "Number of users who started this journey",
  },
  {
    key: "plan_selections",
    value: {
      basic: 45,
      pro: 52,
      enterprise: 18,
    },
    description: "Count of plan selections by type",
  },
  {
    key: "avg_completion_time_hours",
    value: 48.5,
    description: "Average time to complete the journey in hours",
  },
  {
    key: "conversion_rate",
    value: 0.33,
    description: "Current conversion rate (converted / started)",
  },
  {
    key: "feedback_responses",
    value: ["Team collaboration", "Project management", "Analytics", "Security compliance", "Getting organized"],
    description: "Sample feedback responses from users",
  },
];

// =============================================================================
// TAG DEFINITIONS
// =============================================================================

/**
 * Global tag definitions - organization-wide available tags
 */
export const GLOBAL_TAG_DEFINITIONS: TagDefinitionData[] = [
  { tag: "VIP", description: "High-value customers with premium support", color: "purple-500" },
  { tag: "beta-tester", description: "Users participating in beta testing programs", color: "indigo-500" },
  { tag: "newsletter", description: "Subscribed to newsletter communications", color: "blue-500" },
  { tag: "customer", description: "Converted paying customer", color: "green-500" },
  { tag: "churned", description: "Previously active user who stopped engaging", color: "red-500" },
  { tag: "enterprise", description: "Enterprise tier customer or prospect", color: "violet-500" },
  { tag: "referrer", description: "User who has referred others", color: "pink-500" },
  { tag: "early-adopter", description: "Joined during early access period", color: "amber-500" },
  { tag: "nps:promoter", description: "NPS score 9-10, likely to recommend", color: "emerald-500" },
  { tag: "nps:passive", description: "NPS score 7-8, satisfied but not enthusiastic", color: "yellow-500" },
  { tag: "nps:detractor", description: "NPS score 0-6, unlikely to recommend", color: "orange-500" },
];

// =============================================================================
// CLIENT DATA
// =============================================================================

/**
 * Test channel users with varied profiles for E2E testing
 */
export const TEST_CHANNEL_USERS: TestChannelUser[] = [
  {
    id: "telegram_100001",
    platformUserId: "100001",
    platform: "telegram",
    firstName: "Alice",
    lastName: "Smith",
    username: "alice_smith",
    userVars: { points: 10, badges: ["newcomer"], loginCount: 1 },
  },
  {
    id: "telegram_100002",
    platformUserId: "100002",
    platform: "telegram",
    firstName: "Bob",
    lastName: null,
    username: "bob_tester",
    userVars: {
      points: 500,
      badges: ["newcomer", "engaged", "plan-selected", "feedback-hero", "converted"],
      loginCount: 12,
      referralCode: "BOB2024",
      lastPurchase: "2024-01-15T10:30:00Z",
      totalSpent: 299.99,
    },
  },
  {
    id: "telegram_100003",
    platformUserId: "100003",
    platform: "telegram",
    firstName: "Charlie",
    lastName: null,
    username: "charlie_user",
    userVars: { points: 15, badges: ["newcomer"], loginCount: 3, remindersSent: 2 },
  },
  {
    id: "telegram_100004",
    platformUserId: "100004",
    platform: "telegram",
    firstName: "Diana",
    lastName: "Jones",
    username: "diana_jones",
    userVars: {
      points: 250,
      badges: ["newcomer", "engaged", "enterprise-lead"],
      loginCount: 8,
      companySize: "500+",
      industry: "Finance",
      meetingScheduled: true,
    },
  },
  {
    id: "telegram_100005",
    platformUserId: "100005",
    platform: "telegram",
    firstName: "Noname",
    lastName: null,
    username: "user_100005",
    userVars: { points: 75, badges: ["newcomer", "engaged"], loginCount: 5 },
  },
  {
    id: "telegram_100006",
    platformUserId: "100006",
    platform: "telegram",
    firstName: "Emma",
    lastName: "Wilson",
    username: "emma_wilson",
    userVars: {
      points: 180,
      badges: ["newcomer", "engaged", "support-active"],
      loginCount: 7,
      lastSupportTicket: "2024-01-10T14:20:00Z",
      ticketCount: 3,
      satisfaction: "high",
    },
  },
  {
    id: "telegram_100007",
    platformUserId: "100007",
    platform: "telegram",
    firstName: "Frank",
    lastName: "Martinez",
    username: "frank_m",
    userVars: {
      points: 420,
      badges: ["newcomer", "engaged", "partner", "certified"],
      loginCount: 15,
      partnerTier: "Gold",
      referrals: 8,
      certificationDate: "2023-12-01",
    },
  },
  {
    id: "telegram_100008",
    platformUserId: "100008",
    platform: "telegram",
    firstName: "Grace",
    lastName: "Lee",
    username: "grace_lee",
    userVars: {
      points: 95,
      badges: ["newcomer", "event-registered"],
      loginCount: 4,
      eventName: "ProductFlow Summit 2024",
      registrationDate: "2024-01-12T09:00:00Z",
      ticketType: "VIP",
    },
  },
  {
    id: "telegram_100009",
    platformUserId: "100009",
    platform: "telegram",
    firstName: "Henry",
    lastName: null,
    username: "henry_tech",
    userVars: {
      points: 320,
      badges: ["newcomer", "engaged", "cart-recovered"],
      loginCount: 9,
      cartValue: 149.99,
      lastCartUpdate: "2024-01-13T16:45:00Z",
      remindersSent: 1,
    },
  },
  {
    id: "telegram_100010",
    platformUserId: "100010",
    platform: "telegram",
    firstName: "Isabel",
    lastName: "Garcia",
    username: "isabel_garcia",
    userVars: {
      points: 540,
      badges: ["newcomer", "engaged", "power-user", "advocate"],
      loginCount: 22,
      npsScore: 10,
      feedbackCount: 5,
      forumPosts: 14,
      helpfulVotes: 45,
    },
  },
];

// =============================================================================
// CRM PIPELINE DATA
// =============================================================================

/**
 * Default pipeline stages for CRM
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStageData[] = [
  { name: "Unassigned", color: "#94a3b8", position: 0, isDefault: true, isSystem: true },
  { name: "Lead", color: "#60a5fa", position: 1, isDefault: false, isSystem: false },
  { name: "Qualified", color: "#34d399", position: 2, isDefault: false, isSystem: false },
  { name: "Proposal", color: "#fbbf24", position: 3, isDefault: false, isSystem: false },
  { name: "Negotiation", color: "#fb923c", position: 4, isDefault: false, isSystem: false },
  { name: "Closed Won", color: "#22c55e", position: 5, isDefault: false, isSystem: false },
  { name: "Closed Lost", color: "#ef4444", position: 6, isDefault: false, isSystem: false },
];

/**
 * Support pipeline stages
 */
export const SUPPORT_PIPELINE_STAGES: PipelineStageData[] = [
  { name: "Unassigned", color: "#94a3b8", position: 0, isDefault: true, isSystem: true },
  { name: "New Ticket", color: "#60a5fa", position: 1, isDefault: false, isSystem: false },
  { name: "In Progress", color: "#fbbf24", position: 2, isDefault: false, isSystem: false },
  { name: "Awaiting Response", color: "#fb923c", position: 3, isDefault: false, isSystem: false },
  { name: "Resolved", color: "#34d399", position: 4, isDefault: false, isSystem: false },
  { name: "Closed", color: "#64748b", position: 5, isDefault: false, isSystem: false },
];

/**
 * Partner onboarding pipeline stages
 */
export const PARTNER_PIPELINE_STAGES: PipelineStageData[] = [
  { name: "Unassigned", color: "#94a3b8", position: 0, isDefault: true, isSystem: true },
  { name: "Applied", color: "#60a5fa", position: 1, isDefault: false, isSystem: false },
  { name: "Reviewing", color: "#fbbf24", position: 2, isDefault: false, isSystem: false },
  { name: "Approved", color: "#34d399", position: 3, isDefault: false, isSystem: false },
  { name: "Onboarding", color: "#8b5cf6", position: 4, isDefault: false, isSystem: false },
  { name: "Active Partner", color: "#22c55e", position: 5, isDefault: false, isSystem: false },
  { name: "Inactive", color: "#ef4444", position: 6, isDefault: false, isSystem: false },
];

/**
 * Global tag assignments - which users have which global tags
 */
export const TEST_GLOBAL_TAG_ASSIGNMENTS: Record<string, string[]> = {
  telegram_100001: ["VIP", "beta-tester", "early-adopter"],
  telegram_100002: ["newsletter", "customer", "referrer", "nps:promoter"],
  telegram_100003: ["churned"],
  telegram_100004: ["enterprise", "VIP"],
  telegram_100005: [],
};

// =============================================================================
// SESSION DATA
// =============================================================================

/**
 * Test sessions with different statuses for E2E testing
 */
export const TEST_SESSIONS: TestSession[] = [
  // SaaS Onboarding Journey Sessions
  {
    id: "00000000-0000-0000-2000-000000000001",
    clientId: "telegram_100001",
    currentNodeId: "feature-intro",
    status: "active",
  },
  {
    id: "00000000-0000-0000-2000-000000000002",
    clientId: "telegram_100002",
    currentNodeId: "converted",
    status: "completed",
  },
  {
    id: "00000000-0000-0000-2000-000000000003",
    clientId: "telegram_100003",
    currentNodeId: "churned",
    status: "dropped",
  },
  {
    id: "00000000-0000-0000-2000-000000000004",
    clientId: "telegram_100004",
    currentNodeId: "setup-delay",
    status: "paused",
  },
  {
    id: "00000000-0000-0000-2000-000000000005",
    clientId: "telegram_100005",
    currentNodeId: "conversion-offer",
    status: "active",
  },
  // SaaS Onboarding - Grace (for CRM Unassigned demo)
  {
    id: "00000000-0000-0000-2000-000000000006",
    clientId: "telegram_100008",
    currentNodeId: "feature-intro",
    status: "active",
  },
  // Support Triage Journey Sessions
  {
    id: "00000000-0000-0000-4000-000000000001",
    clientId: "telegram_100006",
    currentNodeId: "wait-for-resolution",
    status: "paused",
  },
  {
    id: "00000000-0000-0000-4000-000000000002",
    clientId: "telegram_100010",
    currentNodeId: "thank-you-end",
    status: "completed",
  },
  // Console Tabs Test Session - includes engine events for state reconstruction
  {
    id: CONSOLE_TABS_TEST_SESSION_ID,
    clientId: "telegram_100001", // Alice - reuse existing user
    currentNodeId: "pro-tips",
    status: "completed",
  },
];

// =============================================================================
// INTERACTION DATA
// =============================================================================

/**
 * Test interactions for path visualization
 */
export const TEST_INTERACTIONS: Record<string, TestInteraction[]> = {
  // Active session - just started (Alice)
  "00000000-0000-0000-2000-000000000001": [
    { type: "system.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "system.message", nodeId: "start", payload: { content: "Welcome to ProductFlow! 🚀" }, offsetMinutes: 1 },
    { type: "system.transition", nodeId: "feature-intro", payload: { from: "start", to: "feature-intro" }, offsetMinutes: 2 },
    { type: "system.message", nodeId: "feature-intro", payload: { content: "Which plan interests you most?" }, offsetMinutes: 2 },
  ],
  // Completed session - full journey (Bob)
  "00000000-0000-0000-2000-000000000002": [
    { type: "system.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "system.message", nodeId: "start", payload: { content: "Welcome to ProductFlow! 🚀" }, offsetMinutes: 0 },
    { type: "system.transition", nodeId: "feature-intro", payload: { from: "start", to: "feature-intro" }, offsetMinutes: 1 },
    { type: "system.message", nodeId: "feature-intro", payload: { content: "Which plan interests you most?" }, offsetMinutes: 1 },
    { type: "user.click", nodeId: "feature-intro", payload: { buttonId: "pro", buttonLabel: "⚡ Pro" }, offsetMinutes: 5 },
    { type: "system.transition", nodeId: "plan-check", payload: { from: "feature-intro", to: "plan-check" }, offsetMinutes: 5 },
    { type: "system.transition", nodeId: "pro-tips", payload: { from: "plan-check", to: "pro-tips" }, offsetMinutes: 6 },
    { type: "system.message", nodeId: "pro-tips", payload: { content: "Excellent choice! ⚡ The Pro plan unlocks serious power." }, offsetMinutes: 6 },
    { type: "system.transition", nodeId: "feedback-request", payload: { from: "pro-tips", to: "feedback-request" }, offsetMinutes: 7 },
    { type: "system.message", nodeId: "feedback-request", payload: { content: "What's the main challenge you're hoping to solve?" }, offsetMinutes: 7 },
    { type: "user.message", nodeId: "feedback-request", payload: { text: "Team collaboration" }, offsetMinutes: 10 },
    { type: "system.transition", nodeId: "setup-delay", payload: { from: "feedback-request", to: "setup-delay" }, offsetMinutes: 11 },
    { type: "system.transition", nodeId: "crm-sync", payload: { from: "setup-delay", to: "crm-sync" }, offsetMinutes: 1451 },
    { type: "system.transition", nodeId: "conversion-offer", payload: { from: "crm-sync", to: "conversion-offer" }, offsetMinutes: 1452 },
    { type: "system.message", nodeId: "conversion-offer", payload: { content: "🎉 Here's a special offer: 20% OFF!" }, offsetMinutes: 1452 },
    { type: "user.click", nodeId: "conversion-offer", payload: { buttonId: "upgrade", buttonLabel: "🚀 Upgrade Now" }, offsetMinutes: 1500 },
    { type: "system.transition", nodeId: "converted", payload: { from: "conversion-offer", to: "converted", outcome: "converted" }, offsetMinutes: 1500 },
    { type: "system.message", nodeId: "converted", payload: { content: "🎊 Congratulations! Welcome to ProductFlow!" }, offsetMinutes: 1501 },
  ],
  // Dropped session - user never responded (Charlie)
  "00000000-0000-0000-2000-000000000003": [
    { type: "system.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "system.message", nodeId: "start", payload: { content: "Welcome to ProductFlow! 🚀" }, offsetMinutes: 0 },
    { type: "system.transition", nodeId: "feature-intro", payload: { from: "start", to: "feature-intro" }, offsetMinutes: 1 },
    { type: "system.message", nodeId: "feature-intro", payload: { content: "Which plan interests you most?" }, offsetMinutes: 1 },
    { type: "system.timeout", nodeId: "feature-intro", payload: { edgeId: "e-feature-timer", duration: "2 hours" }, offsetMinutes: 121 },
    { type: "system.transition", nodeId: "follow-up-1", payload: { from: "feature-intro", to: "follow-up-1" }, offsetMinutes: 121 },
    { type: "system.message", nodeId: "follow-up-1", payload: { content: "Hey! 👋 I noticed you haven't selected a plan yet." }, offsetMinutes: 121 },
    { type: "system.timeout", nodeId: "follow-up-1", payload: { edgeId: "e-followup1-timer", duration: "24 hours" }, offsetMinutes: 1561 },
    { type: "system.transition", nodeId: "follow-up-2", payload: { from: "follow-up-1", to: "follow-up-2" }, offsetMinutes: 1561 },
    { type: "system.message", nodeId: "follow-up-2", payload: { content: "Still there? 🤔" }, offsetMinutes: 1561 },
    { type: "system.timeout", nodeId: "follow-up-2", payload: { edgeId: "e-followup2-dropoff", duration: "48 hours" }, offsetMinutes: 4441 },
    { type: "system.transition", nodeId: "churned", payload: { from: "follow-up-2", to: "churned", outcome: "dropped" }, offsetMinutes: 4441 },
    { type: "system.message", nodeId: "churned", payload: { content: "We noticed you haven't been active lately. 😔" }, offsetMinutes: 4442 },
  ],
  // Paused session - waiting in setup-delay (Diana)
  "00000000-0000-0000-2000-000000000004": [
    { type: "system.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "system.message", nodeId: "start", payload: { content: "Welcome to ProductFlow! 🚀" }, offsetMinutes: 0 },
    { type: "system.transition", nodeId: "feature-intro", payload: { from: "start", to: "feature-intro" }, offsetMinutes: 1 },
    { type: "system.message", nodeId: "feature-intro", payload: { content: "Which plan interests you most?" }, offsetMinutes: 1 },
    { type: "user.click", nodeId: "feature-intro", payload: { buttonId: "enterprise", buttonLabel: "🏢 Enterprise" }, offsetMinutes: 3 },
    { type: "system.transition", nodeId: "plan-check", payload: { from: "feature-intro", to: "plan-check" }, offsetMinutes: 3 },
    { type: "system.transition", nodeId: "enterprise-tips", payload: { from: "plan-check", to: "enterprise-tips" }, offsetMinutes: 4 },
    { type: "system.message", nodeId: "enterprise-tips", payload: { content: "Welcome to the Enterprise experience! 🏢" }, offsetMinutes: 4 },
    { type: "system.transition", nodeId: "feedback-request", payload: { from: "enterprise-tips", to: "feedback-request" }, offsetMinutes: 5 },
    { type: "system.message", nodeId: "feedback-request", payload: { content: "What's the main challenge you're hoping to solve?" }, offsetMinutes: 5 },
    { type: "user.message", nodeId: "feedback-request", payload: { text: "Security compliance" }, offsetMinutes: 8 },
    { type: "system.transition", nodeId: "setup-delay", payload: { from: "feedback-request", to: "setup-delay", status: "waiting" }, offsetMinutes: 9 },
  ],
  // Active session at conversion-offer stage (Anonymous)
  "00000000-0000-0000-2000-000000000005": [
    { type: "system.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "system.message", nodeId: "start", payload: { content: "Welcome to ProductFlow! 🚀" }, offsetMinutes: 0 },
    { type: "system.transition", nodeId: "feature-intro", payload: { from: "start", to: "feature-intro" }, offsetMinutes: 1 },
    { type: "system.message", nodeId: "feature-intro", payload: { content: "Which plan interests you most?" }, offsetMinutes: 1 },
    { type: "user.click", nodeId: "feature-intro", payload: { buttonId: "basic", buttonLabel: "💡 Basic" }, offsetMinutes: 15 },
    { type: "system.transition", nodeId: "plan-check", payload: { from: "feature-intro", to: "plan-check" }, offsetMinutes: 15 },
    { type: "system.transition", nodeId: "basic-tips", payload: { from: "plan-check", to: "basic-tips" }, offsetMinutes: 16 },
    {
      type: "system.message",
      nodeId: "basic-tips",
      payload: { content: "Great choice! 💡 The Basic plan is perfect for getting started." },
      offsetMinutes: 16,
    },
    { type: "system.transition", nodeId: "feedback-request", payload: { from: "basic-tips", to: "feedback-request" }, offsetMinutes: 17 },
    { type: "system.message", nodeId: "feedback-request", payload: { content: "What's the main challenge you're hoping to solve?" }, offsetMinutes: 17 },
    { type: "user.message", nodeId: "feedback-request", payload: { text: "Getting organized" }, offsetMinutes: 20 },
    { type: "system.transition", nodeId: "setup-delay", payload: { from: "feedback-request", to: "setup-delay" }, offsetMinutes: 21 },
    { type: "system.transition", nodeId: "crm-sync", payload: { from: "setup-delay", to: "crm-sync" }, offsetMinutes: 1461 },
    { type: "system.transition", nodeId: "conversion-offer", payload: { from: "crm-sync", to: "conversion-offer" }, offsetMinutes: 1462 },
    { type: "system.message", nodeId: "conversion-offer", payload: { content: "🎉 Here's a special offer: 20% OFF!" }, offsetMinutes: 1462 },
  ],
  // Support Triage Session (Emma - paused at wait-for-resolution)
  "00000000-0000-0000-4000-000000000001": [
    { type: "system.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "system.message", nodeId: "start", payload: { content: "Welcome to Support!" }, offsetMinutes: 0 },
    { type: "system.transition", nodeId: "crm-new-ticket", payload: { from: "start", to: "crm-new-ticket" }, offsetMinutes: 1 },
    { type: "system.transition", nodeId: "issue-category", payload: { from: "crm-new-ticket", to: "issue-category" }, offsetMinutes: 2 },
    { type: "system.message", nodeId: "issue-category", payload: { content: "What type of issue?" }, offsetMinutes: 2 },
    { type: "user.click", nodeId: "issue-category", payload: { buttonId: "tech", buttonLabel: "Technical Issue" }, offsetMinutes: 3 },
    { type: "system.transition", nodeId: "triage-routing", payload: { from: "issue-category", to: "triage-routing" }, offsetMinutes: 3 },
    { type: "system.transition", nodeId: "technical-details", payload: { from: "triage-routing", to: "technical-details" }, offsetMinutes: 4 },
    { type: "user.message", nodeId: "technical-details", payload: { text: "Cannot sync data across devices" }, offsetMinutes: 7 },
    { type: "system.transition", nodeId: "crm-in-progress", payload: { from: "technical-details", to: "crm-in-progress" }, offsetMinutes: 8 },
    { type: "system.transition", nodeId: "ticket-created", payload: { from: "crm-in-progress", to: "ticket-created" }, offsetMinutes: 9 },
    { type: "system.transition", nodeId: "notify-team", payload: { from: "ticket-created", to: "notify-team" }, offsetMinutes: 10 },
    { type: "system.transition", nodeId: "wait-for-resolution", payload: { from: "notify-team", to: "wait-for-resolution" }, offsetMinutes: 11 },
  ],
  // Support Triage Session (Isabel - completed)
  "00000000-0000-0000-4000-000000000002": [
    { type: "system.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "system.transition", nodeId: "issue-category", payload: { from: "start", to: "issue-category" }, offsetMinutes: 1 },
    { type: "user.click", nodeId: "issue-category", payload: { buttonId: "billing", buttonLabel: "Billing Question" }, offsetMinutes: 2 },
    { type: "system.transition", nodeId: "triage-routing", payload: { from: "issue-category", to: "triage-routing" }, offsetMinutes: 2 },
    { type: "system.transition", nodeId: "billing-details", payload: { from: "triage-routing", to: "billing-details" }, offsetMinutes: 3 },
    { type: "user.message", nodeId: "billing-details", payload: { text: "Need invoice for last month" }, offsetMinutes: 5 },
    { type: "system.transition", nodeId: "crm-in-progress", payload: { from: "billing-details", to: "crm-in-progress" }, offsetMinutes: 6 },
    { type: "system.transition", nodeId: "ticket-created", payload: { from: "crm-in-progress", to: "ticket-created" }, offsetMinutes: 7 },
    { type: "system.transition", nodeId: "notify-team", payload: { from: "ticket-created", to: "notify-team" }, offsetMinutes: 8 },
    { type: "system.transition", nodeId: "wait-for-resolution", payload: { from: "notify-team", to: "wait-for-resolution" }, offsetMinutes: 9 },
    { type: "system.transition", nodeId: "crm-resolved", payload: { from: "wait-for-resolution", to: "crm-resolved" }, offsetMinutes: 249 },
    { type: "system.transition", nodeId: "resolution-message", payload: { from: "crm-resolved", to: "resolution-message" }, offsetMinutes: 250 },
    { type: "user.click", nodeId: "resolution-message", payload: { buttonId: "satisfied", buttonLabel: "Yes, All Good!" }, offsetMinutes: 252 },
    { type: "system.transition", nodeId: "satisfaction-check", payload: { from: "resolution-message", to: "satisfaction-check" }, offsetMinutes: 252 },
    { type: "system.transition", nodeId: "crm-closed", payload: { from: "satisfaction-check", to: "crm-closed" }, offsetMinutes: 253 },
    { type: "system.transition", nodeId: "feedback-request", payload: { from: "crm-closed", to: "feedback-request" }, offsetMinutes: 254 },
    { type: "user.click", nodeId: "feedback-request", payload: { buttonId: "5", buttonLabel: "⭐️⭐️⭐️⭐️⭐️ 5" }, offsetMinutes: 256 },
    { type: "system.transition", nodeId: "thank-you-end", payload: { from: "feedback-request", to: "thank-you-end" }, offsetMinutes: 256 },
  ],
  // Console Tabs Test Session - includes engine events for state reconstruction testing
  [CONSOLE_TABS_TEST_SESSION_ID]: [
    // Engine transitions (for current node tracking in State tab)
    { type: "engine.transition", nodeId: "start", payload: { from: null, to: "start" }, offsetMinutes: 0 },
    { type: "engine.message", nodeId: "start", payload: { content: "Welcome to ProductFlow! 🚀" }, offsetMinutes: 0 },

    // Session variables (for Variables section in State tab)
    {
      type: "session.variables",
      nodeId: "start",
      payload: {
        operations: [
          { op: "set", scope: "user", key: "plan_interest", value: "pro" },
          { op: "set", scope: "journey", key: "started_at", value: "2024-01-15T10:00:00Z" },
        ],
      },
      offsetMinutes: 1,
    },

    // Session tags (for Tags section in State tab)
    {
      type: "session.tags",
      nodeId: "start",
      payload: { addTags: ["newcomer", "engaged"], resultTags: ["newcomer", "engaged"] },
      offsetMinutes: 1,
    },

    // User interaction
    { type: "user.click", nodeId: "feature-intro", payload: { buttonId: "pro", buttonLabel: "⚡ Pro" }, offsetMinutes: 5 },

    // More engine events
    { type: "engine.transition", nodeId: "feature-intro", payload: { from: "start", to: "feature-intro" }, offsetMinutes: 5 },
    { type: "engine.transition", nodeId: "pro-tips", payload: { from: "feature-intro", to: "pro-tips" }, offsetMinutes: 6 },
    { type: "engine.message", nodeId: "pro-tips", payload: { content: "Excellent choice! ⚡ The Pro plan unlocks serious power." }, offsetMinutes: 6 },

    // More variables
    {
      type: "session.variables",
      nodeId: "pro-tips",
      payload: {
        operations: [
          { op: "set", scope: "journey", key: "selected_plan", value: "pro" },
          { op: "increment", scope: "user", key: "interactions_count", value: 1 },
        ],
      },
      offsetMinutes: 7,
    },

    // Add more tags
    {
      type: "session.tags",
      nodeId: "pro-tips",
      payload: { addTags: ["pro-interested"], resultTags: ["newcomer", "engaged", "pro-interested"] },
      offsetMinutes: 7,
    },
  ],
};

// =============================================================================
// WORKFLOW CONFIGS
// =============================================================================

/**
 * Demo agent workflows loaded from JSON files.
 * Following the same pattern as journey configs.
 */
export const WORKFLOW_CONFIGS: WorkflowConfigData[] = [
  demoAssistantWorkflow as WorkflowConfigData,
  questionUnderstandingWorkflow as WorkflowConfigData,
  multiAgentRouterWorkflow as WorkflowConfigData,
  comprehensiveSupportWorkflow as WorkflowConfigData,
  memoryAgentWorkflow as WorkflowConfigData,
  ifElseDemoWorkflow as WorkflowConfigData,
  voiceTestAssistantWorkflow as WorkflowConfigData,
  questionnaireDemoWorkflow as WorkflowConfigData,
];

// =============================================================================
// PROMPT CONFIGS
// =============================================================================

/**
 * Prompt metadata loaded from JSON files.
 * Content is loaded separately from markdown files in seed-prompts.ts
 */
export const PROMPT_CONFIGS: PromptConfigData[] = [
  voiceDirectorV3Prompt as PromptConfigData,
  voiceDirectorV2Prompt as PromptConfigData,
  questionnaireDemoPrompt as PromptConfigData,
];
