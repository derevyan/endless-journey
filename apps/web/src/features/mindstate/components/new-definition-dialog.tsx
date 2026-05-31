/**
 * New MindState Definition Dialog
 *
 * Modal dialog for creating a new mindstate definition.
 * Matches the styling of the new-journey-dialog.
 *
 * This dialog is self-managing - it consumes uiStore for dialog state and form values.
 * Only requires an onCreate callback from the parent.
 *
 * @example
 * ```tsx
 * <NewDefinitionDialog onCreate={handleCreateDefinition} />
 * ```
 *
 * @module features/mindstate/components/new-definition-dialog
 */

import { useStore } from "@tanstack/react-store";
import { Loader2, Route } from "lucide-react";
import { useRef } from "react";

import { useJourneyListManifest } from "@/hooks/queries";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { uiActions, uiStore } from "@/stores/ui-store";

interface NewDefinitionDialogProps {
  /** Callback when Create button is clicked (parent handles API call) */
  onCreate: () => void;
}

/**
 * Generate a key from a name (slugify)
 */
function generateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export function NewDefinitionDialog({ onCreate }: NewDefinitionDialogProps) {
  // Self-manage state from uiStore
  const {
    isNewDefinitionDialogOpen,
    newDefinitionName,
    newDefinitionKey,
    newDefinitionDescription,
    newDefinitionSelectedJourneyIds,
  } = useStore(uiStore);

  // Track if key was manually edited (resets when dialog opens)
  const keyManuallyEditedRef = useRef(false);

  // Reset manual edit flag when dialog closes (key becomes empty)
  if (newDefinitionKey === "" && keyManuallyEditedRef.current) {
    keyManuallyEditedRef.current = false;
  }

  const { data: journeys = [], isLoading: journeysLoading } = useJourneyListManifest();

  // Handler for name change with auto-generate key
  const handleNameChange = (name: string) => {
    uiActions.setDefinitionName(name);
    // Auto-generate key if not manually edited
    if (!keyManuallyEditedRef.current) {
      uiActions.setDefinitionKey(generateKey(name));
    }
  };

  // Handler for key change (marks as manually edited)
  const handleKeyChange = (key: string) => {
    uiActions.setDefinitionKey(key);
    keyManuallyEditedRef.current = true;
  };

  if (!isNewDefinitionDialogOpen) return null;

  // Validate key format
  const isKeyValid = newDefinitionKey === "" || /^[a-z0-9-]+$/.test(newDefinitionKey);
  const canCreate = newDefinitionName.trim() !== "" && newDefinitionKey.trim() !== "" && isKeyValid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur">
        <h2 className="text-lg font-semibold text-foreground mb-4">Create new definition</h2>
        <div className="space-y-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="new-definition-name" className="text-sm text-muted-foreground">
              Name
            </Label>
            <input
              id="new-definition-name"
              className="w-full rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={newDefinitionName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Companion State"
            />
          </div>

          {/* Key field */}
          <div className="space-y-2">
            <Label htmlFor="new-definition-key" className="text-sm text-muted-foreground">
              Key
            </Label>
            <input
              id="new-definition-key"
              className={`w-full rounded-lg border bg-card/80 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 ${
                isKeyValid
                  ? "border-border/70 focus:border-primary focus:ring-primary/30"
                  : "border-destructive focus:border-destructive focus:ring-destructive/30"
              }`}
              value={newDefinitionKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="my-companion-state"
            />
            <p className={`text-xs ${isKeyValid ? "text-muted-foreground" : "text-destructive"}`}>
              {isKeyValid
                ? "Lowercase letters, numbers, and hyphens only"
                : "Invalid key format - use lowercase letters, numbers, and hyphens only"}
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="new-definition-description" className="text-sm text-muted-foreground">
              Description
            </Label>
            <textarea
              id="new-definition-description"
              className="w-full rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={newDefinitionDescription}
              onChange={(e) => uiActions.setDefinitionDescription(e.target.value)}
              placeholder="Optional description of this mindstate definition..."
              rows={2}
            />
          </div>

          {/* Journey connection section */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Connect to Journeys (optional)</Label>
            {journeysLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading journeys...</span>
              </div>
            ) : journeys.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">No journeys available</p>
            ) : (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border/70 bg-card/80">
                {journeys.map((journey) => (
                  <label
                    key={journey.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={newDefinitionSelectedJourneyIds.includes(journey.id)}
                      onCheckedChange={() => uiActions.toggleDefinitionJourney(journey.id)}
                    />
                    <Route className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{journey.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Selected journeys will automatically track this mindstate
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => uiActions.resetNewDefinitionDialog()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={onCreate}
              disabled={!canCreate}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
