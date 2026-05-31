import { describe, expect, it } from "vitest";
import { createHandlerRegistryWithOverrides } from "../handlers";
import type { NodeHandler } from "../types";

describe("HandlerRegistry overrides", () => {
  const overrideMessageHandler: NodeHandler = {
    nodeType: "message",
    execute: async () => ({ action: "wait" }),
  };

  it("allows explicit overrides for built-in handlers", () => {
    const registry = createHandlerRegistryWithOverrides({
      handlerOverrides: [overrideMessageHandler],
    });

    expect(registry.get("message")).toBe(overrideMessageHandler);
  });

  it("rejects customHandlers that replace built-in handlers", () => {
    expect(() =>
      createHandlerRegistryWithOverrides({
        customHandlers: [overrideMessageHandler],
      })
    ).toThrow(/handlerOverrides/);
  });

  it("rejects overrides for unknown node types", () => {
    const unknownHandler = {
      nodeType: "custom",
      execute: async () => ({ action: "wait" }),
    } as unknown as NodeHandler;

    expect(() =>
      createHandlerRegistryWithOverrides({
        handlerOverrides: [unknownHandler],
      })
    ).toThrow(/built-in/);
  });

  it("rejects duplicate overrides for the same node type", () => {
    expect(() =>
      createHandlerRegistryWithOverrides({
        handlerOverrides: [overrideMessageHandler, overrideMessageHandler],
      })
    ).toThrow(/Duplicate handler/);
  });
});
