import { describe, expect, it } from "vitest";

import { PluginCompatibilityRegistry } from "../plugins/compatibility-registry";

describe("PluginCompatibilityRegistry", () => {
  it("enforces compatible node types and required capabilities", () => {
    const registry = new PluginCompatibilityRegistry();

    registry.register({
      pluginType: "followup",
      compatibleNodeTypes: ["message", "end"],
      maxInstancesPerNode: 1,
      canBeChained: false,
      requiredCapabilities: ["hasFollowUp"],
    });

    expect(registry.isCompatible("followup", "message")).toBe(true);
    expect(registry.isCompatible("followup", "end")).toBe(false);
    expect(registry.isCompatible("missing", "message")).toBe(false);
  });

  it("returns compatible plugins and nodes based on registry entries", () => {
    const registry = new PluginCompatibilityRegistry();

    registry.register({
      pluginType: "followup",
      compatibleNodeTypes: ["message", "agent", "questionnaire"],
      maxInstancesPerNode: 1,
      canBeChained: false,
      requiredCapabilities: ["hasFollowUp"],
    });

    registry.register({
      pluginType: "analytics",
      compatibleNodeTypes: ["message", "end"],
      maxInstancesPerNode: 0,
      canBeChained: true,
    });

    expect(registry.getCompatiblePlugins("message")).toEqual(["followup", "analytics"]);
    expect(registry.getCompatiblePlugins("end")).toEqual(["analytics"]);
    expect(registry.getCompatibleNodes("followup")).toEqual(["message", "agent", "questionnaire"]);
  });
});
