/**
 * Edge Identity - Unit Tests
 *
 * Consolidated tests focusing on roundtrip consistency and error cases.
 */

import { describe, expect, it } from "vitest";

import { ManagedEdgeId, isManagedEdge } from "../edge-identity";

describe("ManagedEdgeId", () => {
  it("should roundtrip create/parse", () => {
    const nodeId = "my-feature-node";
    const buttonId = "btn-confirm";
    const id = ManagedEdgeId.create(nodeId, buttonId);
    const parsed = ManagedEdgeId.parse(id);
    expect(parsed).toEqual({ nodeId, buttonId });
  });

  it("should return null for malformed IDs", () => {
    expect(ManagedEdgeId.parse("managed-btn::")).toBeNull();
    expect(ManagedEdgeId.parse("managed-btn::node-only")).toBeNull();
    expect(ManagedEdgeId.parse("edge-12345")).toBeNull();
  });

  it("should distinguish from other edge types", () => {
    expect(ManagedEdgeId.is("managed-btn::node-1::btn-1")).toBe(true);
    expect(ManagedEdgeId.is("edge-12345")).toBe(false);
  });
});

describe("edge type helpers", () => {
  it("isManagedEdge should detect managed button edges", () => {
    expect(isManagedEdge("managed-btn::node-1::btn-1")).toBe(true);
    expect(isManagedEdge("edge-12345")).toBe(false);
  });

  it("isManagedEdge should detect plugin edges", () => {
    expect(isManagedEdge("plugin::parent-1::plugin-1")).toBe(true);
    expect(isManagedEdge("plugin-btn::plugin-1::0::btn-1")).toBe(true);
    expect(isManagedEdge("plugin-exit::plugin-1")).toBe(true);
  });
});
