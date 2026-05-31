# Bindings System

The engine provides a comprehensive bindings system for accessing data in templates. This system enables dynamic content generation, cross-node data referencing, and powerful expression evaluation.

## Overview

Bindings allow you to access data from multiple sources in your journey templates:

- **User data**: Profile information and user variables
- **Session data**: Current session state and metadata
- **Variables**: Journey and global variables
- **Node outputs**: Data from previously executed nodes
- **Expressions**: JEXL-based calculations and transformations

## Context Namespaces

The `buildFullContext()` function creates a namespaced context object with the following structure:

```typescript
{
  // User namespace
  user: {
    id: string,              // User ID (e.g., "telegram_12345")
    platform: string,       // Platform (e.g., "telegram")
    firstName: string,       // User's first name
    lastName: string,       // User's last name
    username: string,       // Platform username
    vars: Record<string, unknown>, // User variables (persistent)
  },

  // Session namespace
  session: {
    id: string,             // Session ID
    journeyId: string,       // Journey ID
    status: string,          // Session status
    currentNodeId: string,   // Current node ID
    tags: string[],          // User tags (global scope)
  },

  // Variables namespace
  vars: {
    journey: Record<string, unknown>, // Journey-scoped variables
    global: Record<string, unknown>,  // Organization-scoped variables
    user: Record<string, unknown>,    // User-scoped variables (if provided)
  },

  // Nodes namespace (cross-node references)
  nodes: {
    "Node_Label": {          // Sanitized node label
      // Output data from that node
    },
  },

  // Legacy fields (session.context merged at top-level)
  // e.g. userResponse, storeResponseAs values, or custom fields
}
```

## Template Modes

The template service supports two modes:

### Simple Mode (Backwards Compatible)

Direct path lookup using `{{path.to.value}}`:

```typescript
// Examples
"Hello {{user.firstName}}";
"Session: {{session.id}}";
"Points: {{user.vars.points}}";
"Welcome: {{vars.journey.welcomeMessage}}";
```

**How it works:**

- Uses `getNestedValue()` to traverse the context object
- Fast and simple for basic variable substitution
- Returns empty string if path not found
- Supports wildcard dumps: `{{path.*}}` returns JSON for the object at `path`

### Expression Mode (JEXL)

Full expression evaluation using `{{= expression }}`:

```typescript
// Examples
"Name: {{= upper(user.firstName) }}";
"Status: {{= user.vars.points > 100 ? 'VIP' : 'Standard' }}";
"Email: {{= default(user.email, 'No email') }}";
"Count: {{= length(user.tags) }}";
```

**How it works:**

- Uses JEXL expression engine
- Supports functions, operators, and complex logic
- Returns empty string on error (keeps original template)

## Available Bindings

### User Namespace

Access user profile and variables:

| Binding              | Type    | Description                      |
| -------------------- | ------- | -------------------------------- |
| `{{user.id}}`        | string  | User ID (platform-specific)      |
| `{{user.platform}}`  | string  | Platform name (e.g., "telegram") |
| `{{user.firstName}}` | string  | User's first name                |
| `{{user.lastName}}`  | string  | User's last name                 |
| `{{user.username}}`  | string  | Platform username                |
| `{{user.vars.*}}`    | unknown | User variables (persistent)      |

**Examples:**

```
Hello {{user.firstName}}!
Your username: @{{user.username}}
Points: {{user.vars.points}}
Tier: {{user.vars.tier}}
```

### Session Namespace

Access current session state:

| Binding                     | Type     | Description                                  |
| --------------------------- | -------- | -------------------------------------------- |
| `{{session.id}}`            | string   | Session ID                                   |
| `{{session.journeyId}}`     | string   | Journey ID                                   |
| `{{session.status}}`        | string   | Session status ("active", "completed", etc.) |
| `{{session.currentNodeId}}` | string   | Current node ID                              |
| `{{session.tags}}`          | string[] | User tags (global)                           |

**Examples:**

```
Session ID: {{session.id}}
Journey: {{session.journeyId}}
Status: {{session.status}}
```

### Variables Namespace

Access journey, global, and user-scoped variables:

| Binding              | Type    | Description                                  |
| -------------------- | ------- | -------------------------------------------- |
| `{{vars.journey.*}}` | unknown | Journey-scoped variables                     |
| `{{vars.global.*}}`  | unknown | Organization-scoped variables                |
| `{{vars.user.*}}`    | unknown | User-scoped variables (from variables store) |

