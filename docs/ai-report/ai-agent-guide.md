# AI Agent Guide for Journey Execution Reports

This guide helps AI agents (Claude, GPT, etc.) effectively analyze and understand Journey execution reports. The `AIExecutionReport` format is specifically designed for LLM consumption.

## Quick Reference

### Report Structure at a Glance

```
AIExecutionReport
├── summary          ← START HERE: Executive overview
├── issues           ← PROBLEMS: What went wrong
├── journeyLog       ← TIMELINE: What happened chronologically
├── transitions      ← FLOW: How user moved through journey
├── messages         ← CONVERSATION: Full message history
├── errors           ← ERRORS: Detailed error information
├── aiConversations  ← AI DETAILS: Full LLM call history
├── buttonClicks     ← BUTTONS: Every click with outcome
└── performanceAnalysis ← SPEED: Bottlenecks and slow nodes
```

### Reading Order for Different Tasks

| Task                   | Read Order                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| **Quick overview**     | `summary` → `issues`                                                   |
| **Debugging errors**   | `issues` → `errors` → `journeyLog`                                     |
| **Understanding flow** | `summary.pathDescription` → `transitions` → `journeyLog`               |
| **Button problems**    | `buttonClicks` → `unprocessedEvents` → `issues`                        |
| **AI/Agent issues**    | `aiConversations` → `workflowExecutions` → `errors`                    |
| **Performance**        | `performanceAnalysis` → `transitions` (check durationAtPreviousNodeMs) |
| **CRM integration**    | `crmActions`                                                           |
| **Approval flow**      | `hitlDecisions`                                                        |

---

## Understanding the Summary

The `summary` provides an executive overview - always read this first:

```json
{
  "summary": {
    "pathDescription": "Start → Welcome → Q&A Agent → IfElse[score>=80] → Success → End",
    "nodesVisited": 6,
    "uniqueNodes": 5,
    "totalMessages": 12,
    "userMessages": 5,
    "botMessages": 7,
    "buttonClicks": 2,
    "timeoutsTriggered": 0,
    "errorsCount": 0,
    "warningsCount": 1,
    "totalDurationMs": 145000,
    "totalTokensUsed": 2340,
    "totalLlmCostUSD": 0.047,
    "llmCallCount": 3
  }
}
```

### What to Look For

| Field                            | What It Tells You                                     |
| -------------------------------- | ----------------------------------------------------- |
| `pathDescription`                | Visual journey flow with conditions/buttons annotated |
| `errorsCount > 0`                | Problems occurred - check `errors` and `issues`       |
| `warningsCount > 0`              | Potential issues - check `issues`                     |
| `nodesVisited > uniqueNodes`     | User revisited nodes (possible loop)                  |
| `timeoutsTriggered > 0`          | User was inactive long enough to trigger timeouts     |
| `buttonClicks` vs `userMessages` | Ratio shows interaction style                         |

---

## Analyzing Issues

The `issues` array contains automatically detected problems:

```json
{
  "issues": [
    {
      "severity": "error",
      "category": "button_click_ignored",
      "nodeId": "pricing-node",
      "timestamp": "2024-01-15T10:02:30Z",
      "message": "Button 'premium' was clicked but no transition occurred (edge_not_found)",
      "suggestion": "Add an edge from node 'pricing-node' with sourceHandle 'premium' to connect the button to a target node.",
      "context": {
        "buttonId": "premium",
        "outcome": "edge_not_found",
        "activeButtonCount": 3
      }
    }
  ]
}
```

### Issue Severity Levels

| Severity  | Meaning             | Action                              |
| --------- | ------------------- | ----------------------------------- |
| `error`   | Something failed    | Must fix - user experienced problem |
| `warning` | Potential problem   | Should investigate                  |
| `info`    | Notable observation | May be intentional                  |

### Issue Categories

