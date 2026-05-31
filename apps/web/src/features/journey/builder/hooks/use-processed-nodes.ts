/**
 * useProcessedNodes Hook
 *
 * Transforms raw journey nodes for React Flow rendering with:
 * - Current simulator node highlighting
 * - Visited node indicators
 * - Step numbers for simulator path visualization
 * - Clickable state for simulator mode
 */
import { useMemo } from "react";

import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

export interface ProcessedNodesConfig {
  /** Current node ID in simulator */
  currentTestNodeId: string | null;
  /** Whether canvas is in simulator mode */
  isSimulatorMode: boolean;
  /** Whether simulator is actively running */
  isSimulatorActive: boolean;
  /** Simulator path data for visualization */
  simulatorPath: {
    pathKey: string;
    visitedNodes: Map<string, number>;
  };
}

/**
 * Transforms nodes for React Flow rendering with simulator state.
 */
export function useProcessedNodes(nodes: JourneyNode[], config: ProcessedNodesConfig): JourneyNode[] {
  const { currentTestNodeId, isSimulatorMode, isSimulatorActive, simulatorPath } = config;

  return useMemo(() => {
    return nodes.map((node) => {
      const isCurrentSimulatorNode = node.id === currentTestNodeId;
      const isClickableInSimulatorMode = isSimulatorMode && !isSimulatorActive;

      // Get simulator path data for this node (simulator mode)
      const simulatorStepNumber = simulatorPath.visitedNodes.get(node.id);
      const isSimulatorVisited = simulatorStepNumber !== undefined;

      return {
        ...node,
        data: {
          ...node.data,
          journeyCurrent: isCurrentSimulatorNode,
          journeyVisited: isSimulatorActive && isSimulatorVisited && !isCurrentSimulatorNode,
          journeyStep: isSimulatorActive ? simulatorStepNumber : undefined,
          // Add simulator mode indicator
          simulatorModeClickable: isClickableInSimulatorMode,
        },
        style: {
          ...node.style,
          // Add cursor pointer in simulator mode when not active
          cursor: isClickableInSimulatorMode ? "pointer" : node.style?.cursor,
        },
      };
    });
  }, [nodes, currentTestNodeId, isSimulatorMode, isSimulatorActive, simulatorPath.visitedNodes]);
}