`vars.user` is populated from user-scoped variables in the unified variables store.
`user.vars` and `vars.user` point at the same map.

**Examples:**

```
Welcome message: {{vars.journey.welcomeMessage}}
Support email: {{vars.global.supportEmail}}
Company name: {{vars.global.companyName}}
User locale: {{vars.user.locale}}
```

### Nodes Namespace

Access outputs from previously executed nodes:

| Binding                 | Type    | Description                           |
| ----------------------- | ------- | ------------------------------------- |
| `{{nodes.NodeLabel.*}}` | unknown | Output data from node with that label |

**Node labels are sanitized:**

- Spaces → underscores: `"Get Customer"` → `"Get_Customer"`
- Special chars removed: `"API Call (v2)"` → `"API_Call_v2"`
- Multiple underscores collapsed: `"Node  __  Name"` → `"Node_Name"`

**Examples:**

```typescript
// Webhook node "Get Customer" returns:
{
  id: "cust_123",
  email: "john@example.com",
  name: "John Doe",
  tier: "premium"
}

// Later nodes can access:
Customer ID: {{nodes.Get_Customer.id}}
Email: {{nodes.Get_Customer.email}}
Name: {{nodes.Get_Customer.name}}
Tier: {{nodes.Get_Customer.tier}}
```

**Note:** If a node hasn't executed yet, accessing its output returns empty string.

If a node output is a primitive (string/number/boolean), it is wrapped as `{ value }`:

```
{{nodes.My_Node.value}}
```

Node outputs live in `session.nodeOutputs` for runtime access and are also mirrored into `session.context` under the sanitized label for persistence.

### Mindstate Namespace (Condition Nodes Only)

Access mindstate parameter values in condition expressions and rules:

| Binding                           | Type    | Description                              |
| --------------------------------- | ------- | ---------------------------------------- |
| `{{mindstate.{key}.{parameter}}}` | unknown | Mindstate parameter value for given key  |

**How it works:**

The condition handler automatically detects `mindstate.*` references in expressions and rules, then fetches the values from the mindstate service before evaluation.

**Pattern:** `mindstate.{mindstateKey}.{parameterName}`

**Examples:**

```typescript
// Condition expression accessing mood mindstate
{
  type: "condition",
  expression: "mindstate.mood.stress > 7",
  branches: [
    { id: "high_stress", label: "High Stress" },
    { id: "normal", label: "Normal", isDefault: true }
  ]
}

// Multiple mindstate references
{
  type: "condition",
  expression: "mindstate.mood.stress > 7 && mindstate.engagement.score < 50",
  branches: [...]
}

// Rule-based condition with mindstate
{
  type: "condition",
  rules: [
    { field: "mindstate.customer-mood.satisfaction", operator: "lt", value: 3 }
  ],
  branches: [
    { id: "unhappy", label: "Unhappy Customer" },
    { id: "default", label: "Default", isDefault: true }
  ]
}
```

**Important Notes:**

1. Mindstate namespace is **only available in condition nodes** - it's not part of the general template context
2. If the mindstate service is unavailable, referenced values are set to `null`
3. Mindstate keys support kebab-case: `mindstate.customer-mood.satisfaction`
4. Parameter names support underscores: `mindstate.mood.stress_level`

## Expression Functions

The expression service provides custom JEXL functions for data transformation:

### String Functions

| Function        | Description                        | Example                                        |
| --------------- | ---------------------------------- | ---------------------------------------------- |
| `upper(s)`      | Convert to uppercase               | `{{= upper(user.firstName) }}` → `"JOHN"`      |
| `lower(s)`      | Convert to lowercase               | `{{= lower(user.firstName) }}` → `"john"`      |
| `trim(s)`       | Remove leading/trailing whitespace | `{{= trim(user.firstName) }}`                  |
| `capitalize(s)` | Capitalize first letter            | `{{= capitalize(user.firstName) }}` → `"John"` |
| `length(s)`     | Get string/array length            | `{{= length(user.tags) }}`                     |

### Conditional Functions

| Function                 | Description                                | Example                                              |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------- |
| `default(val, fallback)` | Return fallback if value is null/undefined | `{{= default(user.email, 'No email') }}`             |
| `isEmpty(val)`           | Check if value is empty                    | `{{= isEmpty(user.tags) ? 'No tags' : 'Has tags' }}` |

### Array Functions

