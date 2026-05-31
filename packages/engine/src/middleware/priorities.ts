/**
 * Middleware Priority Conventions
 *
 * Lower numbers execute first. Priorities are grouped by category:
 *
 * 0-19:   Reserved for system/security middleware
 * 20-39:  Data enrichment (tags, variables)
 * 40-59:  Integration middleware (CRM, webhooks)
 * 60-79:  Analytics/logging middleware
 * 80-99:  Cleanup/finalization middleware
 */

export const MIDDLEWARE_PRIORITIES = {
  // Data enrichment (20-39)
  TAGS: 20,
  VARIABLES: 25,

  // Integration (40-59)
  CRM: 50,

  // Analytics (60-79)
  ANALYTICS: 60,
} as const;

export function validateMiddlewarePriority(priority: number, name: string): void {
  const existing = Object.entries(MIDDLEWARE_PRIORITIES).find(([, value]) => value === priority);
  if (existing && existing[0] !== name) {
    throw new Error(`Middleware priority conflict: ${name} uses ${priority}, already used by ${existing[0]}`);
  }
}

