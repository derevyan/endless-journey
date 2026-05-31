/**
 * Todo List Middleware
 *
 * Injects a todo list tool that allows the agent to plan and track tasks.
 * Follows LangChain's TodoListMiddleware API.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#todo-list
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     createTodoListMiddleware({
 *       systemPrompt: "Break down complex tasks into smaller steps.",
 *     }),
 *   ],
 * });
 * ```
 */

import { z } from "zod";
import { createMiddleware } from "../create-middleware";
import { createLogger } from "@journey/logger";
import { getStateArray, generateId } from "../utils";
import type { AgentTool } from "../types";

const log = createLogger("llm:middleware:todo-list");

// ============================================================================
// Types
// ============================================================================

/**
 * A single todo item
 */
export interface TodoItem {
  /** Unique identifier for the todo */
  id: string;
  /** Description of the task */
  content: string;
  /** Current status */
  status: "pending" | "in_progress" | "completed" | "blocked";
  /** Priority (1 = highest) */
  priority?: number;
  /** Parent todo ID for subtasks */
  parentId?: string;
  /** When the todo was created */
  createdAt: string;
  /** When the todo was last updated */
  updatedAt: string;
  /** Optional notes or blockers */
  notes?: string;
}

/**
 * Configuration for Todo List middleware
 */
export interface TodoListMiddlewareConfig {
  /**
   * Additional system prompt instructions for task planning
   * Added to the agent's system prompt when middleware is active
   */
  systemPrompt?: string;

  /**
   * Custom description for the write_todos tool
   */
  toolDescription?: string;

  /**
   * Maximum number of todos allowed
   * @default 50
   */
  maxTodos?: number;

  /**
   * Whether to persist todos across agent invocations
   * Requires state persistence (checkpointer)
   * @default true
   */
  persist?: boolean;
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Zod schema for a todo item
 */
const todoItemSchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(500),
  status: z.enum(["pending", "in_progress", "completed", "blocked"]),
  priority: z.number().int().min(1).max(10).optional(),
  parentId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  notes: z.string().max(1000).optional(),
});

/**
 * State schema for todo list middleware
 */
const todoListStateSchema = z.object({
  /** List of all todos */
  _mwTodos: z.array(todoItemSchema).default([]),
});

/**
 * Schema for the write_todos tool input
 */
const writeTodosInputSchema = z.object({
  action: z.enum(["add", "update", "remove", "clear"]).describe(
    "Action to perform: add (create new), update (modify existing), remove (delete), clear (remove all)"
  ),
  todos: z.array(
    z.object({
      id: z.string().optional().describe("ID for update/remove (auto-generated for add)"),
      content: z.string().describe("Task description"),
      status: z.enum(["pending", "in_progress", "completed", "blocked"])
        .default("pending")
        .describe("Task status"),
      priority: z.number().int().min(1).max(10).optional()
        .describe("Priority (1=highest, 10=lowest)"),
      parentId: z.string().optional().describe("Parent todo ID for subtasks"),
      notes: z.string().optional().describe("Additional notes or blockers"),
    })
  ).optional().describe("Todos to add/update (not needed for clear action)"),
  ids: z.array(z.string()).optional().describe("IDs to remove (only for remove action)"),
});

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Create the write_todos tool
 */