| Function              | Description                  | Example                             |
| --------------------- | ---------------------------- | ----------------------------------- |
| `first(arr)`          | Get first element            | `{{= first(user.tags) }}`           |
| `last(arr)`           | Get last element             | `{{= last(user.tags) }}`            |
| `join(arr, sep)`      | Join array with separator    | `{{= join(user.tags, ', ') }}`      |
| `includes(arr, item)` | Check if array includes item | `{{= includes(user.tags, 'vip') }}` |

### Number Functions

| Function             | Description             | Example                            |
| -------------------- | ----------------------- | ---------------------------------- |
| `round(n, decimals)` | Round to decimal places | `{{= round(user.vars.score, 2) }}` |
| `floor(n)`           | Round down              | `{{= floor(user.vars.score) }}`    |
| `ceil(n)`            | Round up                | `{{= ceil(user.vars.score) }}`     |
| `abs(n)`             | Absolute value          | `{{= abs(user.vars.score) }}`      |

### Date Functions

| Function                   | Description           | Example                                              |
| -------------------------- | --------------------- | ---------------------------------------------------- |
| `now()`                    | Current ISO timestamp | `{{= now() }}` → `"2024-01-15T10:30:00.000Z"`        |
| `formatDate(date, format)` | Format date string    | `{{= formatDate(session.startedAt, 'YYYY-MM-DD') }}` |

**Date format tokens:**

- `YYYY` - 4-digit year
- `MM` - 2-digit month (01-12)
- `DD` - 2-digit day (01-31)

### JSON Functions

| Function    | Description            | Example                                   |
| ----------- | ---------------------- | ----------------------------------------- |
| `json(obj)` | Convert to JSON string | `{{= json(user.vars) }}`                  |
| `parse(s)`  | Parse JSON string      | `{{= parse(nodes.Get_Data.jsonString) }}` |

## Expression Syntax

JEXL supports standard JavaScript-like expressions:

### Operators

```typescript
// Arithmetic
{{= user.vars.points + 10 }}
{{= user.vars.score * 1.5 }}
{{= user.vars.count / 2 }}

// Comparison
{{= user.vars.points > 100 ? 'VIP' : 'Standard' }}
{{= user.vars.tier == 'premium' ? 'Yes' : 'No' }}
{{= user.vars.score >= 50 ? 'Pass' : 'Fail' }}

// Logical
{{= user.vars.points > 100 && user.vars.tier == 'premium' ? 'VIP Premium' : 'Standard' }}
{{= isEmpty(user.email) || isEmpty(user.phone) ? 'Incomplete' : 'Complete' }}

// String concatenation
{{= user.firstName + ' ' + user.lastName }}
```

### Ternary Operator

```typescript
{{= condition ? valueIfTrue : valueIfFalse }}

// Examples
{{= user.vars.points > 100 ? 'VIP' : 'Standard' }}
{{= isEmpty(user.email) ? 'No email' : user.email }}
{{= length(user.tags) > 0 ? join(user.tags, ', ') : 'No tags' }}
```

### Function Chaining

```typescript
{{= upper(trim(user.firstName)) }}
{{= round(user.vars.score * 1.1, 2) }}
{{= default(upper(user.email), 'NO EMAIL') }}
```

## Usage Examples

### Message Content

```typescript
{
  type: "message",
  content: "Hello {{user.firstName}}! You have {{user.vars.points}} points. Status: {{= user.vars.points > 100 ? 'VIP' : 'Standard' }}"
}
```

### Webhook URL

```typescript
{
  type: "webhook",
  url: "https://api.example.com/users/{{user.id}}",
  method: "GET"
}
```

### Webhook Body

```json
{
  "user_id": "{{user.id}}",
  "name": "{{user.firstName}} {{user.lastName}}",
  "username": "{{user.username}}",
  "session_id": "{{session.id}}",
  "journey_id": "{{session.journeyId}}",
  "points": {{user.vars.points}},
  "tier": "{{user.vars.tier}}",
  "customer_email": "{{nodes.Get_Customer.email}}",
  "customer_name": "{{nodes.Get_Customer.name}}",
  "formatted_name": "{{= upper(user.firstName + ' ' + user.lastName) }}",
  "status": "{{= user.vars.points > 100 ? 'VIP' : 'Standard' }}"
}
```

### Condition Expression

```typescript
{
  type: "condition",
  expression: "user.vars.points > 100 && user.vars.tier == 'premium'",
  branches: [
    { id: "vip", label: "VIP Premium" },
    { id: "standard", label: "Standard", isDefault: true }
  ]
}
```

