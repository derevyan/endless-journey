import { Select, SelectContent, SelectItem, SelectValue } from "@/shared/components/ui/select";
import { TruncatedSelectTrigger } from "@/shared/components/ui/truncated-select-trigger";
import { cn } from "@/shared/lib/utils";
import { LayoutTemplate, PlusCircle } from "lucide-react";

import { useJourneyData } from "@/features/journey/builder/hooks/queries/use-journey-data";
import { uiActions } from "@/stores/ui-store";

interface JourneySelectorProps {
  /** The slug of the currently selected journey */
  selectedJourneySlug: string;
  /** Callback when a journey is selected (receives slug) */
  onJourneySelect: (journeySlug: string) => void;
  className?: string;
}

const CREATE_NEW_VALUE = "__create_new__";

export function JourneySelector({ selectedJourneySlug, onJourneySelect, className }: JourneySelectorProps) {
  // Use journeys from context
  const { availableJourneys } = useJourneyData();
  // onCreateNewJourney is now handled by uiActions

  // Find selected journey by slug
  const selectedJourney = availableJourneys.find((journey) => journey.slug === selectedJourneySlug);

  const handleValueChange = (value: string) => {
    if (value === CREATE_NEW_VALUE) {
      uiActions.openNewJourneyDialog();
    } else {
      onJourneySelect(value);
    }
  };

  return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* <span className="text-muted-foreground text-sm hidden md:inline">Select:</span> */}
        <Select value={selectedJourneySlug} onValueChange={handleValueChange}>
          <TruncatedSelectTrigger
            icon={<LayoutTemplate className="h-4 w-4" />}
            value={selectedJourney?.name}
            placeholder="Select Journey"
            tooltipThreshold={30}
            ariaLabel="Select journey"
            className="w-[240px] h-9"
          >
            <SelectValue>
              <span className="font-medium text-sm truncate min-w-0 block">
                {selectedJourney?.name || "Select Journey"}
              </span>
            </SelectValue>
          </TruncatedSelectTrigger>
        <SelectContent>
          {availableJourneys.map((journey) => (
            <SelectItem key={journey.slug} value={journey.slug}>
              <div className="flex flex-col items-start">
                <span className="font-medium">{journey.name}</span>
                {journey.description && <span className="text-xs text-muted-foreground">{journey.description}</span>}
              </div>
            </SelectItem>
          ))}
          <SelectItem key={CREATE_NEW_VALUE} value={CREATE_NEW_VALUE} className="text-primary">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">Create new journey</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
