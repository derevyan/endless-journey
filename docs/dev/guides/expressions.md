# Expression System (JEXL)

> Complete guide to using expressions in Journey Builder for templates, conditions, and guards.

---

## Overview

Journey uses **JEXL (JavaScript Expression Language)** as the unified expression engine. Expressions are used in:

- **Templates**: `{{= upper(user.firstName) }}`
- **Condition nodes**: `user.score > 50 && user.plan == 'Pro'`
- **Edge guards**: `user.hasCompletedOnboarding`
- **Questionnaire skip conditions**: `user.isAdult && score > 75`
- **Automation triggers**: `value >= 100`

---

## Quick Reference

### Basic Syntax

```javascript
// Variable access
user.firstName
session.score

// Comparisons
value > 100
status == 'active'
tags != 'banned'

// Logical operators
isActive && score > 50
role == 'admin' || role == 'moderator'
!isBlocked

// Ternary expressions
score > 50 ? 'high' : 'low'
```

### JavaScript Compatibility

Journey automatically converts common JavaScript method calls to JEXL syntax:

| JavaScript Style | JEXL Equivalent |
|-----------------|-----------------|
| `name.includes('Pro')` | `includes(name, 'Pro')` |
| `text.startsWith('Hello')` | `startsWith(text, 'Hello')` |
| `text.endsWith('!')` | `endsWith(text, '!')` |
| `name.toUpperCase()` | `upper(name)` |
| `name.toLowerCase()` | `lower(name)` |
| `name.trim()` | `trim(name)` |
| `items.length` | `length(items)` |

---

## Available Functions

### String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `upper(s)` | Convert to uppercase | `upper('hello')` → `'HELLO'` |
| `lower(s)` | Convert to lowercase | `lower('HELLO')` → `'hello'` |
| `trim(s)` | Remove whitespace | `trim('  hi  ')` → `'hi'` |
| `capitalize(s)` | Capitalize first letter | `capitalize('hello')` → `'Hello'` |
| `length(s)` | Get string/array length | `length('abc')` → `3` |
| `includes(s, sub)` | Check if contains substring | `includes('hello', 'ell')` → `true` |
| `startsWith(s, pre)` | Check if starts with | `startsWith('hello', 'he')` → `true` |
| `endsWith(s, suf)` | Check if ends with | `endsWith('hello', 'lo')` → `true` |

### Array Functions

| Function | Description | Example |
|----------|-------------|---------|
| `first(arr)` | Get first element | `first([1,2,3])` → `1` |
| `last(arr)` | Get last element | `last([1,2,3])` → `3` |
| `join(arr, sep)` | Join elements | `join(['a','b'], '-')` → `'a-b'` |
| `includes(arr, item)` | Check if contains | `includes(['a','b'], 'a')` → `true` |
| `length(arr)` | Get array length | `length([1,2,3])` → `3` |

### Number Functions

| Function | Description | Example |
|----------|-------------|---------|
| `round(n, decimals?)` | Round number | `round(3.456, 2)` → `3.46` |
| `floor(n)` | Round down | `floor(3.9)` → `3` |
| `ceil(n)` | Round up | `ceil(3.1)` → `4` |
| `abs(n)` | Absolute value | `abs(-5)` → `5` |

### Date Functions

| Function | Description | Example |
|----------|-------------|---------|
| `now()` | Current ISO timestamp | `now()` → `'2025-01-15T...'` |
| `formatDate(d, fmt?)` | Format date | `formatDate(date, 'YYYY-MM-DD')` |

Format tokens: `YYYY` (year), `MM` (month), `DD` (day)

### Utility Functions

| Function | Description | Example |
|----------|-------------|---------|
| `default(val, fallback)` | Default if null/undefined | `default(name, 'Guest')` |
| `isEmpty(val)` | Check if empty/null | `isEmpty('')` → `true` |
| `json(obj)` | Convert to JSON string | `json({a:1})` → `'{"a":1}'` |
| `parse(s)` | Parse JSON string | `parse('{"a":1}')` → `{a:1}` |

---

## Transform Syntax (Pipe Chaining)

JEXL supports pipe-style transforms for chaining operations:

```javascript
// Single transform
user.firstName | upper      // → 'JOHN'

// Chained transforms
user.input | trim | lower   // → 'hello world'

// With array access
user.tags | first           // → 'vip'
```

