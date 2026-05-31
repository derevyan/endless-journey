/**
 * JEXL Language Support for CodeMirror
 *
 * Provides syntax highlighting for JavaScript Expression Language (JEXL) expressions.
 * Supports:
 * - Template variables: {{user.name}}
 * - Operators: &&, ||, ===, !==, >, <, etc.
 * - Functions: includes(), upper(), lower(), etc.
 * - Literals: strings, numbers, booleans
 * - Property access: user.profile.name
 * - Ternary expressions: condition ? a : b
 * - Pipe transforms: value | upper
 *
 * @module components/ui/codemirror/languages/jexl
 */

import { LanguageSupport, StreamLanguage, StringStream } from "@codemirror/language";

// =============================================================================
// KNOWN TOKENS
// =============================================================================

/**
 * Known function names in the JEXL expression registry
 * These get highlighted as functions
 */
const KNOWN_FUNCTIONS = new Set([
  // String functions
  "upper",
  "lower",
  "trim",
  "capitalize",
  "length",
  "startsWith",
  "endsWith",
  "includes",
  // Array functions
  "first",
  "last",
  "join",
  // Number functions
  "round",
  "floor",
  "ceil",
  "abs",
  // Date functions
  "now",
  "formatDate",
  // Utility functions
  "default",
  "isEmpty",
  "json",
  "parse",
]);

/**
 * Boolean literals
 */
const BOOLEANS = new Set(["true", "false"]);

/**
 * Null-like values
 */
const NULL_LIKE = new Set(["null", "undefined"]);

// =============================================================================
// STREAM PARSER
// =============================================================================

interface JexlState {
  /** Are we inside a string? */
  inString: false | "'" | '"';
  /** Are we inside a template variable {{}}? */
  inTemplate: boolean;
}

/**
 * JEXL stream-based tokenizer
 */
const jexlStreamParser = {
  startState(): JexlState {
    return {
      inString: false,
      inTemplate: false,
    };
  },

  token(stream: StringStream, state: JexlState): string | null {
    // Handle string continuations
    if (state.inString) {
      const quote = state.inString;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === quote) {
          state.inString = false;
          break;
        }
        if (ch === "\\") {
          stream.next(); // Skip escaped character
        }
      }
      return "string";
    }

    // Skip whitespace
    if (stream.eatSpace()) {
      return null;
    }

    // Template variables: {{...}}
    if (stream.match("{{")) {
      state.inTemplate = true;
      // Consume until }}
      while (!stream.eol()) {
        if (stream.match("}}")) {
          state.inTemplate = false;
          break;
        }
        stream.next();
      }
      return "variableName special";
    }

    // Single character lookahead
    const ch = stream.peek();

    // Strings (single or double quoted)
    if (ch === '"' || ch === "'") {
      stream.next();
      state.inString = ch as "'" | '"';
      // Try to consume rest of string on this line
      while (!stream.eol()) {
        const c = stream.next();
        if (c === ch) {
          state.inString = false;
          break;
        }
        if (c === "\\") {
          stream.next();
        }
      }
      return "string";
    }

    // Numbers
    if (/[0-9]/.test(ch ?? "")) {
      stream.match(/^\d+(\.\d+)?([eE][+-]?\d+)?/);
      return "number";
    }

    // Three-character operators
    if (stream.match("===") || stream.match("!==")) {
      return "compareOperator";
    }

    // Two-character operators
    if (
      stream.match("==") ||
      stream.match("!=") ||
      stream.match(">=") ||
      stream.match("<=") ||
      stream.match("&&") ||
      stream.match("||") ||
      stream.match("??")
    ) {
      return stream.current().includes("&") || stream.current().includes("|") ? "logicOperator" : "compareOperator";
    }

    // Single-character operators
    if (ch === ">" || ch === "<" || ch === "!" || ch === "=" || ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%") {
      stream.next();
      return "operator";
    }

    // Ternary operators
    if (ch === "?" || ch === ":") {
      stream.next();
      return "operator";
    }

    // Pipe operator (for transforms)
    if (ch === "|") {
      stream.next();
      return "operator";
    }

    // Punctuation
    if (ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === "{" || ch === "}" || ch === "," || ch === ";") {
      stream.next();
      return "punctuation";
    }

    // Property access
    if (ch === ".") {
      stream.next();
      return "punctuation";
    }

    // Identifiers (variables, functions, booleans, etc.)
    if (stream.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/)) {
      const word = stream.current();

      // Check for function call (followed by opening paren)
      if (stream.peek() === "(" && KNOWN_FUNCTIONS.has(word)) {
        return "function variableName";
      }

      // Check for booleans
      if (BOOLEANS.has(word)) {
        return "bool";
      }

      // Check for null-like values
      if (NULL_LIKE.has(word)) {
        return "null";
      }

      // Regular identifier/property
      return "variableName";
    }

    // Unknown character - skip it
    stream.next();
    return null;
  },
};

/**
 * StreamLanguage definition for JEXL
 */
const jexlLanguageDef = StreamLanguage.define(jexlStreamParser);

/**
 * Create JEXL language support extension
 *
 * @example
 * ```tsx
 * const { containerRef } = useCodeMirror({
 *   value,
 *   onChange,
 *   language: jexlLanguage(),
 * });
 * ```
 */
export function jexlLanguage(): LanguageSupport {
  return new LanguageSupport(jexlLanguageDef);
}

/**
 * Export the raw language definition for advanced usage
 */
export { jexlLanguageDef };
