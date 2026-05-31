/**
 * EditorCommonFields - Composable field components for node editors
 *
 * Split into focused sub-components for cleaner composition:
 * - EditorNameField: Name/label input
 * - EditorContentField: Content textarea
 * - EditorMetadataSection: Collapsible labels, notes, node ID
 * - EditorAdvancedSection: Collapsible section for advanced options
 * - EditorCommonFields: Composed wrapper for consistent layout
 */

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { Textarea } from "@/shared/components/ui/textarea";
import { useNodeEditorContext } from "../hooks/use-node-editor-context";
import { appConfig } from "@/shared/lib/app-config";
import type { NodeEditorFormApi, StringArrayFieldApi, StringFieldApi } from "../forms/form-types";
import { cn } from "@/shared/lib/utils";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { Globe, Plus, Tag, X } from "lucide-react";
import { memo, useState } from "react";
import type { ReactNode } from "react";
import { sectionRegistry } from "../registry/section-registry";

import { UserTagsSection } from "./sections/user-tags-section";
import { VariableActionSection } from "./sections/variable-action-section";

// =============================================================================
// SHARED TYPES
// =============================================================================

interface BaseFieldProps {
  form: NodeEditorFormApi;
  nodeId: string;
  readOnly?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safely extracts error message from validation errors.
 * Handles both string errors and Zod error objects.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Validation error";
}

// =============================================================================
// INDIVIDUAL FIELD COMPONENTS
// =============================================================================

/**
 * Name/Label field for node editors
 * Memoized to prevent re-renders when parent props don't change.
 */
