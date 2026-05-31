/**
 * MindState Definition Selector
 *
 * Dropdown selector for switching between mindstate definitions and creating new ones.
 * Mirrors the selector pattern used by journeys and agent workflows.
 *
 * @module features/mindstate/components/mindstate-definition-selector
 */

import { useCallback } from "react";
import { Boxes, PlusCircle } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectValue } from "@/shared/components/ui/select";
import { StatusDotBadge } from "@/shared/components/ui/badges";
import { TruncatedSelectTrigger } from "@/shared/components/ui/truncated-select-trigger";
import { cn } from "@/shared/lib/utils";

import { uiActions } from "@/stores/ui-store";

import { useMindstateDefinitionDialogNavigation, useMindstateDefinitions } from "../hooks";
import { NewDefinitionDialog } from "./new-definition-dialog";

interface MindstateDefinitionSelectorProps {
  /** Selected definition key (used for branded URLs) */
  selectedDefinitionKey: string;
  /** Callback when a definition is selected (receives definition key) */
  onDefinitionSelect: (definitionKey: string) => void;
  /** Optional class name */
  className?: string;
}

const CREATE_NEW_VALUE = "__create_new__";

export function MindstateDefinitionSelector({ selectedDefinitionKey, onDefinitionSelect, className }: MindstateDefinitionSelectorProps) {
  const { data } = useMindstateDefinitions();
  const { handleCreate } = useMindstateDefinitionDialogNavigation();
  const definitions = data ?? [];

  const selectedDefinition = definitions.find((definition) => definition.key === selectedDefinitionKey);

  const handleValueChange = useCallback(
    (value: string) => {
      if (value === CREATE_NEW_VALUE) {
        uiActions.openNewDefinitionDialog();
      } else {
        onDefinitionSelect(value);
      }
    },
    [onDefinitionSelect]
  );

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Select value={selectedDefinition?.key ?? ""} onValueChange={handleValueChange}>
          <TruncatedSelectTrigger
            icon={<Boxes className="h-4 w-4" />}
            value={selectedDefinition?.name}
            placeholder="Select Definition"
            tooltipThreshold={30}
            ariaLabel="Select mindstate definition"
            className="w-[240px] h-9"
          >
            <SelectValue>
              <span className="font-medium text-sm truncate min-w-0 block">
                {selectedDefinition?.name || (selectedDefinitionKey === "new" ? "New Definition" : "Select Definition")}
              </span>
            </SelectValue>
          </TruncatedSelectTrigger>
          <SelectContent>
            {definitions.map((definition) => (
              <SelectItem key={definition.key} value={definition.key}>
                <div className="flex items-center gap-2 w-full min-w-0">
                  <span className="font-medium flex-1 truncate min-w-0">{definition.name}</span>
                  <StatusDotBadge
                    label={definition.status === "active" ? "Active" : definition.status === "draft" ? "Draft" : "Archived"}
                    dotClassName={definition.status === "active" ? "bg-emerald-500" : definition.status === "draft" ? "bg-amber-500" : "bg-slate-500"}
                    size="sm"
                    className="shrink-0"
                  />
                </div>
              </SelectItem>
            ))}
            <SelectItem key={CREATE_NEW_VALUE} value={CREATE_NEW_VALUE} className="text-primary">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">Create new definition</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <NewDefinitionDialog onCreate={handleCreate} />
    </>
  );
}
