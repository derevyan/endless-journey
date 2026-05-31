/**
 * Permission Audit Logging
 *
 * Utilities for tracking and logging permission checks.
 * Useful for debugging, compliance, and security monitoring.
 *
 * @module permissions/audit
 */

import type { PermissionSubject } from "./subjects";
import type { PermissionResource } from "./resources";
import {
  PermissionChecker,
  type PermissionCheckResult,
  type PermissionCheckerOptions,
} from "./checker";
import type { CapabilityDeclaration } from "./capabilities";

// =============================================================================
// AUDIT LOG ENTRY
// =============================================================================

/**
 * A single permission audit log entry.
 */
export interface PermissionAuditEntry {
  /** Timestamp of the check */
  timestamp: Date;

  /** Subject requesting access */
  subject: PermissionSubject;

  /** Resource being accessed */
  resource: PermissionResource;

  /** Result of the permission check */
  result: PermissionCheckResult;

  /** Duration of the check in milliseconds */
  durationMs?: number;

  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Audit log consumer interface.
 * Implement this to handle audit log entries.
 */
export interface AuditLogConsumer {
  /** Log a permission check */
  log(entry: PermissionAuditEntry): void;

  /** Flush any buffered entries */
  flush?(): Promise<void>;
}

// =============================================================================
// AUDIT LOG CONSUMERS
// =============================================================================

/**
 * In-memory audit logger for testing.
 * Collects all entries for later inspection.
 */
export class InMemoryAuditLogger implements AuditLogConsumer {
  private entries: PermissionAuditEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  log(entry: PermissionAuditEntry): void {
    this.entries.push(entry);

    // Limit memory usage
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /** Get all logged entries */
  getEntries(): readonly PermissionAuditEntry[] {
    return this.entries;
  }

  /** Get denied entries only */
  getDeniedEntries(): readonly PermissionAuditEntry[] {
    return this.entries.filter((e) => !e.result.allowed);
  }

  /** Get entries for a specific subject */
  getEntriesForSubject(subjectId: string): readonly PermissionAuditEntry[] {
    return this.entries.filter((e) => e.subject.id === subjectId);
  }

  /** Clear all entries */
  clear(): void {
    this.entries = [];
  }

  /** Get entry count */
  count(): number {
    return this.entries.length;
  }

  /** Get denied count */
  deniedCount(): number {
    return this.entries.filter((e) => !e.result.allowed).length;
  }
}

/**
 * Callback-based audit logger.
 * Calls a function for each entry.
 */
export class CallbackAuditLogger implements AuditLogConsumer {
  constructor(
    private readonly callback: (entry: PermissionAuditEntry) => void
  ) {}

  log(entry: PermissionAuditEntry): void {
    this.callback(entry);
  }
}

// =============================================================================
// AUDITING CHECKER WRAPPER
// =============================================================================

/**
 * Create an auditing permission checker that logs all permission checks.
 *
 * @param subject - Permission subject
 * @param capabilities - Capability declaration
 * @param consumer - Audit log consumer
 * @param options - Checker options
 * @returns Permission checker with auditing
 */
export function createAuditingChecker(
  subject: PermissionSubject,
  capabilities: CapabilityDeclaration,
  consumer: AuditLogConsumer,
  options: Omit<PermissionCheckerOptions, "onCheck"> = {}
): PermissionChecker {
  return new PermissionChecker(subject, capabilities, {
    ...options,
    onCheck: (
      subj: PermissionSubject,
      resource: PermissionResource,
      result: PermissionCheckResult
    ) => {
      consumer.log({
        timestamp: new Date(),
        subject: subj,
        resource,
        result,
        durationMs: result.durationMs,
      });
    },
  });
}

// =============================================================================
// PERMISSION SUMMARY UTILITIES
// =============================================================================

/**
 * Generate a summary of permission usage from audit entries.
 */
export interface PermissionUsageSummary {
  /** Total number of checks */
  totalChecks: number;

  /** Number of allowed checks */
  allowedCount: number;

  /** Number of denied checks */
  deniedCount: number;

  /** Denial rate (0-1) */
  denialRate: number;

  /** Most common actions requested */
  topActions: Array<{ action: string; count: number }>;

  /** Most common denial reasons */
  topDenialReasons: Array<{ reason: string; count: number }>;

  /** Subjects with most denials */
  subjectsWithMostDenials: Array<{ subjectId: string; count: number }>;
}

/**
 * Generate a permission usage summary from audit entries.
 */
export function generatePermissionSummary(
  entries: readonly PermissionAuditEntry[]
): PermissionUsageSummary {
  const totalChecks = entries.length;
  const allowedCount = entries.filter((e) => e.result.allowed).length;
  const deniedCount = totalChecks - allowedCount;

  // Count actions
  const actionCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.resource.action) {
      const current = actionCounts.get(entry.resource.action) ?? 0;
      actionCounts.set(entry.resource.action, current + 1);
    }
  }

  // Count denial reasons
  const reasonCounts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.result.allowed && entry.result.reason) {
      const current = reasonCounts.get(entry.result.reason) ?? 0;
      reasonCounts.set(entry.result.reason, current + 1);
    }
  }

  // Count denials per subject
  const subjectDenials = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.result.allowed) {
      const current = subjectDenials.get(entry.subject.id) ?? 0;
      subjectDenials.set(entry.subject.id, current + 1);
    }
  }

  return {
    totalChecks,
    allowedCount,
    deniedCount,
    denialRate: totalChecks > 0 ? deniedCount / totalChecks : 0,
    topActions: [...actionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count })),
    topDenialReasons: [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count })),
    subjectsWithMostDenials: [...subjectDenials.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([subjectId, count]) => ({ subjectId, count })),
  };
}
