/**
 * Client Tags Editor
 *
 * Editable tag list for CRM clients using the shared TagSelector.
 *
 * @module components/crm/client-tags-editor
 */

import { Plus, X } from "lucide-react";
import { useCallback } from "react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { TagSelector } from "@/shared/components/ui/tag-selector";
import { TAG_COLOR_MAP } from "@/shared/lib/app-config";
import { cn } from "@/shared/lib/utils";
import { useAddClientTag, useRemoveClientTag } from "@/features/crm/hooks/queries";
import { useTags } from "@/hooks/queries/use-tags";

interface ClientTagsEditorProps {
  clientId: string;
  tags: string[];
  tagColorMap?: Record<string, string>;
}

export function ClientTagsEditor({
  clientId,
  tags,
  tagColorMap = {},
}: ClientTagsEditorProps) {
  const { data: allTags = [] } = useTags();
  const addTagMutation = useAddClientTag();
  const removeTagMutation = useRemoveClientTag();

  // Get available tags that aren't already assigned
  const availableTags = allTags
    .filter((t) => !tags.includes(t.tag))
    .map((t) => t.tag);

  const handleAddTag = useCallback(
    async (tagName: string) => {
      if (!tagName.trim()) return;
      try {
        await addTagMutation.mutateAsync({ clientId, tag: tagName.trim() });
      } catch {
        // Error handled by mutation
      }
    },
    [addTagMutation, clientId]
  );

  const handleRemoveTag = useCallback(
    async (tagName: string) => {
      try {
        await removeTagMutation.mutateAsync({ clientId, tag: tagName });
      } catch {
        // Error handled by mutation
      }
    },
    [removeTagMutation, clientId]
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Current tags - grows naturally with content */}
      {tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tags assigned</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const color = tagColorMap[tag];
            const dotColor = color && TAG_COLOR_MAP[color] ? TAG_COLOR_MAP[color] : "bg-slate-500";
            return (
              <Badge key={tag} variant="secondary" className="gap-1.5 pr-1 text-xs font-mono">
                <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
                {tag}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-4 hover:bg-destructive/20"
                  onClick={() => handleRemoveTag(tag)}
                  disabled={removeTagMutation.isPending}
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Add tag button with selector - always visible */}
      <div className="shrink-0">
        <TagSelector
        availableTags={availableTags}
        onTagSelect={handleAddTag}
        tagColorMap={tagColorMap}
        allowCreate
        onTagCreate={handleAddTag}
        mode="single"
        searchPlaceholder="Search or create tag..."
        emptyMessage="No matching tags"
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={addTagMutation.isPending}
          >
            <Plus className="size-3" />
            Add Tag
          </Button>
        }
      />
      </div>
    </div>
  );
}
