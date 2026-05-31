/**
 * MindState Keys Editor
 *
 * Reusable component for managing mindstate definition keys.
 * Displays selected keys as badges with remove buttons and provides
 * a dropdown to add available definitions.
 *
 * @module shared/components/mindstate-keys-editor
 */

import type { MindstateDefinition } from "@journey/schemas";
import { Loader2, X } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/shared/components/ui/select";

export interface MindstateKeysEditorProps {
  /** Currently selected keys */
  keys: string[];
  /** Available mindstate definitions to choose from */
  availableDefinitions: MindstateDefinition[];
  /** Callback when a key is added */
  onAdd: (key: string) => void;
  /** Callback when a key is removed */
  onRemove: (key: string) => void;
  /** Show loading state */
  isLoading?: boolean;
  /** Disable all interactions */
  disabled?: boolean;
  /** Placeholder text when no keys selected */
  emptyText?: string;
}

export function MindstateKeysEditor({
  keys,
  availableDefinitions,
  onAdd,
  onRemove,
  isLoading = false,
  disabled = false,
  emptyText = "None selected",
}: MindstateKeysEditorProps) {
  // Filter out definitions that are already selected
  const unselectedDefinitions = availableDefinitions.filter((d) => !keys.includes(d.key));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {keys.length === 0 ? (
        <span className="text-sm text-muted-foreground italic">{emptyText}</span>
      ) : (
        keys.map((key) => (
          <Badge key={key} variant="secondary" className="gap-1 pr-1">
            {key}
            <button
              type="button"
              onClick={() => onRemove(key)}
              disabled={isLoading || disabled}
              className="ml-0.5 hover:bg-muted rounded-sm p-0.5 disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))
      )}
      {unselectedDefinitions.length > 0 && (
        <Select onValueChange={onAdd} disabled={isLoading || disabled}>
          <SelectTrigger className="h-6 w-[100px] text-xs">
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="text-muted-foreground">+ Add</span>}
          </SelectTrigger>
          <SelectContent>
            {unselectedDefinitions.map((def) => (
              <SelectItem key={def.key} value={def.key}>
                {def.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
