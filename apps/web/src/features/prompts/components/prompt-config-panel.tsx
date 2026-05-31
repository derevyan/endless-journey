/**
 * Prompt Config Panel
 *
 * Consolidates variables, tags, and metadata for a prompt version.
 * Tags are editable via TagInput component.
 *
 * @module features/prompts/components/prompt-config-panel
 */

import { cn } from "@/shared/lib/utils";
import type { PromptResponse, PromptVersionResponse } from "@journey/schemas";
import { type Tag as TagType, TagInput } from "emblor";
import { Calendar, Check, Copy, Hash, Info, Shield, Tag, Type, Variable } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface PromptConfigPanelProps {
  prompt: PromptResponse;
  versions: PromptVersionResponse[];
  variables: string[];
  paths: string[];
  /** Callback to update prompt tags */
  onUpdateTags?: (tags: string[]) => Promise<void>;
  className?: string;
}

// Tag input styles matching the label popover pattern
const TAG_INPUT_STYLES = {
  inlineTagsContainer:
    "border-input rounded-md bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring outline-none focus-within:ring-[3px] focus-within:ring-ring/50 p-1 gap-1",
  input: "w-full min-w-[60px] shadow-none px-1.5 h-6 text-[10px]",
  tag: {
    body: "h-6 relative bg-background border border-input hover:bg-background rounded-md font-medium text-[10px] ps-1.5 pe-6",
    closeButton:
      "absolute -inset-y-px -end-px p-0 rounded-e-md flex size-6 transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-muted-foreground/80 hover:text-foreground",
  },
};

// Convert string array to Tag array for emblor
function toTags(strings: string[]): TagType[] {
  return strings.filter((text) => text.trim() !== "").map((text) => ({ id: `tag-${text}`, text }));
}

// Convert Tag array back to string array
function toStrings(tags: TagType[]): string[] {
  return tags.map((tag) => tag.text.toLowerCase()).filter((text) => text.trim() !== "");
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const SectionHeader = memo(function SectionHeader({ 
  icon: Icon, 
  title, 
  count 
}: { 
  icon: LucideIcon; 
  title: string; 
  count?: number; 
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-3.5 text-muted-foreground/70" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{title}</span>
      {count !== undefined && (
        <span className="ml-auto rounded-sm bg-muted/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground/60">
          {count}
        </span>
      )}
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const PromptConfigPanel = memo(function PromptConfigPanel({
  prompt,
  versions,
  variables,
  paths,
  onUpdateTags,
  className,
}: PromptConfigPanelProps) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);
  const [localTags, setLocalTags] = useState<TagType[]>(toTags(prompt.tags));

  // Sync local tags when prop changes (e.g., after backend update or navigation)
  useEffect(() => {
    setLocalTags(toTags(prompt.tags));
  }, [prompt.tags]);

  const handleCopy = useCallback((varName: string) => {
    navigator.clipboard.writeText(`{{${varName}}}`);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 1500);
  }, []);

  const handleTagsChange = useCallback(
    (newTags: TagType[]) => {
      setLocalTags(newTags);
      // Persist to backend
      const tagStrings = toStrings(newTags);
      onUpdateTags?.(tagStrings);
    },
    [onUpdateTags]
  );

  return (
    <div className={cn("flex flex-col gap-6 p-4", className)}>
      {/* Variables Section */}
      <div className="space-y-3">
        <SectionHeader icon={Variable} title="Variables" count={variables.length} />
        
        {variables.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <button
                key={v}
                onClick={() => handleCopy(v)}
                className="group flex items-center gap-1.5 rounded-sm bg-muted/30 px-2 py-1 text-[11px] font-mono transition-all hover:bg-blue-500/10"
              >
                <span className="text-primary/90">{v}</span>
                <div className="size-3 flex items-center justify-center">
                  {copiedVar === v ? (
                    <Check className="size-2.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 text-[11px] text-muted-foreground/60 italic">No variables detected</p>
        )}

        {/* Nested Paths */}
        {paths.length > variables.length && (
          <div className="mt-2 space-y-1 px-1">
            <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground/30">Full Paths</p>
            <div className="flex flex-wrap gap-1">
              {paths.map((p) => (
                <span key={p} className="text-[9px] font-mono text-muted-foreground/50">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tags Section - editable */}
      <div className="space-y-3">
        <SectionHeader icon={Tag} title="Tags" count={localTags.length} />
        <TagInput
          tags={localTags}
          setTags={handleTagsChange}
          placeholder="Add tag..."
          activeTagIndex={activeTagIndex}
          setActiveTagIndex={setActiveTagIndex}
          styleClasses={TAG_INPUT_STYLES}
        />
      </div>

      {/* Metadata Section */}
      <div className="space-y-3">
        <SectionHeader icon={Info} title="Metadata" />
        <div className="grid grid-cols-1 gap-2 rounded-sm bg-muted/20 p-3">
          <div className="grid grid-cols-2 items-center gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <Type className="size-3" />
              <span>Prompt Type</span>
            </div>
            <span className="font-bold capitalize text-foreground/80">{prompt.type}</span>

            <div className="flex items-center gap-2 text-muted-foreground/70">
              <Shield className="size-3" />
              <span>System Prompt</span>
            </div>
            <span className="font-bold text-foreground/80">{prompt.isSystem ? "Yes" : "No"}</span>

            <div className="flex items-center gap-2 text-muted-foreground/70">
              <Hash className="size-3" />
              <span>Total Versions</span>
            </div>
            <span className="font-bold text-foreground/80">{versions.length}</span>

            <div className="flex items-center gap-2 text-muted-foreground/70">
              <Calendar className="size-3" />
              <span>Created On</span>
            </div>
            <span className="font-bold text-foreground/80">
              {new Date(prompt.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
