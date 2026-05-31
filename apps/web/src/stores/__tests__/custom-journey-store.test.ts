import { describe, it, expect, beforeEach } from "vitest";
import { customJourneyStore, customJourneyActions } from "@/features/journey/builder/store/custom-journey-store";
import type { CustomJourneyData } from "@/features/journey/builder/store/custom-journey-store";
import { NodeTypeEnum } from "@/features/nodes/journey/react-flow-types";

describe("custom-journey-store", () => {
  beforeEach(() => {
    // Reset store state before each test
    const allJourneys = customJourneyActions.getAllJourneys();
    Object.keys(allJourneys).forEach((id) => {
      customJourneyActions.deleteJourney(id);
    });
  });

  describe("customJourneyActions", () => {
    describe("addJourney", () => {
      it("should add a new journey", () => {
        const journeyData: CustomJourneyData = {
          journey: {
            nodes: [],
            edges: [],
            name: "Test Journey",
            description: "Test Description",
          },
        };

        customJourneyActions.addJourney("test-journey", journeyData);

        const stored = customJourneyActions.getJourney("test-journey");
        expect(stored?.journey?.name).toBe("Test Journey");
        expect(stored?.journey?.description).toBe("Test Description");
      });

      it("should store journey with nodes and edges", () => {
        const journeyData: CustomJourneyData = {
          journey: {
            nodes: [
              {
                id: "node-1",
                type: "custom",
                position: { x: 0, y: 0 },
                data: { type: NodeTypeEnum.START, label: "Start", content: "Start" },
                metadata: {
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  version: "1.0.0",
                  status: "active",
                },
              },
            ],
            edges: [],
            name: "Journey with Nodes",
          },
        };

        customJourneyActions.addJourney("journey-with-nodes", journeyData);

        const stored = customJourneyActions.getJourney("journey-with-nodes");
        expect(stored?.journey?.nodes).toHaveLength(1);
        expect(stored?.journey?.nodes[0].id).toBe("node-1");
      });
    });

    describe("getJourney", () => {
      it("should return null for non-existent journey", () => {
        const stored = customJourneyActions.getJourney("non-existent");
        expect(stored).toBeNull();
      });

      it("should return journey data for existing journey", () => {
        const journeyData: CustomJourneyData = {
          journey: { nodes: [], edges: [], name: "Existing" },
        };

        customJourneyActions.addJourney("existing", journeyData);
        const stored = customJourneyActions.getJourney("existing");

        expect(stored?.journey?.name).toBe("Existing");
      });
    });

    describe("updateJourney", () => {
      it("should update existing journey", () => {
        const journeyData: CustomJourneyData = {
          journey: { nodes: [], edges: [], name: "Original" },
        };

        customJourneyActions.addJourney("update-test", journeyData);
        customJourneyActions.updateJourney("update-test", {
          journey: { name: "Updated" },
        });

        const stored = customJourneyActions.getJourney("update-test");
        expect(stored?.journey?.name).toBe("Updated");
      });

      it("should merge updates with existing data", () => {
        const journeyData: CustomJourneyData = {
          journey: { nodes: [], edges: [], name: "Original", description: "Original Desc" },
        };

        customJourneyActions.addJourney("merge-test", journeyData);
        customJourneyActions.updateJourney("merge-test", {
          journey: { name: "Updated" },
        });

        const stored = customJourneyActions.getJourney("merge-test");
        expect(stored?.journey?.name).toBe("Updated");
        expect(stored?.journey?.description).toBe("Original Desc");
      });
    });

    describe("deleteJourney", () => {
      it("should delete a journey", () => {
        const journeyData: CustomJourneyData = {
          journey: { nodes: [], edges: [] },
        };

        customJourneyActions.addJourney("delete-test", journeyData);
        expect(customJourneyActions.getJourney("delete-test")).toBeDefined();

        customJourneyActions.deleteJourney("delete-test");
        expect(customJourneyActions.getJourney("delete-test")).toBeNull();
      });

    });

    describe("getAllJourneys", () => {
      it("should return all journeys", () => {
        const journey1: CustomJourneyData = {
          journey: { nodes: [], edges: [], name: "Journey 1" },
        };
        const journey2: CustomJourneyData = {
          journey: { nodes: [], edges: [], name: "Journey 2" },
        };

        customJourneyActions.addJourney("journey-1", journey1);
        customJourneyActions.addJourney("journey-2", journey2);

        const all = customJourneyActions.getAllJourneys();
        expect(Object.keys(all)).toHaveLength(2);
        expect(all["journey-1"]?.journey?.name).toBe("Journey 1");
        expect(all["journey-2"]?.journey?.name).toBe("Journey 2");
      });

      it("should return empty object when no journeys exist", () => {
        const all = customJourneyActions.getAllJourneys();
        expect(Object.keys(all)).toHaveLength(0);
      });
    });
  });
});

