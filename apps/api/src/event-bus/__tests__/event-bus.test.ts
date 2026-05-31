/**
 * Event Bus Unit Tests
 *
 * Focused on unknown event type behavior.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { BaseEvent } from "@journey/schemas";

import { initEventBus, publishEvent, registerEventConsumer, shutdownEventBus } from "../event-bus";

describe("event-bus", () => {
  beforeEach(() => {
    shutdownEventBus();
  });

  afterEach(() => {
    shutdownEventBus();
  });

  it("does not throw or invoke consumers for unknown event types", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);

    registerEventConsumer({
      name: "log",
      handle,
    });

    initEventBus();

    const event: BaseEvent = {
      id: randomUUID(),
      type: "unknown.event.type",
      timestamp: new Date().toISOString(),
      version: 1,
      organizationId: "00000000-0000-0000-0000-000000000000",
      source: "system",
      sequence: 1,
      payload: { sample: true },
    };

    await expect(publishEvent(event, { skipRateLimit: true })).resolves.toBeUndefined();
    expect(handle).not.toHaveBeenCalled();
  });
});
