/**
 * Shared Form Registry
 *
 * Generic registry for node form handlers used by journey and workflow nodes.
 */

import type { z } from "zod";

/**
 * Form handlers for a specific node type.
 */
export interface FormHandlers<
  TNode,
  TValues = Record<string, unknown>,
  TData = Record<string, unknown>
> {
  /** Zod schema for form validation */
  schema: z.ZodType<TValues>;
  /** Extract default form values from node data */
  extract: (node: TNode) => TValues;
  /** Build node data from validated form values */
  build: (values: TValues, existingData?: TData) => TData;
}

/**
 * Form Registry class - stores form handlers for node types.
 */
export class FormRegistry<
  TNodeType extends string,
  TNode,
  TValues = Record<string, unknown>,
  TData = Record<string, unknown>
> {
  private handlers = new Map<TNodeType, FormHandlers<TNode, TValues, TData>>();

  /**
   * Register form handlers for a node type.
   */
  register(nodeType: TNodeType, handlers: FormHandlers<TNode, TValues, TData>): void {
    this.handlers.set(nodeType, handlers);
  }

  /**
   * Get form handlers for a node type.
   */
  getHandlers(nodeType: TNodeType): FormHandlers<TNode, TValues, TData> | undefined {
    return this.handlers.get(nodeType);
  }

  /**
   * Get schema for a node type.
   */
  getSchema(nodeType: TNodeType): z.ZodType<TValues> | undefined {
    return this.handlers.get(nodeType)?.schema;
  }

  /**
   * Get extractor function for a node type.
   */
  getExtractor(nodeType: TNodeType): ((node: TNode) => TValues) | undefined {
    return this.handlers.get(nodeType)?.extract;
  }

  /**
   * Get builder function for a node type.
   */
  getBuilder(nodeType: TNodeType): ((values: TValues, existingData?: TData) => TData) | undefined {
    return this.handlers.get(nodeType)?.build;
  }

  /**
   * Check if a node type has registered form handlers.
   */
  has(nodeType: TNodeType): boolean {
    return this.handlers.has(nodeType);
  }

  /**
   * Get all registered node types.
   */
  getRegisteredTypes(): TNodeType[] {
    return Array.from(this.handlers.keys());
  }
}