function createWriteTodosTool(
  config: TodoListMiddlewareConfig,
  getCurrentTodos: () => TodoItem[],
  setTodos: (todos: TodoItem[]) => void
): AgentTool {
  const { maxTodos = 50, toolDescription } = config;

  return {
    name: "write_todos",
    description:
      toolDescription ||
      "Manage a todo list for planning and tracking tasks. Use this to break down complex work into steps, track progress, and organize subtasks. Actions: add (create), update (modify), remove (delete), clear (remove all).",
    schema: writeTodosInputSchema,

    execute: async (rawInput: unknown) => {
      // Parse and validate input
      const input = writeTodosInputSchema.parse(rawInput);
      const currentTodos = getCurrentTodos();
      const now = new Date().toISOString();

      switch (input.action) {
        case "add": {
          if (!input.todos || input.todos.length === 0) {
            return { success: false, error: "No todos provided for add action" };
          }

          // Check limit
          if (currentTodos.length + input.todos.length > maxTodos) {
            return {
              success: false,
              error: `Cannot add ${input.todos.length} todos. Would exceed limit of ${maxTodos}. Current count: ${currentTodos.length}`,
            };
          }

          const newTodos: TodoItem[] = input.todos.map((t) => ({
            id: generateId("todo"),
            content: t.content,
            status: t.status || "pending",
            priority: t.priority,
            parentId: t.parentId,
            createdAt: now,
            updatedAt: now,
            notes: t.notes,
          }));

          setTodos([...currentTodos, ...newTodos]);

          log.debug(
            { count: newTodos.length, total: currentTodos.length + newTodos.length },
            "middleware:todoList:added"
          );

          return {
            success: true,
            added: newTodos.map((t) => ({ id: t.id, content: t.content })),
            totalCount: currentTodos.length + newTodos.length,
          };
        }

        case "update": {
          if (!input.todos || input.todos.length === 0) {
            return { success: false, error: "No todos provided for update action" };
          }

          const updates = new Map(
            input.todos.filter((t) => t.id).map((t) => [t.id, t])
          );

          const updatedTodos = currentTodos.map((todo) => {
            const update = updates.get(todo.id);
            if (!update) return todo;

            return {
              ...todo,
              content: update.content ?? todo.content,
              status: update.status ?? todo.status,
              priority: update.priority ?? todo.priority,
              parentId: update.parentId ?? todo.parentId,
              notes: update.notes ?? todo.notes,
              updatedAt: now,
            };
          });

          setTodos(updatedTodos);

          log.debug(
            { count: updates.size },
            "middleware:todoList:updated"
          );

          return {
            success: true,
            updated: Array.from(updates.keys()),
            totalCount: updatedTodos.length,
          };
        }

        case "remove": {
          if (!input.ids || input.ids.length === 0) {
            return { success: false, error: "No IDs provided for remove action" };
          }

          const idsToRemove = new Set(input.ids);
          const remainingTodos = currentTodos.filter(
            (todo) => !idsToRemove.has(todo.id)
          );

          const removedCount = currentTodos.length - remainingTodos.length;
          setTodos(remainingTodos);

          log.debug(
            { removed: removedCount, remaining: remainingTodos.length },
            "middleware:todoList:removed"
          );

          return {
            success: true,
            removed: removedCount,
            totalCount: remainingTodos.length,
          };
        }

        case "clear": {
          const clearedCount = currentTodos.length;
          setTodos([]);

          log.debug({ cleared: clearedCount }, "middleware:todoList:cleared");

          return {
            success: true,
            cleared: clearedCount,
            totalCount: 0,
          };
        }

        default:
          return { success: false, error: `Unknown action: ${input.action}` };
      }
    },
  };
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a Todo List middleware
 *
 * Injects a `write_todos` tool that allows the agent to create and manage
 * a task list for planning and tracking work.
 *
 * @param config - Configuration options
 *
 * @example Basic usage
 * ```typescript
 * createTodoListMiddleware()
 * ```
 *
 * @example With custom instructions
 * ```typescript
 * createTodoListMiddleware({
 *   systemPrompt: "Always break down tasks into steps before starting.",
 *   maxTodos: 100,
 * })
 * ```
 *
 * @example With custom tool description
 * ```typescript
 * createTodoListMiddleware({
 *   toolDescription: "Track your work items and progress here.",
 * })
 * ```
 */
export function createTodoListMiddleware(
  config: TodoListMiddlewareConfig = {}
): ReturnType<typeof createMiddleware> {
  const { systemPrompt, persist = true } = config;

  // Temporary storage for todos (will be synced with state)
  let tempTodos: TodoItem[] = [];

  return createMiddleware({
    name: "TodoListMiddleware",
    priority: 25, // Run after other preprocessing, before tool calls
    stateSchema: todoListStateSchema,

    beforeAgent: (state) => {
      // Load todos from state if persisting
      if (persist) {
        tempTodos = getStateArray<TodoItem>(state, "_mwTodos");
      }

      // Add system prompt instructions if provided
      if (systemPrompt && state.systemPrompt) {
        const enhancedPrompt = `${state.systemPrompt}\n\n${systemPrompt}`;
        return { systemPrompt: enhancedPrompt };
      }

      return undefined;
    },

    beforeModel: (state, runtime) => {
      // Inject the write_todos tool
      const writeTodosTool = createWriteTodosTool(
        config,
        () => tempTodos,
        (todos) => {
          tempTodos = todos;
        }
      );

      // Check if tool already exists (avoid duplicates)
      const existingTools = (runtime.context._mwTools as AgentTool[]) || [];
      const hasWriteTodos = existingTools.some((t) => t.name === "write_todos");

      if (!hasWriteTodos) {
        runtime.context._mwTools = [...existingTools, writeTodosTool];

        log.trace(
          { todoCount: tempTodos.length },
          "middleware:todoList:toolInjected"
        );
      }

      return undefined;
    },

    afterAgent: (state) => {
      // Persist todos to state
      if (persist) {
        log.debug(
          { todoCount: tempTodos.length },
          "middleware:todoList:persisting"
        );

        return {
          _mwTodos: tempTodos,
        };
      }

      return undefined;
    },
  });
}
