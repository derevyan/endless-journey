/**
 * Parameter List
 *
 * Displays parameters grouped by category with collapse/expand functionality.
 * Collapse state is controlled by the parent component.
 */

import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import type { StateParameter } from "@journey/schemas";

import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { builderActions } from "../../../stores/builder-store";

interface ParameterListProps {
  parameters: StateParameter[];
  categories: string[];
  onParameterClick: (param: StateParameter) => void;
  collapsedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
}

export function ParameterList({
  parameters,
  categories: _categories,
  onParameterClick,
  collapsedCategories,
  onToggleCategory,
}: ParameterListProps) {
  const [parameterToDelete, setParameterToDelete] = useState<StateParameter | null>(null);

  const handleDeleteConfirm = () => {
    if (parameterToDelete) {
      builderActions.deleteParameter(parameterToDelete.id);
      setParameterToDelete(null);
    }
  };

  // Group parameters by category
  const groupedParams: Record<string, StateParameter[]> = {};
  parameters.forEach((p) => {
    if (!groupedParams[p.category]) groupedParams[p.category] = [];
    groupedParams[p.category].push(p);
  });

  // Get sorted category keys (only categories with params)
  const categoryKeys = Object.keys(groupedParams).sort();

  if (parameters.length === 0) {
    return <div className="px-1.5 py-3 text-center text-[10px] text-muted-foreground">No parameters configured</div>;
  }

  return (
    <>
      <div className="space-y-0.5">
        {/* Category Groups */}
        {categoryKeys.map((category) => {
          const isOpen = !collapsedCategories.has(category);
          const items = groupedParams[category];

          return (
            <div key={category} className="mb-1">
              <button
                onClick={() => onToggleCategory(category)}
                className="w-full flex items-center justify-between px-1.5 py-1  hover:bg-accent/30 text-xs font-medium text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  {isOpen ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                  <span className="uppercase tracking-wide text-xs">{category}</span>
                  <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full text-[10px]">{items.length}</span>
                </div>
              </button>

              {isOpen && (
                <div className="ml-1.5 pl-1.5 border-l border-border/50 mt-0.5 space-y-0">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="group relative flex items-center justify-between px-1.5 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => onParameterClick(p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onParameterClick(p);
                        }
                      }}
                    >
                      <span className="text-muted-foreground hover:text-foreground truncate text-xs pr-10">{p.name}</span>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onParameterClick(p);
                          }}
                          className="p-1 hover:text-primary rounded text-muted-foreground transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setParameterToDelete(p);
                          }}
                          className="p-1 hover:text-destructive rounded text-muted-foreground transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!parameterToDelete} onOpenChange={(open) => !open && setParameterToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Parameter</DialogTitle>
            <DialogDescription>Are you sure you want to delete this state parameter?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
              <div className="space-y-0.5">
                <p className="font-medium text-sm">Deleting {parameterToDelete?.name}</p>
                <p className="text-xs opacity-90">This action cannot be undone.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParameterToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete Parameter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
