/**
 * Mobile Filter Drawer Component
 *
 * Drawer for accessing filters on mobile devices.
 * Supports both Journey and CRM filter types.
 *
 * @module components/developers/events/mobile-filter-drawer
 */

import { Filter, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";

import { CrmActivityFilters, type CrmActivityFiltersProps } from "./crm-activity-filters";
import { EventsFilters, type EventsFiltersProps } from "./events-filters";
import { LlmUsageFilters, type LlmUsageFiltersProps } from "./llm-usage-filters";

// =============================================================================
// TYPES
// =============================================================================

interface MobileFilterDrawerProps {
  activeTab: "journey" | "crm" | "llm";
  journeyFilterProps?: EventsFiltersProps;
  crmFilterProps?: CrmActivityFiltersProps;
  llmFilterProps?: LlmUsageFiltersProps;
}

// =============================================================================
// COMPONENT
// =============================================================================

function getFilterTitle(activeTab: MobileFilterDrawerProps["activeTab"]): string {
  switch (activeTab) {
    case "journey":
      return "Journey Events Filters";
    case "crm":
      return "CRM Activity Filters";
    case "llm":
      return "LLM Usage Filters";
  }
}

export function MobileFilterDrawer({ activeTab, journeyFilterProps, crmFilterProps, llmFilterProps }: MobileFilterDrawerProps) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button className="block lg:hidden" size="icon" variant="outline">
          <Filter className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{getFilterTitle(activeTab)}</DrawerTitle>
          <DrawerDescription>Select &amp; Check Filters.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          {activeTab === "journey" && journeyFilterProps && <EventsFilters {...journeyFilterProps} />}
          {activeTab === "crm" && crmFilterProps && <CrmActivityFilters {...crmFilterProps} />}
          {activeTab === "llm" && llmFilterProps && <LlmUsageFilters {...llmFilterProps} />}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button>Apply Filters</Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button variant="outline">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}


