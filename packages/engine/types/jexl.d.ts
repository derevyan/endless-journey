/**
 * Type declarations for jexl (JavaScript Expression Language)
 * Used by @journey/engine for expression evaluation
 */
declare module "jexl" {
  interface Jexl {
    eval(expression: string, context?: Record<string, unknown>): Promise<unknown>;
    evalSync(expression: string, context?: Record<string, unknown>): unknown;
    addFunction(name: string, fn: (...args: unknown[]) => unknown): void;
    addTransform(name: string, fn: (...args: unknown[]) => unknown): void;
  }

  const jexl: {
    Jexl: new () => Jexl;
  };

  export = jexl;
}