### Complex Expression

```typescript
{
  type: "message",
  content: "Welcome {{= capitalize(user.firstName) }}! You have {{user.vars.points}} points. {{= user.vars.points > 100 ? 'You are a VIP member!' : 'Become a VIP with 100+ points.' }}"
}
```

## Best Practices

1. **Use simple mode for basic substitutions**: `{{user.firstName}}` is faster than `{{= user.firstName }}`

2. **Use expression mode for calculations**: `{{= user.vars.points * 1.1 }}` requires expression mode

3. **Sanitize node labels**: Use simple labels without special characters for easier referencing

4. **Handle missing data**: Use `default()` function for optional fields:

   ```typescript
   {{= default(user.email, 'No email provided') }}
   ```

5. **Check node execution order**: Nodes can only reference outputs from previously executed nodes

6. **Use namespaces consistently**: Prefer `{{user.firstName}}` over legacy `{{firstName}}` for clarity

7. **Use wildcard dumps for debugging**: `{{path.*}}` returns the entire object at `path` as JSON:
   ```typescript
   // Debug all user variables
   {{user.vars.*}}
   // Returns: {"points":150,"tier":"premium","locale":"en"}

   // Debug entire node output
   {{nodes.Get_Customer.*}}
   // Returns: {"id":"cust_123","email":"john@example.com","name":"John"}
   ```

## Error Handling

The template system handles errors gracefully to prevent journey breakage:

### Missing Paths

When a path doesn't exist in the context, the behavior depends on the mode:

| Mode | Behavior | Example |
|------|----------|---------|
| Simple mode | Returns empty string | `{{user.nonExistent}}` → `""` |
| Expression mode | Returns empty string | `{{= user.nonExistent }}` → `""` |

### Nested Object Traversal

The `getNestedValue()` utility traverses objects using dot notation:

```typescript
// Given context:
{
  user: {
    profile: {
      settings: {
        theme: "dark"
      }
    }
  }
}

// Access deeply nested value:
{{user.profile.settings.theme}}  // → "dark"

// Missing intermediate path:
{{user.profile.missing.theme}}   // → "" (empty string, no error)
```

### Expression Errors

When an expression fails to evaluate (syntax error, runtime error), the template service:

1. Logs a warning with the error details
2. Returns empty string for that expression
3. Continues processing the rest of the template

```typescript
// Invalid expression (runtime error)
{{= nonExistentFunction(user.name) }}  // → "" (function not defined)

// Syntax error
{{= user.name + }}  // → "" (incomplete expression)
```

### Null vs Undefined

Both `null` and `undefined` values are converted to empty strings:

```typescript
{{user.vars.nullValue}}      // → ""
{{user.vars.undefinedValue}} // → ""
{{= default(user.vars.nullValue, 'fallback') }} // → "fallback"
```

## Backward Compatibility

### Agent Node Response Alias

For backward compatibility, accessing `.response` on agent node outputs automatically falls back to `.lastResponse`:

```typescript
// Old pattern (still works)
{{nodes.My_Agent.response}}

// Equivalent to
{{nodes.My_Agent.lastResponse}}
```

This alias allows existing templates to continue working after the agent output model was updated. New templates should prefer using `.lastResponse` explicitly.

## Implementation Details

### Context Building

Use `buildFullContext()` to construct the full context object:

```typescript
import { buildFullContext } from "@journey/engine";

// Build context with all namespaces populated
const context = buildFullContext(enhancedSession, variables, clientData);
```

For internal engine use, there's also an async `buildEvaluationContext()` that fetches variables automatically:

```typescript
// Internal use - fetches variables from services
import { buildEvaluationContext } from "@journey/engine/utils/context";

const context = await buildEvaluationContext(enhancedSession, services, clientData);
```

### Template Substitution

The `TemplateService` handles both modes:

```typescript
import { createTemplateService } from "@journey/engine";

const template = createTemplateService();
const result = template.substitute("Hello {{user.firstName}}", context);
```

### Node Output Storage

Nodes store outputs using `storeNodeOutput()`:

```typescript
import { storeNodeOutput } from "@journey/engine";

// After webhook execution
const result = await webhookExecutor.execute(...);
storeNodeOutput(session, node, result);
```

## See Also

- [Template Service API Reference](./README.md#template-service)
- [Expression Service API Reference](./README.md#expression-service)
