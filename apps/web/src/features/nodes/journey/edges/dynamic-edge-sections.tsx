/**
 * DynamicEdgeSections Component
 *
 * Renders edge sections from the edge section registry.
 * Each section is wrapped in its form field context.
 *
 * @module features/nodes/journey/edges/dynamic-edge-sections
 */

import { memo, useMemo } from "react";
import { Label } from "@/shared/components/ui/label";
import type { JourneyEdge, JourneyNode } from "../react-flow-types";
import { edgeSectionRegistry } from "./edge-section-registry";

// Import sections to trigger self-registration
import "../editors/sections/guard-section";

// =============================================================================
// TYPES
// =============================================================================

interface DynamicEdgeSectionsProps {
  /** Current edge being edited */
  edge: JourneyEdge;
  /** TanStack Form instance */
  form: {
    Field: React.ComponentType<{
      name: string;
      children: (field: {
        state: { value: unknown };
        handleChange: (value: unknown) => void;
        handleBlur: () => void;
      }) => React.ReactNode;
    }>;
  };
  /** Read-only mode */
  readOnly?: boolean;
  /** Journey nodes for variable resolution */
  nodes?: JourneyNode[];
  /** Journey edges for variable resolution */
  edges?: JourneyEdge[];
  /** Journey ID */
  journeyId?: string | null;
  /** Source node for context */
  sourceNode?: JourneyNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Dynamically renders edge sections from the registry.
 * Each section is wrapped in its form field.
 */
export const DynamicEdgeSections = memo(function DynamicEdgeSections({
  edge,
  form,
  readOnly = false,
  nodes,
  edges,
  journeyId,
  sourceNode,
}: DynamicEdgeSectionsProps) {
  // Get sections that should render for this edge
  const sections = useMemo(
    () => edgeSectionRegistry.getSectionsForEdge(edge, sourceNode),
    [edge, sourceNode]
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <>
      {sections.map((section) => {
        const SectionComponent = section.component;
        const Icon = section.icon;

        return (
          <form.Field key={section.id} name={section.fieldName}>
            {(field) => (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-500" />
                  <Label className="text-xs font-medium">{section.label}</Label>
                </div>
                {section.description && (
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                )}
                <SectionComponent
                  edge={edge}
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value)}
                  readOnly={readOnly}
                  nodes={nodes}
                  edges={edges}
                  journeyId={journeyId}
                />
              </div>
            )}
          </form.Field>
        );
      })}
    </>
  );
});
