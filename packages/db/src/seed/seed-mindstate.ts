/**
 * MindState Definition Seeding Module
 *
 * Seeds default MindState definitions for organizations.
 * Creates a comprehensive "Default Companion" mindstate definition
 * that tracks emotional, cognitive, and motivational states.
 *
 * @module seed/seed-mindstate
 */

import { createLogger } from "@journey/logger";
import type { MainAgent, StateParameter, SystemAgent } from "@journey/schemas";
import { llmConfig } from "@journey/schemas";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { mindstateDefinitions, organization } from "../schema";

const log = createLogger("db:seed:mindstate");

// =============================================================================
// DEFAULT MINDSTATE CONFIGURATION
// =============================================================================

/**
 * Default main agent configuration
 */
const DEFAULT_MAIN_AGENT: MainAgent = {
  id: "main_agent",
  name: "Dr. Homa",
  role: "Primary Companion",
  avatar: "Bot",
  color: "indigo",
  promptSource: "inline",
  systemPrompt: `You are an adaptive AI companion designed to provide personalized support. Your role is to engage with users while being aware of their current state.

Based on the user's current state parameters:
- If cognitive load is high, simplify your language and break down complex topics
- If stress is elevated, be more supportive, calming, and reassuring
- If interest is low, be more engaging, use examples, and be concise
- If mood is low, show empathy and provide encouragement
- Mirror their energy level appropriately

Communication Guidelines:
- Maintain a professional yet warm tone
- Adapt your response length to match their engagement
- Ask clarifying questions when needed
- Acknowledge their feelings before problem-solving
- Provide actionable advice when appropriate`,
  llmConfig: {
    model: llmConfig.agent.model.id,
    reasoningEffort: llmConfig.agent.reasoningEffort,
    maxTokens: llmConfig.conversation.maxTokens,
  },
};

/**
 * Default system agents for analysis
 */
const DEFAULT_SYSTEM_AGENTS: SystemAgent[] = [
  {
    id: "general_agent",
    name: "General Observer",
    role: "Baseline Analyzer",
    avatar: "Eye",
    color: "blue",
    promptSource: "inline",
    systemPrompt: `You are a general state observer. Analyze user messages for any notable patterns or state indicators that don't fit other specialized categories.

Focus on:
- Overall engagement level and communication style changes
- General sentiment shifts and tone variations
- Question frequency and depth of inquiry
- Response length patterns and verbosity
- Any unusual patterns or notable behavioral changes

Provide concise analysis with specific evidence from the message. Update relevant parameters when you detect clear signals.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.3,
      maxTokens: 1000,
    },
  },
  {
    id: "emotional_agent",
    name: "Emotion Analyzer",
    role: "Emotional State Tracker",
    avatar: "Heart",
    color: "rose",
    promptSource: "inline",
    systemPrompt: `You are an emotional state analyzer. Monitor for emotional cues in user messages with sensitivity and accuracy.

Focus on:
- Mood indicators (happy, sad, frustrated, excited, anxious)
- Stress signals (rushed language, complaints, urgency, concern)
- Satisfaction levels (positive/negative feedback patterns)
- Emotional intensity and valence
- Defense mechanisms and coping language

Be sensitive but objective in your analysis. Look for both explicit statements and subtle linguistic cues.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.3,
      maxTokens: 1000,
    },
  },
  {
    id: "cognitive_agent",
    name: "Cognitive Analyst",
    role: "Mental Load Tracker",
    avatar: "Brain",
    color: "purple",
    promptSource: "inline",
    systemPrompt: `You are a cognitive state analyzer. Monitor for signs of mental load, focus, and comprehension.

Focus on:
- Cognitive load indicators (confusion, requests for simplification)
- Focus level (following threads, staying on topic vs. distraction)
- Comprehension signals (asking for clarification, misunderstandings)
- Mental fatigue signs (shorter responses, disengagement)
- Learning and retention patterns

Track how users process information and adjust assessments accordingly.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.3,
      maxTokens: 1000,
    },
  },
  {
    id: "motivation_agent",
    name: "Motivation Tracker",
    role: "Intent Analyzer",
    avatar: "Target",
    color: "emerald",
    promptSource: "inline",
    systemPrompt: `You are a motivation and intent analyzer. Monitor for signs of user goals, urgency, and engagement.

Focus on:
- Interest level (curiosity, questions, engagement depth)
- Urgency signals (time pressure, deadline mentions, NOW/ASAP language)
- Goal clarity (specific objectives vs. vague exploration)
- Persistence (follow-up questions, staying on topic)
- Decision readiness (comparison seeking, final questions)

Track motivation patterns to help optimize the interaction flow.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.4,
      maxTokens: 1000,
    },
  },
];

/**
 * Default state parameters
 */