| Category               | What It Means                            |
| ---------------------- | ---------------------------------------- |
| `execution_error`      | Node threw an error during execution     |
| `button_click_ignored` | User clicked button but nothing happened |
| `repeated_node`        | Node visited 3+ times (possible loop)    |
| `slow_node`            | User spent >30s at a node                |
| `guard_blocked`        | Guard condition prevented transition     |
| `webhook_failure`      | External webhook call failed             |

### Actionable Pattern

When analyzing issues, follow this pattern:

1. **Group by severity** - Address errors first
2. **Check suggestions** - Each issue includes a fix suggestion
3. **Look at context** - Additional data helps understand why
4. **Cross-reference** - Find related events in `journeyLog`

---

## Understanding the Journey Log

The `journeyLog` is a chronological record of everything that happened:

```json
{
  "journeyLog": [
    {
      "id": "evt-001",
      "timestamp": "2024-01-15T10:00:00Z",
      "eventType": "node_transition",
      "nodeId": "welcome-node",
      "nodeType": "message",
      "nodeLabel": "Welcome",
      "description": "Transition: start → welcome-node (auto)",
      "payload": { "from": "start", "to": "welcome-node", "trigger": "auto" }
    },
    {
      "id": "evt-002",
      "timestamp": "2024-01-15T10:00:01Z",
      "eventType": "bot_message",
      "nodeId": "welcome-node",
      "nodeType": "message",
      "nodeLabel": "Welcome",
      "description": "Bot sent message from Welcome",
      "payload": { "content": "Hello! How can I help you today?", "buttons": [...] }
    }
  ]
}
```

### Key Event Types

| Event Type           | Description                |
| -------------------- | -------------------------- |
| `node_transition`    | Moved to a new node        |
| `user_message`       | User sent text             |
| `user_button_click`  | User clicked button        |
| `bot_message`        | Bot sent message           |
| `workflow_started`   | AI agent started           |
| `workflow_completed` | AI agent finished          |
| `guard_blocked`      | Guard prevented transition |
| `crm_action`         | CRM operation performed    |
| `hitl_decision`      | Human approval decision    |

### Timeline Analysis

When reconstructing what happened:

1. Filter by `eventType` to focus on specific aspects
2. Use `timestamp` to understand timing
3. Use `nodeId` to track location in journey
4. Read `description` for human-readable context
5. Check `payload` for detailed data

---

## Understanding Transitions

The `transitions` array explains WHY the user moved between nodes:

```json
{
  "transitions": [
    {
      "timestamp": "2024-01-15T10:01:30Z",
      "fromNodeId": "welcome-node",
      "fromNodeLabel": "Welcome",
      "toNodeId": "pricing-node",
      "toNodeLabel": "Pricing",
      "trigger": "button_click",
      "buttonId": "see-pricing",
      "buttonLabel": "See Pricing",
      "durationAtPreviousNodeMs": 90000
    }
  ]
}
```

### Transition Triggers

| Trigger           | What Caused Transition              |
| ----------------- | ----------------------------------- |
| `auto`            | Automatic (no user input needed)    |
| `button_click`    | User clicked a button               |
| `timer_expired`   | Timeout triggered                   |
| `condition_true`  | If/else condition was true          |
| `condition_false` | If/else condition was false         |
| `guard_passed`    | Guard allowed transition            |
| `guard_blocked`   | Guard prevented (failed transition) |
| `error`           | Error caused transition             |
| `workflow_exit`   | AI agent completed                  |

### Duration Analysis

The `durationAtPreviousNodeMs` field shows how long user spent at each node:

- **< 5 seconds**: Fast response (button click or quick read)
- **5-30 seconds**: Normal reading/thinking time
- **30-60 seconds**: Slow - user may be confused
- **> 60 seconds**: Very slow - possible issue

---

## Analyzing Button Clicks

The `buttonClicks` array tracks every button interaction:

