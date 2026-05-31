/**
 * Expression Function Registry
 *
 * Centralized registry for JEXL functions and transforms used across the engine.
 * Keeps expression behavior consistent across templates, guards, conditions, and questionnaire skip rules.
 */

type ExpressionFunction = (...args: unknown[]) => unknown;
type ExpressionTransform = (value: unknown) => unknown;

const upper = (s: unknown): string => String(s ?? "").toUpperCase();
const lower = (s: unknown): string => String(s ?? "").toLowerCase();
const trim = (s: unknown): string => String(s ?? "").trim();
const capitalize = (s: unknown): string => {
  const str = String(s ?? "");
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
const length = (s: unknown): number => (Array.isArray(s) ? s.length : String(s ?? "").length);

const first = (arr: unknown): unknown => (Array.isArray(arr) ? arr[0] : undefined);
const last = (arr: unknown): unknown => (Array.isArray(arr) ? arr[arr.length - 1] : undefined);

const FUNCTION_REGISTRY: Array<{ name: string; fn: ExpressionFunction }> = [
  // String
  { name: "upper", fn: upper },
  { name: "lower", fn: lower },
  { name: "trim", fn: trim },
  { name: "capitalize", fn: capitalize },
  { name: "length", fn: length },
  // Conditional
  { name: "default", fn: (val: unknown, fallback: unknown) => val ?? fallback },
  { name: "isEmpty", fn: (val: unknown) => val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0) },
  // Array
  { name: "first", fn: first },
  { name: "last", fn: last },
  { name: "join", fn: (arr: unknown, sep: unknown) => (Array.isArray(arr) ? arr.join(String(sep ?? ", ")) : String(arr)) },
  { name: "includes", fn: (arr: unknown, item: unknown) => (Array.isArray(arr) ? arr.includes(item) : String(arr).includes(String(item))) },
  { name: "startsWith", fn: (str: unknown, prefix: unknown) => String(str ?? "").startsWith(String(prefix ?? "")) },
  { name: "endsWith", fn: (str: unknown, suffix: unknown) => String(str ?? "").endsWith(String(suffix ?? "")) },
  // Number
  {
    name: "round",
    fn: (n: unknown, decimals: unknown) => {
      const num = Number(n);
      if (isNaN(num)) return NaN;
      const dec = Math.max(0, Math.min(100, Math.floor(Number(decimals ?? 0))));
      return Number(num.toFixed(dec));
    },
  },
  { name: "floor", fn: (n: unknown) => (isNaN(Number(n)) ? NaN : Math.floor(Number(n))) },
  { name: "ceil", fn: (n: unknown) => (isNaN(Number(n)) ? NaN : Math.ceil(Number(n))) },
  { name: "abs", fn: (n: unknown) => (isNaN(Number(n)) ? NaN : Math.abs(Number(n))) },
  // Date
  { name: "now", fn: () => new Date().toISOString() },
  {
    name: "formatDate",
    fn: (date: unknown, format: unknown) => {
      const d = new Date(String(date));
      const fmt = String(format ?? "YYYY-MM-DD");
      return fmt
        .replace("YYYY", d.getFullYear().toString())
        .replace("MM", (d.getMonth() + 1).toString().padStart(2, "0"))
        .replace("DD", d.getDate().toString().padStart(2, "0"));
    },
  },
  // JSON
  { name: "json", fn: (obj: unknown) => JSON.stringify(obj) },
  {
    name: "parse",
    fn: (s: unknown) => {
      try {
        return JSON.parse(String(s));
      } catch {
        return null;
      }
    },
  },
];

const TRANSFORM_REGISTRY: Array<{ name: string; fn: ExpressionTransform }> = [
  { name: "upper", fn: upper },
  { name: "lower", fn: lower },
  { name: "trim", fn: trim },
  { name: "first", fn: first },
  { name: "last", fn: last },
  { name: "length", fn: length },
];

export interface ExpressionRegistryEngine {
  addFunction(name: string, fn: ExpressionFunction): void;
  addTransform(name: string, fn: ExpressionTransform): void;
}

export function registerExpressionFunctions(engine: ExpressionRegistryEngine): void {
  for (const entry of FUNCTION_REGISTRY) {
    engine.addFunction(entry.name, entry.fn);
  }
  for (const entry of TRANSFORM_REGISTRY) {
    engine.addTransform(entry.name, entry.fn);
  }
}

export function getExpressionFunctionNames(): string[] {
  return FUNCTION_REGISTRY.map((entry) => entry.name);
}
