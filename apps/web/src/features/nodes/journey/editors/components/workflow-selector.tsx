/**
 * WorkflowSelector Component
 *
 * A dropdown selector for choosing a workflow to delegate agent execution to.
 * Used in the journey agent node editor when in "Workflow Mode".
 */

import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { useAgentWorkflows } from "@/features/agent-workflows/hooks";
import { Check, ChevronsUpDown, Loader2, Workflow } from "lucide-react";
import { useState } from "react";

interface WorkflowSelectorProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
  /** Shows error styling (red border) when true */
  hasError?: boolean;
}

export function WorkflowSelector({
  value,
  onChange,
  disabled,
  className,
  hasError,
}: WorkflowSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useAgentWorkflows({ status: "active" });
  const workflows = data?.workflows ?? [];

  const selectedWorkflow = workflows.find((w) => w.key === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-sm",
            hasError && "border-destructive focus:ring-destructive",
            className
          )}
          disabled={disabled || isLoading}
        >
          <div className="flex items-center gap-2 truncate">
            <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
            {isLoading ? (
              <span className="text-muted-foreground">Loading workflows...</span>
            ) : selectedWorkflow ? (
              <span className="truncate">{selectedWorkflow.name}</span>
            ) : (
              <span className="text-muted-foreground">Select a workflow...</span>
            )}
          </div>
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search workflows..." />
          <CommandList>
            {error ? (
              <CommandEmpty className="py-6 text-center text-sm text-destructive">
                Failed to load workflows
              </CommandEmpty>
            ) : (
              <CommandEmpty>No workflows found.</CommandEmpty>
            )}
            {workflows && workflows.length > 0 && (
              <CommandGroup heading="Available Workflows">
                {workflows.map((workflow) => (
                  <CommandItem
                    key={workflow.key}
                    value={workflow.key}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? undefined : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === workflow.key ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{workflow.name}</span>
                      {workflow.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {workflow.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
