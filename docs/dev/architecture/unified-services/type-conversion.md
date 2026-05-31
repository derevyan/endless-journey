# Type Conversion Utilities

> Consistent type conversion for conditions, expressions, and comparisons.

## Overview

Type conversion utilities ensure consistent behavior when evaluating conditions and expressions across the journey engine, LLM workflows, and condition nodes. These utilities handle edge cases like empty strings, null values, and type coercion.

**Location:** `packages/schemas/src/variables.ts`

---

## Functions

### isEmpty(value)

Checks if a value is "empty" - useful for determining if a user provided input.

```typescript
function isEmpty(value: unknown): boolean;
```

**Empty values:**

- `null`
- `undefined`
- `""` (empty string)
- `"   "` (whitespace-only string)
- `[]` (empty array)
- `{}` (empty object)

**NOT empty:**

- `0` (valid number)
- `false` (valid boolean)
- `"0"` (non-empty string)
- `NaN` (it's a value, even if invalid)

```typescript
import { isEmpty } from "@journey/schemas";

isEmpty(null); // true
isEmpty(undefined); // true
isEmpty(""); // true
isEmpty("   "); // true
isEmpty([]); // true
isEmpty({}); // true

isEmpty(0); // false (0 is a valid value)
isEmpty(false); // false (false is a valid value)
isEmpty("0"); // false (non-empty string)
isEmpty([null]); // false (array has an element)
isEmpty({ a: null }); // false (object has a key)
```

---

### isTruthy(value)

Checks if a value is "truthy" - useful for boolean conditions.

```typescript
function isTruthy(value: unknown): boolean;
```

**Falsy values:**

- `null`
- `undefined`
- `false`
- `0`
- `""` (empty string)
- `"   "` (whitespace-only string)
- `[]` (empty array)
- `NaN`

**Truthy values:**

- `true`
- Non-zero numbers (including negative, Infinity)
- Non-empty strings (including `"false"`, `"0"`)
- Non-empty arrays
- Objects (even `{}`)
- Functions

```typescript
import { isTruthy } from "@journey/schemas";

// Falsy
isTruthy(null); // false
isTruthy(undefined); // false
isTruthy(false); // false
isTruthy(0); // false
isTruthy(""); // false
isTruthy([]); // false

// Truthy
isTruthy(true); // true
isTruthy(1); // true
isTruthy("hello"); // true
isTruthy("false"); // true (non-empty string!)
isTruthy("0"); // true (non-empty string!)
isTruthy({}); // true (objects are truthy)
isTruthy([1]); // true (non-empty array)
```

**Important:** The string `"false"` is truthy because it's a non-empty string. If you need to handle boolean strings, parse them explicitly.

---

### toNumber(value)

Converts a value to a number safely.

```typescript
function toNumber(value: unknown): number;
```

**Conversion rules:**

- Numbers: returned as-is (NaN → 0)
- Strings: parsed with parseFloat (non-numeric → 0)
- Booleans: true → 1, false → 0
- null/undefined: 0
- Objects/arrays: 0

```typescript
import { toNumber } from "@journey/schemas";

// Numbers
toNumber(42); // 42
toNumber(3.14); // 3.14
toNumber(-5); // -5
toNumber(NaN); // 0 (NaN becomes 0)
toNumber(Infinity); // Infinity

// Strings
toNumber("42"); // 42
toNumber("3.14"); // 3.14
toNumber("123abc"); // 123 (parseFloat behavior)
toNumber("hello"); // 0
toNumber(""); // 0

// Booleans
toNumber(true); // 1
toNumber(false); // 0

// Other
toNumber(null); // 0
toNumber(undefined); // 0
toNumber({}); // 0
toNumber([1, 2]); // 0
```

---

### toString(value)

Converts a value to a string safely.

```typescript
function toString(value: unknown): string;
```

**Conversion rules:**

- Strings: returned as-is
- Numbers/booleans: String() conversion
- null/undefined: "" (empty string)
- Objects/arrays: JSON.stringify()

```typescript
import { toString } from "@journey/schemas";

// Primitives
toString("hello"); // "hello"
toString(42); // "42"
toString(true); // "true"
toString(false); // "false"

// Nullish
toString(null); // ""
toString(undefined); // ""

// Objects/arrays
toString({ a: 1 }); // '{"a":1}'
toString([1, 2, 3]); // "[1,2,3]"
toString({}); // "{}"
toString([]); // "[]"
```

---

### toExprEvalContext(context)

Converts a context object to expr-eval compatible format.

```typescript
function toExprEvalContext(context: Record<string, unknown>): Record<string, string | number>;
```

The expr-eval library only supports strings and numbers. This function converts:

- Booleans → 1/0
- null/undefined → 0
- NaN → 0
- Objects/arrays → JSON strings

```typescript
import { toExprEvalContext } from "@journey/schemas";

const result = toExprEvalContext({
  active: true,
  count: 5,
  name: "John",
  data: null,
  items: [1, 2],
});

// Result:
{
  active: 1,      // boolean → number
  count: 5,       // number preserved
  name: "John",   // string preserved
  data: 0,        // null → 0
  items: "[1,2]", // array → JSON string
}
```

---

### prepareForCondition(value)

Prepares a value for use in condition expressions.

```typescript
function prepareForCondition(value: unknown): string | number;
```

**Conversion rules:**

- Numbers: returned as-is (NaN → 0)
- Strings: returned as-is
- Booleans: true → 1, false → 0
- null/undefined: 0
- Arrays: length (for "has items" checks)
- Objects: key count (for "has properties" checks)

```typescript
import { prepareForCondition } from "@journey/schemas";

// Primitives
prepareForCondition(42); // 42
prepareForCondition("hello"); // "hello"
prepareForCondition(true); // 1
prepareForCondition(false); // 0

// Nullish
prepareForCondition(null); // 0
prepareForCondition(undefined); // 0

// Arrays (return length)
prepareForCondition([1, 2, 3]); // 3
prepareForCondition([]); // 0

// Objects (return key count)
prepareForCondition({ a: 1, b: 2 }); // 2
prepareForCondition({}); // 0
```

This is particularly useful for conditions like:

- `items > 0` (check if array has elements)
- `properties > 0` (check if object has keys)

---

## Use Cases

### Condition Node Evaluation

```typescript
import { toExprEvalContext, prepareForCondition } from "@journey/schemas";

// Prepare context for expr-eval
const context = toExprEvalContext({
  hasConsented: true, // → 1
  orderTotal: 99.99, // → 99.99
  items: ["a", "b"], // → "[\"a\",\"b\"]"
  itemCount: prepareForCondition(["a", "b"]), // → 2
});

// Now safe for expr-eval
const result = evaluate("hasConsented == 1 && orderTotal > 50", context);
```

### Form Validation

```typescript
import { isEmpty, isTruthy } from "@journey/schemas";

function validateForm(data: FormData) {
  const errors: string[] = [];

  if (isEmpty(data.name)) {
    errors.push("Name is required");
  }

  if (!isTruthy(data.acceptedTerms)) {
    errors.push("You must accept the terms");
  }

  return errors;
}
```

### Variable Assignment

```typescript
import { toNumber, toString } from "@journey/schemas";

// Safe number operations
const total = toNumber(vars.orderTotal) + toNumber(vars.shipping);

// Safe string concatenation
const message = `Hello, ${toString(vars.firstName) || "Guest"}!`;
```

---

## Edge Cases

### String "false" and "0"

These are **truthy** because they're non-empty strings:

```typescript
isTruthy("false"); // true
isTruthy("0"); // true
```

If you need to handle boolean strings:

```typescript
function parseBooleanString(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return isTruthy(value);
}
```

### Empty Objects vs Empty Arrays

```typescript
isEmpty({}); // true
isEmpty([]); // true

isTruthy({}); // true (objects are truthy!)
isTruthy([]); // false (empty arrays are falsy)
```

### NaN Handling

```typescript
isEmpty(NaN); // false (it's a value)
isTruthy(NaN); // false
toNumber(NaN); // 0
prepareForCondition(NaN); // 0
```

---

## Testing

All utilities have comprehensive tests:

```
packages/schemas/src/__tests__/type-conversion.test.ts
- 72 tests covering all functions and edge cases
```

---

## See Also

- [Variable Namespaces](./variable-namespaces.md) - Variable access patterns
- [Service Interfaces](./service-interfaces.md) - IExpressionService
- [Condition Node](../../../engine/nodes/condition.md) - Condition evaluation
