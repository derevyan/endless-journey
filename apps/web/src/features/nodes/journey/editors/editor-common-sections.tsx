/**
 * EditorCommonSections - Registry-driven wrapper for common node editor sections
 *
 * Renders common sections based on the node's capabilities using sectionRegistry.
 * Sections are automatically discovered and rendered in order based on their registration.
 *
 * Capabilities are derived from @journey/schemas NodeCapabilities.
 * Adding new sections only requires registering them - no changes to this file needed.
 *
 * Uses useNodeEditorContext internally to fetch nodes/edges when not provided.
 */

import { memo } from "react";
import type { ReactNode } from "react";

import { useNodeEditorContext } from "../hooks/use-node-editor-context";
import type { NodeEditorFormApi } from "../forms/form-types";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { getNodeCapabilities, type NodeType } from "@journey/schemas";

import { sectionRegistry, type SectionProps } from "@/features/nodes/journey/registry/section-registry";
import { EditorAdvancedSection } from "./editor-common-fields";

// Import sections to trigger their self-registration side effects
import "./sections/crm-action-section";
import "./sections/user-tags-section";
import "./sections/variable-action-section";

interface EditorCommonSectionsProps {
  form: NodeEditorFormApi;
  nodeId: string;
  /** Node type to look up feature config from registry */
  nodeType: string;
  readOnly?: boolean;
  /** Journey UUID for fetching journey-scoped variables/tags (optional, fetched from context if not provided) */
  journeyId?: string | null;
  /** Optional children for the Advanced section */
  advancedChildren?: ReactNode;
  /** Nodes for computing accumulated tag state (optional, fetched from context if not provided) */
  nodes?: JourneyNode[];
  /** Edges for computing accumulated tag state (optional, fetched from context if not provided) */
  edges?: JourneyEdge[];
  /** Validation errors from form-level validation (path -> message) */
  validationErrors?: Map<string, string>;
}

/**
 * Renders the common sections at the bottom of node editors.
 * Sections are dynamically loaded from the sectionRegistry based on feature config.
 *
 * Automatically fetches nodes, edges, and journeyId from context when not provided,
 * simplifying usage in node editors.
 *
 * @example
 * ```tsx
 * // Minimal usage - context values are fetched automatically
 * <EditorCommonSections
 *   form={form}
 *   nodeId={node.id}
 *   nodeType={node.data.type}
 *   readOnly={readOnly}
 * />
 *
 * // With advanced children
 * <EditorCommonSections
 *   form={form}
 *   nodeId={node.id}
 *   nodeType={node.data.type}
 *   readOnly={readOnly}
 *   advancedChildren={<MyAdvancedOptions />}
 * />
 * ```
 */
export const EditorCommonSections = memo(function EditorCommonSections({
  form,
  nodeId,
  nodeType,
  readOnly = false,
  journeyId: journeyIdProp,
  advancedChildren,
  nodes: nodesProp,
  edges: edgesProp,
  validationErrors,
}: EditorCommonSectionsProps) {
  // Get context values, use props if provided (allows override)
  const context = useNodeEditorContext();
  const journeyId = journeyIdProp ?? context.journeyUuid;
  const nodes = nodesProp ?? context.nodes;
  const edges = edgesProp ?? context.edges;

  const node = nodes.find((item) => item.id === nodeId);
  const fallbackNode = node ?? ({ id: nodeId, data: { type: nodeType } } as JourneyNode);
  const capabilities = getNodeCapabilities(nodeType as NodeType);

  // Get sections that should render for this node
  const sections = sectionRegistry.getSectionsForNode(fallbackNode, capabilities, "common");

  // Common props for all sections
  const sectionProps: SectionProps = {
    form,
    nodeId,
    readOnly,
    journeyId,
    nodes,
    edges,
    validationErrors,
  };

  return (
    <>
      {sections.map(({ id, component: Section }) => {
        // Special case: CRM section shouldn't show on CRM nodes
        // (CRM nodes have their own dedicated CRM fields)
        if (id === "crm-actions" && nodeType === "crm") {
          return null;
        }
        return <Section key={id} {...sectionProps} />;
      })}

      {/* Advanced section (always last, only if children provided) */}
      <EditorAdvancedSection>{advancedChildren}</EditorAdvancedSection>
    </>
  );
});