export const EditorNameField = memo(function EditorNameField({ form, nodeId, readOnly = false }: BaseFieldProps) {
  return (
    <form.Field name="label">
      {(field: StringFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor={`label-${nodeId}`} className="text-xs font-medium">
            Name
          </Label>
          <Input
            id={`label-${nodeId}`}
            value={field.state.value || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder="Enter node name..."
            className="h-9"
            disabled={readOnly}
            hasError={field.state.meta.errors.length > 0}
          />
          {field.state.meta.errors.length > 0 && <p className="text-xs text-destructive">{getErrorMessage(field.state.meta.errors[0])}</p>}
        </div>
      )}
    </form.Field>
  );
});

/**
 * Content textarea field for node editors
 * Supports template variable autocomplete when nodes/edges are provided
 * and templateAutocomplete feature is enabled
 */
interface EditorContentFieldProps extends BaseFieldProps {
  label?: string;
  placeholder?: string;
  /** Nodes for template autocomplete (optional, fetched from context if not provided) */
  nodes?: JourneyNode[];
  /** Edges for template autocomplete (optional, fetched from context if not provided) */
  edges?: JourneyEdge[];
  /** Enable template autocomplete (default: true) */
  enableAutocomplete?: boolean;
}

export const EditorContentField = memo(function EditorContentField({
  form,
  nodeId,
  readOnly = false,
  label = "Content",
  placeholder = "Enter content...",
  nodes: nodesProp,
  edges: edgesProp,
  enableAutocomplete = true,
}: EditorContentFieldProps) {
  // Fetch from context if not provided
  const context = useNodeEditorContext();
  const nodes = nodesProp ?? context.nodes;
  const edges = edgesProp ?? context.edges;
  const showAutocomplete = enableAutocomplete && nodes.length > 0 && edges.length > 0;

  return (
    <form.Field name="content">
      {(field: StringFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor={`content-${nodeId}`} className="text-xs font-medium">
            {label}
          </Label>
          {showAutocomplete ? (
            <TemplateTextarea
              id={`content-${nodeId}`}
              value={field.state.value || ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={placeholder}
              className="min-h-[120px] field-sizing-content text-sm"
              disabled={readOnly}
            />
          ) : (
            <Textarea
              id={`content-${nodeId}`}
              value={field.state.value || ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={placeholder}
              className="min-h-[120px] field-sizing-content text-sm"
              disabled={readOnly}
            />
          )}
        </div>
      )}
    </form.Field>
  );
});

/**
 * Metadata section - collapsible tags, node ID, and notes
 * Memoized to prevent re-renders when parent props don't change.
 */
export const EditorMetadataSection = memo(function EditorMetadataSection({ form, nodeId, readOnly = false }: BaseFieldProps) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;

    const currentTags = (form.getFieldValue<string[]>("tags") || []) as string[];
    if (currentTags.includes(trimmed)) {
      setNewTag("");
      return;
    }

    form.setFieldValue("tags", [...currentTags, trimmed]);
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = (form.getFieldValue<string[]>("tags") || []) as string[];
    form.setFieldValue("tags", currentTags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <CollapsibleSection open={open} onOpenChange={setOpen} icon={Tag} label="Metadata" paddingClass={appConfig.editor.padding.main}>
      {/* Labels (for organizing nodes in the editor) */}
      <form.Field name="tags">
        {(field: StringArrayFieldApi) => {
          const tags = field.state.value || [];
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Labels</Label>
              <p className="text-[10px] text-muted-foreground">For organizing nodes in the editor</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={cn("text-xs", !readOnly && "cursor-pointer hover:bg-destructive/20")}
                      onClick={readOnly ? undefined : () => handleRemoveTag(tag)}
                    >
                      {tag}
                      {!readOnly && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No labels</span>
                )}
              </div>
              {!readOnly && (
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add label..."
                    className="h-8 text-xs flex-1"
                  />
                  <Button type="button" variant="secondary" size="sm" className="h-8 px-3" onClick={handleAddTag}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        }}
      </form.Field>

      {/* Node ID (read-only) */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Node ID</Label>
        <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1.5 rounded">{nodeId}</p>
      </div>

      {/* Notes */}
      <form.Field name="notes">
        {(field: StringFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={`notes-${nodeId}`} className="text-xs text-muted-foreground">
              Notes
            </Label>
            <Textarea
              id={`notes-${nodeId}`}
              value={field.state.value || ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Internal notes..."
              className="min-h-[60px] resize-y text-xs"
              disabled={readOnly}
            />
          </div>
        )}
      </form.Field>
    </CollapsibleSection>
  );
});

/**
 * Advanced section - collapsible custom JSON + optional extra children
 * Memoized to prevent re-renders when parent props don't change.
 */
interface EditorAdvancedSectionProps {
  children?: ReactNode;
}

export const EditorAdvancedSection = memo(function EditorAdvancedSection({ children }: EditorAdvancedSectionProps) {
  const [open, setOpen] = useState(false);

  // Don't render if there are no children
  if (!children) return null;

  return (
    <CollapsibleSection open={open} onOpenChange={setOpen} icon={Globe} label="Advanced" paddingClass={appConfig.editor.padding.main}>
      {children}
    </CollapsibleSection>
  );
});

// =============================================================================
// WRAPPER COMPONENT
// =============================================================================

interface EditorCommonFieldsProps {
  form: NodeEditorFormApi;
  nodeId: string;
  readOnly?: boolean;
  showName?: boolean;
  showContent?: boolean;
  contentPlaceholder?: string;
  contentLabel?: string;
  showUserTags?: boolean;
  showVariables?: boolean;
  showMetadata?: boolean;
  showAdvanced?: boolean;
  advancedChildren?: ReactNode;
  /** Journey ID for fetching journey-scoped variables in the preview */
  journeyId?: string | null;
}

/**
 * Wrapper component - composes individual field components based on show* flags
 * This is the recommended approach for node editors as it provides consistent
 * field layout and behavior across all node types.
 * Memoized to prevent re-renders when parent props don't change.
 */
export const EditorCommonFields = memo(function EditorCommonFields({
  form,
  nodeId,
  readOnly = false,
  showName = true,
  showContent = true,
  contentPlaceholder = "Enter content...",
  contentLabel = "Content",
  showUserTags = false,
  showVariables = false,
  showMetadata = false,
  showAdvanced = false,
  advancedChildren,
  journeyId,
}: EditorCommonFieldsProps) {
  return (
    <>
      {showName && <EditorNameField form={form} nodeId={nodeId} readOnly={readOnly} />}
      {showContent && <EditorContentField form={form} nodeId={nodeId} readOnly={readOnly} label={contentLabel} placeholder={contentPlaceholder} />}
      {showUserTags && <UserTagsSection form={form} nodeId={nodeId} readOnly={readOnly} />}
      {showVariables && <VariableActionSection form={form} nodeId={nodeId} readOnly={readOnly} journeyId={journeyId} />}
      {showMetadata && <EditorMetadataSection form={form} nodeId={nodeId} readOnly={readOnly} />}
      {showAdvanced && <EditorAdvancedSection>{advancedChildren}</EditorAdvancedSection>}
    </>
  );
});

// =============================================================================
// SECTION REGISTRATION
// =============================================================================

sectionRegistry.register({
  id: "metadata",
  label: "Metadata",
  component: EditorMetadataSection,
  scope: "common",
  shouldRender: () => true,
  order: 100, // Last in the list
});