```json
{
  "buttonClicks": [
    {
      "timestamp": "2024-01-15T10:02:30Z",
      "clickId": "click-001",
      "buttonId": "premium",
      "buttonLabel": "Premium Plan",
      "currentNodeId": "pricing-node",
      "currentNodeLabel": "Pricing",
      "buttonFound": true,
      "activeButtonsAtClick": [
        { "id": "basic", "text": "Basic Plan", "source": "node" },
        { "id": "premium", "text": "Premium Plan", "source": "node" },
        { "id": "enterprise", "text": "Enterprise", "source": "node" }
      ],
      "outcome": "edge_not_found",
      "failureReason": "No edge found for button 'premium' from node 'pricing-node'"
    }
  ]
}
```

### Button Click Outcomes

| Outcome              | What Happened                             |
| -------------------- | ----------------------------------------- |
| `transition_success` | Normal - went to target node              |
| `agent_reexecute`    | AI quick-reply - agent responded          |
| `button_not_found`   | Button ID doesn't match any active button |
| `edge_not_found`     | Button exists but no edge connects it     |
| `guard_blocked`      | Guard prevented the transition            |
| `error`              | Error during processing                   |
| `no_handler`         | No handler registered                     |

### Debugging Failed Clicks

When `outcome` is not `transition_success`:

1. Check `buttonFound` - is the button ID correct?
2. Check `activeButtonsAtClick` - what buttons were available?
3. Check `failureReason` - what specifically failed?
4. Look at `issues` for suggestions

---

## Analyzing AI Conversations

For AI/agent nodes, `aiConversations` contains full conversation history:

```json
{
  "aiConversations": [
    {
      "nodeId": "qa-agent",
      "nodeLabel": "Q&A Agent",
      "status": "completed",
      "turns": [
        {
          "turnNumber": 1,
          "timestamp": "2024-01-15T10:01:00Z",
          "userMessage": "What features does the premium plan include?",
          "assistantResponse": "The premium plan includes...",
          "toolCalls": [],
          "llmCall": {
            "config": { "model": "gpt-4o", "provider": "openai" },
            "systemPrompt": "You are a helpful sales assistant...",
            "inputMessages": [...],
            "outputContent": "The premium plan includes...",
            "totalTokens": 450,
            "costUSD": 0.015,
            "durationMs": 1200
          }
        }
      ],
      "metrics": {
        "turnCount": 3,
        "totalTokens": 1200,
        "totalCostUSD": 0.04
      }
    }
  ]
}
```

### What to Analyze

| Field                  | What It Tells You                    |
| ---------------------- | ------------------------------------ |
| `status`               | Did the agent complete successfully? |
| `turns`                | Full back-and-forth conversation     |
| `toolCalls`            | What tools the agent used            |
| `llmCall.systemPrompt` | What instructions the agent had      |
| `metrics.totalTokens`  | Total token usage                    |
| `metrics.totalCostUSD` | Total cost                           |

### Debugging AI Issues

1. **Check `status`** - `error` or `blocked` indicates problems
2. **Read `llmCall.systemPrompt`** - Are instructions clear?
3. **Check `toolCalls`** - Did tools work correctly?
4. **Look at `turns`** - Where did conversation go wrong?
5. **Check `llmCall.errorMessage`** - Any LLM errors?

---

## Performance Analysis

The `performanceAnalysis` identifies bottlenecks:

```json
{
  "performanceAnalysis": {
    "slowestNodes": [
      {
        "nodeId": "qa-agent",
        "nodeLabel": "Q&A Agent",
        "avgDurationMs": 45000,
        "executionCount": 2
      }
    ],
    "bottlenecks": [
      "[HIGH] Q&A Agent: Node took 45.0s on average (2 executions) - Consider breaking this node into smaller steps or adding progress indicators"
    ]
  }
}
```

### Bottleneck Impact Levels

| Impact | Criteria                             |
| ------ | ------------------------------------ |
| HIGH   | >60s average OR >30% of session time |
| MEDIUM | >30s average OR >15% of session time |
| LOW    | Above threshold but lower impact     |

---

## Common Analysis Patterns

### Pattern 1: "Button doesn't work"

