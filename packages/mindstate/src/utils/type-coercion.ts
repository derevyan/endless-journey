import type { StateParameter } from "@journey/schemas";

/**
 * Coerce a raw value to the correct type based on parameter configuration
 */
export function coerceValue(rawValue: string | number | boolean, param: StateParameter): string | number | boolean {
  let val: string | number | boolean = rawValue;

  if (param.scaleType === "NUMERIC") {
    const parsed = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));
    if (isNaN(parsed)) {
      val = param.currentValue as number;
    } else {
      const min = param.min ?? 0;
      const max = param.max ?? 10;
      val = Math.max(min, Math.min(max, parsed));
    }
  } else if (param.scaleType === "BOOLEAN") {
    if (typeof rawValue === "boolean") {
      val = rawValue;
    } else {
      const normalized = String(rawValue).trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) {
        val = true;
      } else if (["false", "0", "no", "n"].includes(normalized)) {
        val = false;
      } else {
        val = param.currentValue as boolean;
      }
    }
  } else if (param.scaleType === "CATEGORICAL") {
    if (param.options) {
      // Case-insensitive match - LLMs often return different casing
      const normalizedInput = String(rawValue).trim().toLowerCase();
      const matchedOption = param.options.find((opt) => opt.toLowerCase() === normalizedInput);
      val = matchedOption ?? (param.currentValue as string);
    }
  }

  return val;
}
