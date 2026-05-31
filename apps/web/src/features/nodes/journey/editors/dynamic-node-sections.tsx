/**
 * DynamicNodeSections Component
 *
 * Renders node-specific sections dynamically from the section registry.
 * Sections are filtered by node capabilities and sorted by order.
 *
 * This replaces manual section imports and state management in node editors.
 * Sections self-register on import, and this component discovers and renders them.
 *
 * @module features/nodes/journey/editors/dynamic-node-sections
 */

import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { getNodeCapabilities } from "@journey/schemas";
import type { JourneyNode } from "../react-flow-types";
import type { NodeEditorFormApi } from "../forms/form-types";
import { sectionRegistry } from "../registry/section-registry";
import { EditorSectionsProvider } from "./editor-sections-context";

// Import sections to trigger self-registration (side effects)
import "./sections/timer-section";
import "./sections/media-section";

// =============================================================================
// TYPES
// =============================================================================

interface DynamicNodeSectionsProps {
  /** Current node being edited */
  node: JourneyNode;
  /** TanStack Form instance */
  form: NodeEditorFormApi;
  /** Read-only mode */
  readOnly?: boolean;
  /** Initial open state checker - returns true if section should start open */
  getInitialOpenState?: (sectionId: string, node: JourneyNode) => boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders node-specific sections dynamically based on node capabilities.
 *
 * @example
 * ```tsx
 * <DynamicNodeSections
 *   node={node}
 *   form={form}
 *   readOnly={readOnly}
 *   getInitialOpenState={(sectionId, node) => {
 *     if (sectionId === "timer") return hasTimerSet(node);
 *     if (sectionId === "media") return hasMediaSet(node);
 *     return false;
 *   }}
 * />
 * ```
 */
export const DynamicNodeSections = memo(function DynamicNodeSections({
  node,
  form,
  readOnly = false,
  getInitialOpenState,
}: DynamicNodeSectionsProps) {
  // Get capabilities for this node type
  const capabilities = useMemo(
    () => getNodeCapabilities(node.data.type),
    [node.data.type]
  );

  // Get sections that should render for this node
  const sections = useMemo(
    () => sectionRegistry.getSectionsForNode(node, capabilities),
    [node, capabilities]
  );

  // Track open state for each section
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of sections) {
      initial[section.id] = getInitialOpenState?.(section.id, node) ?? false;
    }
    return initial;
  });

  // Sync open state when node changes (new node selected)
  useEffect(() => {
    const updated: Record<string, boolean> = {};
    for (const section of sections) {
      updated[section.id] = getInitialOpenState?.(section.id, node) ?? false;
    }
    setOpenSections(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: only reset open state on node switch, not on form changes
  }, [node.id]);

  // Toggle section open state
  const handleOpenChange = useCallback((sectionId: string, open: boolean) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: open }));
  }, []);

  // Don't render if no sections
  if (sections.length === 0) {
    return null;
  }

  return (
    <EditorSectionsProvider form={form} nodeId={node.id} readOnly={readOnly}>
      {sections.map((section) => {
        const Component = section.component;
        const isOpen = openSections[section.id] ?? false;

        return (
          <Component
            key={section.id}
            form={form}
            node={node}
            nodeId={node.id}
            open={isOpen}
            onOpenChange={(open) => handleOpenChange(section.id, open)}
            readOnly={readOnly}
          />
        );
      })}
    </EditorSectionsProvider>
  );
});