Available transforms: `upper`, `lower`, `trim`, `first`, `last`, `length`

---

## Context Variables

### Common Context Objects

When writing expressions, these context objects are typically available:

```javascript
// User properties
user.id
user.firstName
user.email
user.tags         // Array of strings

// Session state
session.currentNode
session.score
session.variables

// Journey-specific variables
score
selectedPlan
responses
```

### In Templates

Templates use the `{{= expression }}` syntax:

```handlebars
Hello, {{= user.firstName }}!
Your score is {{= session.score | round }}.
Status: {{= score > 100 ? 'Premium' : 'Standard' }}
```

### In Conditions

Conditions evaluate to boolean (truthy/falsy):

```javascript
// Simple comparisons
user.score >= 100
user.plan == 'Enterprise'

// Complex conditions
user.isActive && user.score > 50
user.role == 'admin' || includes(user.permissions, 'manage_users')

// Nested property access
user.profile.settings.notifications == true
```

---

## Operators

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal | `status == 'active'` |
| `!=` | Not equal | `role != 'guest'` |
| `>` | Greater than | `score > 100` |
| `>=` | Greater or equal | `score >= 100` |
| `<` | Less than | `score < 50` |
| `<=` | Less or equal | `score <= 50` |

### Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `&&` | AND | `a > 0 && b > 0` |
| `\|\|` | OR | `isAdmin \|\| isMod` |
| `!` | NOT | `!isBlocked` |

### Arithmetic Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Add | `score + 10` |
| `-` | Subtract | `total - discount` |
| `*` | Multiply | `price * quantity` |
| `/` | Divide | `total / count` |
| `%` | Modulo | `index % 2` |

---

## Common Patterns

### Membership Level Routing

```javascript
// In condition node expression
includes(user.plan, 'Enterprise') || includes(user.plan, 'enterprise')
  ? 'enterprise'
  : includes(user.plan, 'Pro') || includes(user.plan, 'pro')
    ? 'pro'
    : 'basic'
```

### Threshold-Based Triggers

```javascript
// Score threshold
score >= 100

// Multiple conditions
score >= 100 && user.isVerified

// Range check
age >= 18 && age <= 65
```

### String Matching

```javascript
// Contains check
includes(email, '@company.com')

// Prefix/suffix
startsWith(orderId, 'ORD-')
endsWith(filename, '.pdf')
```

### Tag Checks

```javascript
// Has specific tag
includes(user.tags, 'vip')

// Multiple tag check
includes(user.tags, 'premium') && !includes(user.tags, 'suspended')
```

### Default Values

```javascript
// Fallback for missing data
default(user.nickname, user.firstName)

// Empty check with fallback
isEmpty(user.phone) ? 'No phone' : user.phone
```

---

## Error Handling

Expressions gracefully handle errors:

- **Invalid syntax**: Returns `false` (logs warning)
- **Missing variables**: Returns `undefined` (evaluates as falsy)
- **Type mismatches**: Automatic type coercion when possible

```javascript
// Safe - missing property returns undefined
user.profile?.settings?.theme    // undefined if any part missing

// Safe - null comparison
value == null                    // true if null or undefined
!value                          // true if falsy (null, undefined, '', 0, false)
```

---

## Debugging Tips

### Test Expressions in Console

```typescript
import { evaluateExpressionSync } from "@journey/engine";

const result = evaluateExpressionSync(
  "includes(user.plan, 'Pro')",
  { user: { plan: 'Pro Plan' } }
);
console.log(result); // true
```

### Check Available Functions

```typescript
import { getAvailableFunctions } from "@journey/engine";

console.log(getAvailableFunctions());
// ['upper', 'lower', 'trim', 'capitalize', 'length', ...]
```

---

## Migration Notes

### From expr-eval

If migrating expressions from `expr-eval`:

| expr-eval | JEXL |
|-----------|------|
| `and` | `&&` |
| `or` | `\|\|` |
| `not` | `!` |
| Boolean strings (`"true"`) | Native booleans (`true`) |

---

## Related Documentation

- [Template Service](/docs/engine/templates.md)
- [Condition Nodes](/docs/dev/guides/adding-new-node-type.md)
- [Edge Guards](/docs/dev/architecture/edge-guards.md)
