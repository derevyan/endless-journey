/**
 * ApiVariableService - Integration Tests
 *
 * Uses real database operations to validate variable CRUD behavior
 * and event publishing in realistic scenarios.
 */

import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@journey/db";
import { organization, variables } from "@journey/db/schema";
import type { IEventPublisher } from "../../../../services/interfaces";

import { ApiVariableService } from "../variable-service";

function createMockPublisher(): { publisher: IEventPublisher; changed: ReturnType<typeof vi.fn> } {
  const changed = vi.fn(async () => {});
  const noop = vi.fn(async () => {});

  const publisher = {
    variable: { changed },
    tag: {
      added: noop,
      removed: noop,
      definitionCreated: noop,
      definitionUpdated: noop,
      definitionDeleted: noop,
    },
    crm: {
      stageChanged: noop,
      stageCreated: noop,
      stageUpdated: noop,
      stageDeleted: noop,
      stagesReordered: noop,
      pipelineEntered: noop,
      pipelineExited: noop,
      pipelineCreated: noop,
      pipelineUpdated: noop,
      pipelineDeleted: noop,
      pipelineDefaultSet: noop,
      fieldUpdated: noop,
      messageSent: noop,
      actionExecuted: noop,
      actionFailed: noop,
    },
    bot: {
      created: noop,
      updated: noop,
      deleted: noop,
      activated: noop,
      deactivated: noop,
      webhookRegistered: noop,
    },
    journey: {
      created: noop,
      updated: noop,
      deleted: noop,
      activated: noop,
      deactivated: noop,
      sessionStarted: noop,
      sessionCompleted: noop,
      scheduleFired: noop,
      webhookReceived: noop,
    },
    workflow: {
      started: noop,
      completed: noop,
      error: noop,
      stepStarted: noop,
      stepCompleted: noop,
      stepError: noop,
      paused: noop,
      resumed: noop,
      approvalRequested: noop,
      approvalResponse: noop,
      guardBlocked: noop,
    },
    mindstate: {
      definitionCreated: noop,
      definitionUpdated: noop,
      definitionDeleted: noop,
    },
  } satisfies IEventPublisher;

  return { publisher, changed };
}

describe("ApiVariableService", () => {
  const orgId = `test-org-${randomUUID()}`;
  const orgSlug = `test-org-${randomUUID()}`;
  let service: ApiVariableService;
  let changed: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await db.insert(organization).values({
      id: orgId,
      name: orgId,
      slug: orgSlug,
    });

    const publisher = createMockPublisher();
    service = new ApiVariableService(db, orgId, publisher.publisher);
    changed = publisher.changed;
  });

  beforeEach(() => {
    changed.mockClear();
  });

  afterAll(async () => {
    await db.delete(variables).where(eq(variables.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("returns global variables for the organization", async () => {
    const key = `test-var-${randomUUID()}`;

    await db.insert(variables).values({
      organizationId: orgId,
      scope: "global",
      ownerId: orgId,
      key,
      value: "hello",
      description: "test",
    });

    const result = await service.getGlobalVariables();
    const entry = result.find((item) => item.key === key);

    expect(entry?.value).toBe("hello");
  });

  it("emits variable.changed when executing operations", async () => {
    const key = `test-var-${randomUUID()}`;

    await service.executeOperations(
      "global",
      orgId,
      [{ op: "set", key, value: 123 }],
      {
        organizationId: orgId,
        triggeredBy: "manual",
        performedBy: "user-test",
      }
    );

    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgId }),
      expect.objectContaining({ key, scope: "global", scopeId: orgId })
    );

    const variable = await service.getGlobalVariable(key);
    expect(variable?.value).toBe(123);
  });
});
