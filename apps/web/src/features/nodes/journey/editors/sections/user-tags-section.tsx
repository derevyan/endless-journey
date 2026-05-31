/**
 * UserTagsSection Component
 *
 * Collapsible section for configuring user tagging actions on nodes.
 * Tags are stored in client_tags table and follow users across all journeys.
 *
 * Features:
 * - Autocomplete suggestions from tag definitions registry
 * - Auto-creates new tags in registry when typing new tags
 */

import { Badge } from "@/shared/components/ui/badges";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useAddTag, useTags } from "@/hooks/queries/use-tags";
import { appConfig } from "@/shared/lib/app-config";
import type { NodeEditorFormApi } from "../../forms/form-types";
import type { TagActionFormValue } from "../../forms/node-form-builders";
import { computeAccumulatedTags } from "@/shared/lib/utils/tag-accumulator";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { type Tag, TagInput } from "emblor";
import { Info, Minus, Plus, Tags } from "lucide-react";
import { sectionRegistry, type SectionDefinition } from "../../registry/section-registry";
import { useCallback, useId, useMemo, useRef, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface UserTagsSectionProps {
  form: NodeEditorFormApi;
  nodeId: string;
  readOnly?: boolean;
  /** Nodes and edges for computing accumulated tag state (optional) */
  nodes?: JourneyNode[];
  edges?: JourneyEdge[];
}

// =============================================================================
// HELPERS
// =============================================================================

// Convert string array to Tag array for emblor (filter out empty strings)
function toTags(strings: string[]): Tag[] {
  return strings.filter((text) => text.trim() !== "").map((text, index) => ({ id: String(index), text }));
}

// Convert Tag array back to string array (filter out empty tags)
function toStrings(tags: Tag[]): string[] {
  return tags.map((tag) => tag.text).filter((text) => text.trim() !== "");
}

// =============================================================================
// TAG INPUT ROW COMPONENT
// =============================================================================

interface TagInputRowProps {
  label: string;
  icon: React.ReactNode;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  placeholder: string;
  readOnly?: boolean;
  id: string;
  /** Autocomplete suggestions from tag registry */
  suggestions?: string[];
  /** Callback when a new tag is added (for auto-creation in registry) */
  onNewTag?: (tag: string) => void;
}

function TagInputRow({ label, icon, tags, onTagsChange, placeholder, readOnly, id, suggestions = [], onNewTag }: TagInputRowProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const prevTagsRef = useRef<Tag[]>(tags);

  const tagInputStyles = {
    inlineTagsContainer:
      "border-input rounded-md bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring outline-none focus-within:ring-[3px] focus-within:ring-ring/50 p-1 gap-1",
    input: "w-full min-w-[80px] shadow-none px-2 h-7 text-xs",
    tag: {
      body: "h-7 relative bg-background border border-input hover:bg-background rounded-md font-medium text-xs ps-2 pe-7",
      closeButton:
        "absolute -inset-y-px -end-px p-0 rounded-e-md flex size-7 transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-muted-foreground/80 hover:text-foreground",
    },
  };

  // Convert string suggestions to Tag[] format for emblor autocomplete
  const autocompleteOptions: Tag[] = suggestions.map((text, index) => ({ id: `suggestion-${index}`, text }));

  // Handle tag changes and detect new tags for auto-creation
  const handleTagsChange = useCallback(
    (newTags: Tag[] | ((prev: Tag[]) => Tag[])) => {
      const resolvedTags = typeof newTags === "function" ? newTags(tags) : newTags;

      // Detect newly added tags
      if (onNewTag && resolvedTags.length > prevTagsRef.current.length) {
        const prevTexts = new Set(prevTagsRef.current.map((t) => t.text.toLowerCase()));
        const suggestionsLower = new Set(suggestions.map((s) => s.toLowerCase()));

        for (const tag of resolvedTags) {
          const tagLower = tag.text.toLowerCase();
          // If tag is new (not in previous) and not in suggestions, create it
          if (!prevTexts.has(tagLower) && !suggestionsLower.has(tagLower)) {
            onNewTag(tag.text);
          }
        }
      }

      prevTagsRef.current = resolvedTags;
      onTagsChange(resolvedTags);
    },
    [tags, onTagsChange, onNewTag, suggestions]
  );

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
        {icon}
        {label}
      </label>
      {readOnly ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span key={tag.id} className="h-7 inline-flex items-center bg-background border border-input rounded-md font-medium text-xs px-2">
                {tag.text}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-muted-foreground">None</span>
          )}
        </div>
      ) : (
        <TagInput
          id={id}
          tags={tags}
          setTags={handleTagsChange}
          placeholder={placeholder}
          activeTagIndex={activeIndex}
          setActiveTagIndex={setActiveIndex}
          styleClasses={tagInputStyles}
          enableAutocomplete={autocompleteOptions.length > 0}
          autocompleteOptions={autocompleteOptions}
          restrictTagsToAutocompleteOptions={false}
        />
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function UserTagsSection({ form, nodeId, readOnly = false, nodes, edges }: UserTagsSectionProps) {
  const addId = useId();
  const removeId = useId();

  // Fetch tag definitions for autocomplete
  const tagsQuery = useTags();

  // Mutation for auto-creating new tags
  const addTagMutation = useAddTag();

  // Extract tag names for autocomplete suggestions
  const suggestions = tagsQuery.data?.map((t) => t.tag) ?? [];

  // Compute accumulated tags from upstream nodes
  const accumulatedTags = useMemo(() => {
    if (!nodes || !edges || nodes.length === 0 || edges.length === 0) {
      return null;
    }
    return computeAccumulatedTags(nodeId, nodes, edges);
  }, [nodeId, nodes, edges]);

  const [open, setOpen] = useState(() => {
    // Open by default if there are already tags configured
    const tagAction = form.getFieldValue("tagAction") as TagActionFormValue | undefined;
    if (!tagAction) return false;

    const tags = tagAction.tags;
    const hasTags = (tags?.add?.length || 0) + (tags?.remove?.length || 0) > 0;

    return hasTags;
  });

  // Auto-create new tag in registry
  const handleNewTag = useCallback(
    (tag: string) => {
      addTagMutation.mutate({ tag });
    },
    [addTagMutation]
  );

  return (
    <form.Field name="tagAction">
      {(field: { state: { value: TagActionFormValue | undefined }; handleChange: (value: TagActionFormValue) => void }) => {
        // Use form.getFieldValue as fallback when field.state.value is undefined
        // This handles TanStack Form timing issues where field.state may not have initial values on first render
        const tagAction = field.state.value ?? (form.getFieldValue("tagAction") as TagActionFormValue | undefined);
        const operations = tagAction?.tags || {};
        const operationCount = (operations.add?.length || 0) + (operations.remove?.length || 0);

        const handleAddTagsChange = (tags: Tag[]) => {
          field.handleChange({
            tags: {
              ...operations,
              add: toStrings(tags),
            },
          });
        };

        const handleRemoveTagsChange = (tags: Tag[]) => {
          field.handleChange({
            tags: {
              ...operations,
              remove: toStrings(tags),
            },
          });
        };

        return (
          <CollapsibleSection
            open={open}
            onOpenChange={setOpen}
            icon={Tags}
            label="Tags"
            badge={operationCount > 0 ? operationCount : undefined}
            paddingClass={appConfig.editor.padding.main}
            contentClassName="space-y-4"
          >
            <p className="text-xs text-muted-foreground">Add or remove tags from users when they reach this node. Tags follow users across all journeys and can be used for segmentation and filtering in CRM.</p>

            {/* Expected Tags at Entry - Read-only preview */}
            {accumulatedTags && accumulatedTags.tags.length > 0 && (
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide cursor-help">Expected at Entry</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Tags accumulated from upstream nodes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {accumulatedTags.multiPath && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">
                      varies by path
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {accumulatedTags.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="h-6 text-xs font-normal bg-background/50">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add Tags */}
            <TagInputRow
              id={addId}
              label="Add Tags"
              icon={<Plus className="h-3 w-3" />}
              tags={toTags(operations.add || [])}
              onTagsChange={handleAddTagsChange}
              placeholder="Type tag and press Enter..."
              readOnly={readOnly}
              suggestions={suggestions}
              onNewTag={handleNewTag}
            />

            {/* Remove Tags */}
            <TagInputRow
              id={removeId}
              label="Remove Tags"
              icon={<Minus className="h-3 w-3" />}
              tags={toTags(operations.remove || [])}
              onTagsChange={handleRemoveTagsChange}
              placeholder="Type tag and press Enter..."
              readOnly={readOnly}
              suggestions={suggestions}
              onNewTag={handleNewTag}
            />
          </CollapsibleSection>
        );
      }}
    </form.Field>
  );
}

// =============================================================================
// SECTION DEFINITION
// =============================================================================

export const userTagsSectionDefinition = {
  id: "user-tags",
  label: "User Tags",
  component: UserTagsSection,
  scope: "common",
  shouldRender: (_node, caps) => caps.hasTagAction === true,
  order: 10,
} as const satisfies SectionDefinition;

// Self-register on import
sectionRegistry.register(userTagsSectionDefinition);
