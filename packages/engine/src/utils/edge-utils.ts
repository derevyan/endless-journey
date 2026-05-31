import type { JourneyEdgeData } from "@journey/schemas";

export function isTimerEdge(edge: JourneyEdgeData): boolean {
  return edge.edgeType === "timer" || edge.sourceHandle === "timer";
}
