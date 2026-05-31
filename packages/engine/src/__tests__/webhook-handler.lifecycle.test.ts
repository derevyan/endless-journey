import { describe, expect, it, vi } from "vitest";
import type { JourneyConfig, JourneyNodeData, NodeMetadata } from "@journey/schemas";
import type { createLogger } from "@journey/logger";

import { webhookHandler } from "../handlers/types/webhook";
import { maskUrl } from "../utils";
import type { ActivationContext } from "../lifecycle/types";
import type { EngineServices } from "../types";

const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

describe("webhookHandler lifecycle", () => {
  it("logs activation and deactivation with masked URL", async () => {
    const url = "https://api.example.com?token=secret&user=demo";
    const node: JourneyNodeData = {
      id: "webhook-1",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "webhook",
        schemaVersion: 1,
        label: "Webhook",
        url,
        method: "POST",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      },
      metadata: createMetadata(),
    };

    const journey: JourneyConfig = { nodes: [node], edges: [] };

    const log = {
      debug: vi.fn(),
    } as unknown as ReturnType<typeof createLogger>;

    const context: ActivationContext = {
      journeyId: "journey-1",
      journey,
      organizationId: "org-1",
      node,
      services: {} as EngineServices,
      log,
    };

    await webhookHandler.onActivate?.(context);
    await webhookHandler.onDeactivate?.(context);

    expect(log.debug).toHaveBeenCalledWith(
      { nodeId: "webhook-1", webhookUrl: maskUrl(url) },
      "webhook:activated"
    );
    expect(log.debug).toHaveBeenCalledWith(
      { nodeId: "webhook-1", webhookUrl: maskUrl(url) },
      "webhook:deactivated"
    );
  });
});