const DEFAULT_PARAMETERS: StateParameter[] = [
  // Emotional parameters
  {
    id: "mood",
    name: "Mood",
    category: "Emotional",
    description: "Current emotional mood level from negative to positive",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: "emotional_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["great", "happy", "excited", "wonderful", "amazing", "love", "fantastic"],
      phrasesLower: ["sad", "frustrated", "upset", "angry", "disappointed", "terrible", "hate"],
      observations: ["Track emotional language, emoji usage, and overall tone"],
    },
  },
  {
    id: "stress",
    name: "Stress Level",
    category: "Mental",
    description: "Current stress or anxiety level",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 3,
    responsibleAgentId: "emotional_agent",
    semanticDirection: "low_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["worried", "anxious", "stressed", "overwhelmed", "urgent", "panic", "deadline"],
      phrasesLower: ["relaxed", "calm", "no rush", "at ease", "peaceful", "take my time"],
      observations: ["Watch for time pressure language, exclamation marks, all caps"],
    },
  },
  // Physical parameters
  {
    id: "energy",
    name: "Energy Level",
    category: "Physical",
    description: "Physical energy and vitality",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 6,
    responsibleAgentId: "general_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["energetic", "ready", "pumped", "motivated", "rested"],
      phrasesLower: ["tired", "exhausted", "drained", "fatigued", "sleepy", "need coffee"],
      observations: ["Response speed, message length, engagement level"],
    },
  },
  // Cognitive parameters
  {
    id: "focus",
    name: "Focus Level",
    category: "Cognitive",
    description: "Ability to concentrate and stay on topic",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 7,
    responsibleAgentId: "cognitive_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["let me focus", "specifically", "the key point", "exactly"],
      phrasesLower: ["distracted", "sorry what", "I forgot", "wait", "off topic"],
      observations: ["Thread coherence, response relevance, question specificity"],
    },
  },
  {
    id: "cognitive_load",
    name: "Cognitive Load",
    category: "Cognitive",
    description: "Mental processing burden",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 4,
    responsibleAgentId: "cognitive_agent",
    semanticDirection: "low_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["confusing", "too much", "overwhelmed", "complicated", "lost"],
      phrasesLower: ["makes sense", "got it", "clear", "simple", "understand"],
      observations: ["Requests for simplification, comprehension signals"],
    },
  },
  // Motivation parameters
  {
    id: "interest",
    name: "Interest Level",
    category: "Motivation",
    description: "Level of interest and engagement in the topic",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 6,
    responsibleAgentId: "motivation_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["tell me more", "interesting", "curious", "fascinating", "how does"],
      phrasesLower: ["whatever", "don't care", "boring", "skip", "not relevant"],
      observations: ["Question frequency, follow-up engagement, exploration depth"],
    },
  },
  {
    id: "urgency",
    name: "Urgency",
    category: "Motivation",
    description: "Time pressure and need for quick resolution",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 3,
    responsibleAgentId: "motivation_agent",
    semanticDirection: "low_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["ASAP", "urgent", "NOW", "deadline", "immediately", "can't wait"],
      phrasesLower: ["whenever", "no rush", "take your time", "eventually"],
      observations: ["Caps usage, punctuation intensity, time references"],
    },
  },
  // Social parameters
  {
    id: "rapport",
    name: "Rapport",
    category: "Social",
    description: "Connection and trust level with the assistant",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: "general_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["thank you", "helpful", "appreciate", "great job", "you understand"],
      phrasesLower: ["useless", "not helpful", "wrong", "you don't get it", "frustrated with you"],
      observations: ["Politeness markers, personal disclosures, feedback tone"],
    },
  },
  // Informational parameters
  {
    id: "topic_familiarity",
    name: "Topic Familiarity",
    category: "Informational",
    description: "User's existing knowledge of the current topic",
    scaleType: "CATEGORICAL",
    options: ["Novice", "Beginner", "Intermediate", "Advanced", "Expert"],
    currentValue: "Intermediate",
    responsibleAgentId: "cognitive_agent",
    history: [],
    detectionHints: {
      phrasesRaise: ["I know", "as you know", "obviously", "in my experience"],
      phrasesLower: ["what is", "explain", "I don't understand", "never heard of"],
      observations: ["Technical vocabulary usage, depth of questions"],
    },
  },
];

/**
 * Default categories
 */
const DEFAULT_CATEGORIES = ["Emotional", "Mental", "Physical", "Motivation", "Cognitive", "Social", "Informational", "Trait", "Context", "Situational"];

// =============================================================================
// SEED FUNCTION
// =============================================================================

/**
 * Seed default MindState definitions for all organizations
 */
export async function seedMindstateDefinitions() {
  log.info("🌱 Seeding MindState definitions...");

  // Get all organizations
  const organizations = await db.select().from(organization);

  for (const org of organizations) {
    // Check if this organization already has the default mindstate
    const existing = await db
      .select()
      .from(mindstateDefinitions)
      .where(and(eq(mindstateDefinitions.organizationId, org.id), eq(mindstateDefinitions.key, "default-companion")));

    if (existing.length > 0) {
      log.info({ orgId: org.id, orgName: org.name }, "seed:mindstateExists");
      continue;
    }

    // Create the default mindstate definition
    await db.insert(mindstateDefinitions).values({
      organizationId: org.id,
      key: "default-companion",
      name: "Default Companion",
      description: "A comprehensive AI companion that tracks emotional, cognitive, and motivational states to provide personalized interactions.",
      mainAgentConfig: DEFAULT_MAIN_AGENT,
      defaultAgents: DEFAULT_SYSTEM_AGENTS,
      defaultParameters: DEFAULT_PARAMETERS,
      categories: DEFAULT_CATEGORIES,
      analysisMode: "automatic",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    log.info({ orgId: org.id, orgName: org.name }, "seed:mindstateCreated");
  }

  log.info("✅ MindState definitions seeded!");
}
