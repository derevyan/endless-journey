/**
 * Node Outputs Store (DB Integration)
 *
 * Persists node execution outputs in the node_outputs table.
 * Critical for recovering stateful handler state (Agent, Questionnaire)
 * when Redis cache expires after 30 minutes of inactivity.
 *
 * @module engine-integrations/node-outputs-store
 */

import { queryClient } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import type { NodeOutput } from "@journey/schemas";

const log = createLogger("engine:node-outputs-store");

function normalizeExecutedAt(value: string | Date | number | null | undefined): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Interface for nodeOutputs map (session.nodeOutputs)
 */
export type NodeOutputsMap = Record<string, NodeOutput>;

/**
 * Node Outputs Store interface
 */
export interface NodeOutputsStore {
  /**
   * Load all nodeOutputs for a session from DB
   * @param sessionId - The session ID
   * @returns Map of sanitized label → NodeOutput
   */
  loadOutputs(sessionId: string): Promise<NodeOutputsMap>;

  /**
   * Save all nodeOutputs for a session to DB (upsert)
   * @param sessionId - The session ID
   * @param outputs - Map of sanitized label → NodeOutput
   */
  saveOutputs(sessionId: string, outputs: NodeOutputsMap): Promise<void>;

  /**
   * Clear all nodeOutputs for a session
   * @param sessionId - The session ID
   */
  clearOutputs(sessionId: string): Promise<void>;
}

/**
 * Create a node outputs store for persisting handler state
 *
 * @example
 * ```typescript
 * const store = createNodeOutputsStore();
 *
 * // Load outputs on cache miss
 * const outputs = await store.loadOutputs(sessionId);
 *
 * // Save outputs after processing
 * await store.saveOutputs(sessionId, session.nodeOutputs);
 * ```
 */
export function createNodeOutputsStore(): NodeOutputsStore {
  return {
    async loadOutputs(sessionId: string): Promise<NodeOutputsMap> {
      const rows = await queryClient`
        SELECT sanitized_label, node_id, node_label, node_type, data, executed_at
        FROM node_outputs
        WHERE session_id = ${sessionId}
      `;

      if (rows.length === 0) {
        log.debug({ sessionId }, "nodeOutputs:loadEmpty");
        return {};
      }

      const outputs: NodeOutputsMap = {};
      for (const row of rows) {
        // executed_at is stored as ISO string in DB, handle both Date and string
        const executedAt = typeof row.executed_at === 'string'
          ? row.executed_at
          : (row.executed_at instanceof Date)
            ? row.executed_at.toISOString()
            : String(row.executed_at);

        outputs[row.sanitized_label as string] = {
          nodeId: row.node_id as string,
          nodeLabel: (row.node_label as string | null) ?? "",
          nodeType: (row.node_type as string | null) ?? "",
          executedAt: executedAt,
          data: row.data as unknown,
        };
      }

      log.debug({ sessionId, count: rows.length }, "nodeOutputs:loaded");
      return outputs;
    },

    async saveOutputs(sessionId: string, outputs: NodeOutputsMap): Promise<void> {
      const entries = Object.entries(outputs);
      if (entries.length === 0) {
        return;
      }

      // Helper to recursively convert Dates to ISO strings for JSON serialization
      function replaceDates(_key: string, value: any): any {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }

      // Use batch upsert for efficiency
      for (const [sanitizedLabel, output] of entries) {
        try {
          // Serialize data with proper Date handling (convert Dates to ISO strings)
          const dataJson = JSON.stringify(output.data, replaceDates);

          // Ensure executedAt is always a string for postgres
          // (schema expects z.iso.datetime() which parses to string, but be defensive)
          const executedAt = typeof output.executedAt === 'string'
            ? output.executedAt
            : String(output.executedAt);

          await queryClient`
            INSERT INTO node_outputs (
              session_id, sanitized_label, node_id, node_label, node_type, data, executed_at, updated_at
            )
            VALUES (
              ${sessionId},
              ${sanitizedLabel},
              ${output.nodeId},
              ${output.nodeLabel ?? null},
              ${output.nodeType ?? null},
              ${dataJson}::jsonb,
              ${executedAt},
              NOW()
            )
            ON CONFLICT (session_id, sanitized_label)
            DO UPDATE SET
              node_id = EXCLUDED.node_id,
              node_label = EXCLUDED.node_label,
              node_type = EXCLUDED.node_type,
              data = EXCLUDED.data,
              executed_at = EXCLUDED.executed_at,
              updated_at = NOW()
          `;
        } catch (error) {
          log.error(
            {
              err: serializeError(error),
              sessionId,
              sanitizedLabel,
              nodeId: output.nodeId,
              nodeType: output.nodeType
            },
            "nodeOutputs:saveOutputs:failed"
          );
          throw error; // Re-throw so caller knows persistence failed
        }
      }

      log.debug({ sessionId, count: entries.length }, "nodeOutputs:saved");
    },

    async clearOutputs(sessionId: string): Promise<void> {
      await queryClient`
        DELETE FROM node_outputs
        WHERE session_id = ${sessionId}
      `;

      log.info({ sessionId }, "nodeOutputs:cleared");
    },
  };
}
