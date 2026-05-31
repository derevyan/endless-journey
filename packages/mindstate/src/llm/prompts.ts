import type { StateParameter } from "@journey/schemas";

/**
 * Get constraint description for a parameter
 */
export function getConstraintDescription(param: StateParameter): string {
  if (param.scaleType === "NUMERIC") {
    return `NUMBER (${param.min ?? 0} to ${param.max ?? 10})`;
  } else if (param.scaleType === "CATEGORICAL") {
    return `STRING (One of: ${param.options?.join(", ")})`;
  } else if (param.scaleType === "BOOLEAN") {
    return `BOOLEAN (true/false)`;
  }
  return "STRING";
}

/**
 * Get hint description for a parameter
 */
export function getHintDescription(param: StateParameter): string {
  if (!param.detectionHints) return "";
  const hints: string[] = [];
  if (param.detectionHints.phrasesRaise?.length) {
    hints.push(`RAISE if user says: "${param.detectionHints.phrasesRaise.join('", "')}"`);
  }
  if (param.detectionHints.phrasesLower?.length) {
    hints.push(`LOWER if user says: "${param.detectionHints.phrasesLower.join('", "')}"`);
  }
  if (param.detectionHints.observations?.length) {
    hints.push(`Rules: ${param.detectionHints.observations.join("; ")}`);
  }
  return hints.length ? ` Hints: [${hints.join(" | ")}]` : "";
}

/**
 * Build parameter definitions block for agent prompt
 */
export function buildParameterDefinitions(params: StateParameter[]): string {
  return params
    .map((p) => {
      const semanticHint = p.semanticDirection
        ? ` (${p.semanticDirection === "high_is_good" ? "Higher is better" : "Lower is better"})`
        : "";

      return `ID: "${p.id}"
  Name: "${p.name}" (${p.category})${semanticHint}
  Desc: "${p.description}"
  Current Value: ${p.currentValue}
  Type: ${getConstraintDescription(p)}
  ${getHintDescription(p)}`;
    })
    .join("\n\n----------------\n\n");
}

/**
 * Build system prompt for agent batch processing
 */
export function buildAgentBatchSystemPrompt(
  agentName: string,
  agentRole: string,
  agentSystemPrompt: string,
  parameterDefinitions: string
): string {
  return `You are '${agentName}', a specialized ${agentRole}.
Your specific system mission is: "${agentSystemPrompt}"

TASK:
1. Analyze the User Message and Context deeply based on your specific Role.
2. Formulate a list of distinct internal insights/observations about the user's state.
3. Review the list of State Parameters you track.
4. For EACH parameter, determine if it should change based on your analysis.

If behavior matches a hint or definition, UPDATE the value.
Look for both explicit statements and subtle implicit cues.
If evidence suggests a change, do not hesitate to update.
If NO evidence exists, stick to the Current Value.

PARAMETERS TO TRACK:

${parameterDefinitions}

OUTPUT:
Return a JSON OBJECT containing:
- "analysis": An ARRAY of strings, where each string is a distinct observation or thought.
- "updates": An array of update objects for every parameter.`;
}

/**
 * Build user content for agent batch processing
 */
export function buildAgentBatchUserContent(userMessage: string, context: string): string {
  return `User Message: "${userMessage}"
Context: ${context}`;
}

/**
 * Build state description for main agent
 */
export function buildStateDescription(stateSnapshot: StateParameter[]): string {
  return stateSnapshot
    .map((p) => {
      let rangeInfo = "";
      if (p.scaleType === "NUMERIC") rangeInfo = `(Scale: ${p.min}-${p.max})`;
      if (p.scaleType === "CATEGORICAL") rangeInfo = `(Options: ${p.options?.join("/")})`;
      return `- ${p.name} (${p.category}): ${p.currentValue} ${rangeInfo}`;
    })
    .join("\n");
}

/**
 * Build system prompt for main agent response
 */
export function buildMainAgentSystemPrompt(
  agentName: string,
  agentRole: string,
  systemPrompt: string,
  stateDescription: string
): string {
  return `You are ${agentName}.
Role: ${agentRole}
System Directive: ${systemPrompt}

--- THEORY OF MIND ENGINE DATA ---
The following is a real-time psychological/situational snapshot of the user you are talking to.
You MUST adapt your response strategy to fit this state.

USER STATE:
${stateDescription}

INSTRUCTION:
Do not explicitly mention "I see your anxiety is 7/10".
Instead, ACT appropriately for that state.
If they are confused, clarify. If they are skeptical, provide proof.
Be concise.`;
}
