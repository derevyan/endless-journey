/**
 * Prompts Table Toolbar
 *
 * Toolbar with search input and filters for the prompts table.
 * Follows pattern from: features/users/components/data-table-toolbar.tsx
 *
 * @module features/prompts/components/prompts-table-toolbar
 */

import type { Table } from "@tanstack/react-table";
import { X, Search } from "lucide-react";
import React, { memo } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { DataTableFacetedFilter, DataTableViewOptions } from "@/shared/components/ui/data-table";

// =============================================================================
// CONSTANTS
// =============================================================================

const typeOptions = [
  { label: "Text", value: "text" },
  { label: "Chat", value: "chat" },
];

// =============================================================================
// TYPES
// =============================================================================

interface PromptsTableToolbarProps<TData> {
  table: Table<TData>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PromptsTableToolbar = memo(function PromptsTableToolbar<TData>({
  table,
}: PromptsTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] pl-8 lg:w-[250px]"
          />
        </div>
        <div className="flex gap-x-2">
          {table.getColumn("type") && (
            <DataTableFacetedFilter
              column={table.getColumn("type")}
              title="Type"
              options={typeOptions}
            />
          )}
        </div>
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}) as <TData>(props: PromptsTableToolbarProps<TData>) => React.ReactElement;
