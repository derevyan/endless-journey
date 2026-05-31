/**
 * ModelSelectorPopover Component
 *
 * Reusable popover for selecting LLM models.
 * Uses Command palette with search, grouped by provider.
 *
 * @module shared/components/model-selector-popover
 */

import { useModelsByProvider, type ModelRegistryEntry } from "@/hooks/queries/use-models";
import { PROVIDER_CONFIG, ProviderLogo } from "@/shared/components/provider-logo";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { Brain, Check, ChevronsUpDown, Eye, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";



// Re-export for consumers needing model metadata
export type { ModelRegistryEntry } from "@/hooks/queries/use-models";

interface ModelSelectorPopoverProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showCapabilityBadges?: boolean;
}

/**
 * Helper to display capability icons
 */
function CapabilityIcons({ capabilities, className }: { capabilities: ModelRegistryEntry["capabilities"]; className?: string }) {
  if (!capabilities) return null;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {capabilities.reasoning && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Brain className="size-3 text-foreground opacity-10" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Reasoning</TooltipContent>
        </Tooltip>
      )}
      {capabilities.vision && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Eye className="size-3 text-foreground opacity-10" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Vision</TooltipContent>
        </Tooltip>
      )}
      {capabilities.toolCalling && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Wrench className="size-3 text-foreground opacity-10" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Tool Calling</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function ModelSelectorPopover({
  value,
  onChange,
  disabled = false,
  placeholder = "Select model...",
  className,
  showCapabilityBadges = true,
}: ModelSelectorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: modelsData, isLoading, isError, refetch } = useModelsByProvider();
  const modelsByProvider = useMemo(() => modelsData?.modelsByProvider ?? {}, [modelsData?.modelsByProvider]);

  // Find currently selected model
  const selectedModel = useMemo(() => {
    return Object.values(modelsByProvider)
      .flat()
      .find((m) => m.id === value);
  }, [modelsByProvider, value]);

  // Search logic
  const filteredModelsByProvider = useMemo(() => {
    if (!query.trim()) return modelsByProvider;
    const search = query.toLowerCase();
    const filtered: Record<string, ModelRegistryEntry[]> = {};

    Object.entries(modelsByProvider).forEach(([provider, models]) => {
      const matched = models.filter((m) => {
        const matchesText =
          m.displayName.toLowerCase().includes(search) ||
          m.id.toLowerCase().includes(search) ||
          provider.toLowerCase().includes(search);
        
        const matchesCapabilities =
          (search.includes("vision") && m.capabilities.vision) ||
          (search.includes("reasoning") && m.capabilities.reasoning) ||
          (search.includes("tool") && m.capabilities.toolCalling);

        return matchesText || matchesCapabilities;
      });

      if (matched.length > 0) {
        filtered[provider] = matched;
      }
    });
    return filtered;
  }, [modelsByProvider, query]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setOpen(false);
    setQuery("");
  };

  const content = (
    <Command shouldFilter={false} className="h-[350px]">
      <div className="flex items-center border-b px-3">
        <Sparkles className="mr-2 size-4 text-muted-foreground opacity-50" />
        <CommandInput 
          placeholder="Search models..." 
          value={query}
          onValueChange={setQuery}
          className="h-10 border-none focus:ring-0 font-normal"
        />
      </div>
      
      {isLoading ? (
        <div className="flex h-full flex-col items-center justify-center p-4 text-sm text-muted-foreground">
          <div className="mb-2 size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading models...
        </div>
      ) : isError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
          <p>Failed to load models</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-xs">
            Retry
          </Button>
        </div>
      ) : (
        <CommandList className="h-full max-h-none">
          <ScrollArea className="h-[300px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No models found.
            </CommandEmpty>
            
            {Object.entries(filteredModelsByProvider).map(([provider, models]) => (
              <CommandGroup key={provider} heading={PROVIDER_CONFIG[provider]?.name || provider} className="p-1.5 pb-0">
                {models.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => handleSelect(model.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <div className="flex size-4 shrink-0 items-center justify-center">
                      {value === model.id && <Check className="size-3" />}
                    </div>
                    
                    <div className="flex flex-1 flex-col justify-center overflow-hidden">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate font-normal leading-none", value === model.id && "text-primary")}>
                          {model.displayName}
                        </span>
                        {showCapabilityBadges && (
                          <TooltipProvider delayDuration={0}>
                            <CapabilityIcons capabilities={model.capabilities} />
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground/80">
                        <span className="truncate">{model.description}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <div className="h-2" />
          </ScrollArea>
        </CommandList>
      )}
    </Command>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between bg-background pl-3 pr-2 text-left font-normal", className)}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedModel ? (
              <>
                <ProviderLogo provider={selectedModel.provider} className="size-4 shrink-0 opacity-70" />
                <span className="truncate font-medium">{selectedModel.displayName}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground/50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[350px]" align="start" collisionPadding={16}>
        {content}
      </PopoverContent>
    </Popover>
  );
}