```
1. Check buttonClicks → find click with non-success outcome
2. Read outcome → "edge_not_found" / "button_not_found" / etc.
3. Read failureReason → specific details
4. Check issues → automated suggestion
5. Check activeButtonsAtClick → what buttons were available
```

### Pattern 2: "User got stuck"

```
1. Check summary.pathDescription → see flow
2. Check transitions → find where durationAtPreviousNodeMs is high
3. Check issues → look for "slow_node" warnings
4. Check messages → what did user see?
5. Check journeyLog → what happened at that node?
```

### Pattern 3: "AI agent not responding correctly"

```
1. Check aiConversations → find the agent
2. Check status → completed/error/blocked?
3. Check turns → read conversation
4. Check llmCall.systemPrompt → are instructions clear?
5. Check toolCalls → any tool errors?
6. Check errors → any related errors?
```

### Pattern 4: "Journey took too long"

```
1. Check summary.totalDurationMs → total time
2. Check performanceAnalysis.slowestNodes → which nodes were slow
3. Check performanceAnalysis.bottlenecks → impact assessment
4. Check transitions → durationAtPreviousNodeMs for each transition
5. Check aiConversations.metrics → LLM call durations
```

### Pattern 5: "Unexpected path taken"

```
1. Check summary.pathDescription → visual flow
2. Check transitions → each transition with trigger
3. Look for condition_true/condition_false → check currentVariables
4. Look for guard_blocked → check why guard failed
5. Check variableChanges → what variables affected conditions
```

---

## Data Relationships

Understanding how report sections relate:

```
buttonClicks[].clickId ─────────► issues[].relatedButtonClick
                │
                ▼
unprocessedEvents[].eventId

transitions[].toNodeId ─────────► journeyLog[].nodeId
       │
       └── transitions[].trigger ──► "button_click" has buttonId

aiConversations[].nodeId ───────► workflowExecutions[].nodeId
                │
                ▼
                journeyLog[].nodeId (where eventType = "workflow_*")

errors[].nodeId ────────────────► issues[].relatedError
        │
        ▼
        journeyLog[].nodeId (where eventType = "node_error")
```

---

## Example Analysis Workflow

Given a report, follow this workflow:

### Step 1: Quick Assessment

```python
# Check summary
if summary.errorsCount > 0:
    priority = "HIGH - errors occurred"
elif summary.warningsCount > 0:
    priority = "MEDIUM - warnings present"
else:
    priority = "LOW - looks healthy"
```

### Step 2: Issue Triage

```python
# Sort issues by severity
errors = [i for i in issues if i.severity == "error"]
warnings = [i for i in issues if i.severity == "warning"]

# For each error
for error in errors:
    # Read the suggestion
    print(f"Problem: {error.message}")
    print(f"Fix: {error.suggestion}")

    # Find related events
    if error.relatedButtonClick:
        click = find_by_id(buttonClicks, error.relatedButtonClick)
        # Analyze click details
```

### Step 3: Deep Dive (if needed)

```python
# For complex issues, trace through journey log
relevant_events = [
    e for e in journeyLog
    if e.nodeId == problem_nodeId
]

# Understand what happened in sequence
for event in sorted(relevant_events, key=lambda e: e.timestamp):
    print(f"{event.timestamp}: {event.description}")
```

---

## Tips for Effective Analysis

### DO

- ✅ Start with `summary` for quick overview
- ✅ Check `issues` before deep diving
- ✅ Use `pathDescription` to understand flow visually
- ✅ Cross-reference related sections
- ✅ Read `suggestion` fields for actionable fixes
- ✅ Check timestamps to understand sequence

### DON'T

- ❌ Read entire `journeyLog` linearly (filter first)
- ❌ Ignore `context` fields (they have key details)
- ❌ Assume single cause (often multiple issues)
- ❌ Skip `activeButtonsAtClick` (shows what user saw)
- ❌ Ignore `durationAtPreviousNodeMs` (reveals UX issues)

---

## See Also

- [README](./README.md) - Package overview
- [Architecture](./architecture.md) - System design
- [Schema Reference](./schemas.md) - Complete type definitions
